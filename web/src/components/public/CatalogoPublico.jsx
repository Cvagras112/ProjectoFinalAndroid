import { useMemo, useState } from 'react'
import { disponibilidadProducto } from '../../services/productos/productoModelo'
import TarjetaProductoPublica from './TarjetaProductoPublica'
import './CatalogoPublico.css'

function normalizar(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

export default function CatalogoPublico({ productos, tiendas = [], tienda, categoriasAdicionales = [], cargando = false, error = '' }) {
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('')
  const [tiendaFiltro, setTiendaFiltro] = useState('')
  const [disponibilidad, setDisponibilidad] = useState('')
  const [minimo, setMinimo] = useState('')
  const [maximo, setMaximo] = useState('')
  const [orden, setOrden] = useState('predeterminado')
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  const tiendasPorId = useMemo(() => new Map(tiendas.map(t => [t.id, t])), [tiendas])
  // La visibilidad siempre la determina el modelo existente; los filtros solo presentan sus resultados.
  const categorias = useMemo(() => {
    const mapa = new Map()
    for (const nombre of [...categoriasAdicionales, ...productos.map(p => p.categoria)].filter(Boolean)) {
      const clave = normalizar(nombre)
      if (!mapa.has(clave)) mapa.set(clave, { nombre, cantidad: 0 })
    }
    for (const producto of productos) {
      const grupo = mapa.get(normalizar(producto.categoria))
      if (grupo) grupo.cantidad += 1
    }
    return [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-CL'))
  }, [productos, categoriasAdicionales])
  const emprendimientos = [...new Set(productos.map(p => p.tienda).filter(Boolean))]
  const filtrados = productos.filter(p => {
    const contenido = `${p.nombre} ${p.categoria} ${p.descripcion || ''} ${tienda?.nombre || p.tienda || ''}`
    const estado = disponibilidadProducto(p)
    return normalizar(contenido).includes(normalizar(busqueda))
      && (!categoria || normalizar(p.categoria) === normalizar(categoria))
      && (!tiendaFiltro || p.tienda === tiendaFiltro)
      && (!disponibilidad || (disponibilidad === 'disponible' ? estado.startsWith('Disponible')
        : disponibilidad === 'A pedido' ? estado === 'A pedido' || p.ofrecerPedido === true : estado === disponibilidad))
      && (minimo === '' || p.precio >= Number(minimo))
      && (maximo === '' || p.precio <= Number(maximo))
  }).sort((a, b) => {
    if (orden === 'precio-asc') return a.precio - b.precio
    if (orden === 'precio-desc') return b.precio - a.precio
    if (orden === 'nombre-asc') return a.nombre.localeCompare(b.nombre, 'es-CL')
    if (orden === 'nombre-desc') return b.nombre.localeCompare(a.nombre, 'es-CL')
    return 0
  })
  const hayFiltros = Boolean(busqueda || categoria || tiendaFiltro || disponibilidad || minimo !== '' || maximo !== '' || orden !== 'predeterminado')
  const rangoInvalido = minimo !== '' && maximo !== '' && Number(minimo) > Number(maximo)

  function limpiar() {
    setBusqueda(''); setCategoria(''); setTiendaFiltro(''); setDisponibilidad('')
    setMinimo(''); setMaximo(''); setOrden('predeterminado')
  }

  return (
    <div className="bora-publico-catalogo" aria-busy={cargando}>
      <aside className="bora-publico-filtros" aria-label="Filtros de productos">
        <button className="bora-publico-plegar" type="button" aria-expanded={filtrosAbiertos} aria-controls="catalogo-filtros" onClick={() => setFiltrosAbiertos(!filtrosAbiertos)}>
          Filtrar productos <span aria-hidden="true">{filtrosAbiertos ? '−' : '+'}</span>
        </button>
        <div id="catalogo-filtros" className={`bora-publico-filtros-contenido ${filtrosAbiertos ? 'abierto' : ''}`} onKeyDown={evento => {
          if (evento.key === 'Escape') {
            setFiltrosAbiertos(false)
            evento.currentTarget.previousElementSibling.focus()
          }
        }}>
          <div className="bora-publico-filtros-titulo"><h3>Filtrar productos</h3><button type="button" onClick={limpiar}>Limpiar</button></div>
          <div className="bora-publico-filtro-grupo">
            <h4>Categorías</h4>
            <button type="button" className="bora-publico-filtro-opcion" aria-pressed={!categoria} onClick={() => setCategoria('')}><span>Todas</span><small>{productos.length}</small></button>
            {categorias.map(({ nombre, cantidad }) => (
              <button key={normalizar(nombre)} type="button" className="bora-publico-filtro-opcion" aria-pressed={normalizar(categoria) === normalizar(nombre)} onClick={() => setCategoria(nombre)}><span>{nombre}</span><small>{cantidad}</small></button>
            ))}
          </div>
          <fieldset className="bora-publico-filtro-grupo">
            <legend>Disponibilidad</legend>
            {[['', 'Todas'], ['disponible', 'Disponible'], ['Agotado', 'Agotado'], ['A pedido', 'A pedido']].map(([valor, nombre]) => (
              <label className="bora-publico-radio" key={valor}><input type="radio" name="disponibilidad" value={valor} checked={disponibilidad === valor} onChange={() => setDisponibilidad(valor)} />{nombre}</label>
            ))}
          </fieldset>
          <div className="bora-publico-filtro-grupo">
            <h4>Precio en pesos chilenos</h4>
            {[['', '10000', 'Hasta $10.000'], ['10000', '20000', '$10.000 a $20.000'], ['20000', '', 'Desde $20.000']].map(([desde, hasta, texto]) => (
              <button key={texto} type="button" className="bora-publico-filtro-opcion" aria-pressed={minimo === desde && maximo === hasta} onClick={() => { setMinimo(desde); setMaximo(hasta) }}>{texto}</button>
            ))}
            <div className="bora-publico-rango">
              <label>Mínimo<input type="number" min="0" step="1" placeholder="$0" value={minimo} onChange={e => setMinimo(e.target.value)} aria-invalid={rangoInvalido} aria-describedby={rangoInvalido ? 'catalogo-error-precio' : undefined} /></label>
              <label>Máximo<input type="number" min="0" step="1" placeholder="Sin límite" value={maximo} onChange={e => setMaximo(e.target.value)} aria-invalid={rangoInvalido} aria-describedby={rangoInvalido ? 'catalogo-error-precio' : undefined} /></label>
            </div>
            {rangoInvalido && <p id="catalogo-error-precio" className="bora-publico-error" role="status">El mínimo debe ser menor o igual al máximo.</p>}
          </div>
          {!tienda && emprendimientos.length > 0 && <div className="bora-publico-filtro-grupo">
            <h4>Emprendimientos</h4>
            <button type="button" className="bora-publico-filtro-opcion" aria-pressed={!tiendaFiltro} onClick={() => setTiendaFiltro('')}>Todos</button>
            {emprendimientos.map(nombre => <button type="button" className="bora-publico-filtro-opcion" key={nombre} aria-pressed={tiendaFiltro === nombre} onClick={() => setTiendaFiltro(nombre)}><span>{nombre}</span><small>{productos.filter(p => p.tienda === nombre).length}</small></button>)}
          </div>}
          <p className="bora-publico-apoyo">Hecho con dedicación.<br />Apoya el talento local.</p>
        </div>
      </aside>
      <div className="bora-publico-resultados">
        <label className="bora-publico-buscador"><span>Buscar productos{tienda ? ' en esta tienda' : ''}</span><input type="search" placeholder="Nombre, categoría o palabra clave…" value={busqueda} onChange={e => setBusqueda(e.target.value)} /></label>
        <div className="bora-publico-herramientas">
          <p role="status">{cargando ? 'Cargando productos…' : error ? 'Productos no disponibles' : <><strong>{filtrados.length}</strong> {filtrados.length === 1 ? 'producto encontrado' : 'productos encontrados'}</>}</p>
          <label>Ordenar por<select value={orden} onChange={e => setOrden(e.target.value)}><option value="predeterminado">Predeterminado</option><option value="precio-asc">Menor precio</option><option value="precio-desc">Mayor precio</option><option value="nombre-asc">Nombre A–Z</option><option value="nombre-desc">Nombre Z–A</option></select></label>
        </div>
        {hayFiltros && <div className="bora-publico-filtros-activos"><span>Filtros aplicados</span><button type="button" onClick={limpiar}>Quitar filtros</button></div>}
        {cargando ? <div className="bora-publico-vacio" role="status"><h3>Preparando el catálogo…</h3><p>Estamos buscando los productos de este emprendimiento.</p></div>
          : error ? <div className="bora-publico-vacio" role="alert"><h3>No pudimos cargar los productos</h3><p>{error}</p><button type="button" onClick={() => window.location.reload()}>Reintentar</button></div>
          : filtrados.length > 0 ? <div className="bora-publico-grid">{filtrados.map(producto => <TarjetaProductoPublica key={producto.id} producto={producto} tienda={tienda || tiendasPorId.get(producto.tiendaId)} contexto={tienda ? "tienda" : "general"} />)}</div>
          : <div className="bora-publico-vacio"><span aria-hidden="true">✦</span><h3>{productos.length === 0 ? 'Aún no hay productos publicados' : 'No encontramos productos'}</h3><p>{productos.length === 0 ? (tienda ? 'Esta tienda todavía no tiene productos publicados.' : 'Todavía no hay productos publicados en BORA.') : 'Prueba con otra búsqueda o modifica los filtros.'}</p>{hayFiltros && <button type="button" onClick={limpiar}>Ver todos los productos</button>}</div>}
      </div>
    </div>
  )
}
