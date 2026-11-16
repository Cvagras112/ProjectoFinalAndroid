import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { obtenerTiendaPublica } from '../../services/tiendas/tiendaService'
import { obtenerProductosPorTienda } from '../../services/productos/productoService'
import ImagenPublica from '../../components/ImagenPublica'
import ContactosPublicos from '../../components/ContactosPublicos'
import CatalogoPublico from '../../components/public/CatalogoPublico'
import BotonSeguirTienda from '../../components/BotonSeguirTienda'
import './TiendaDetalle.css'

export default function TiendaDetalle() {
  const { slug: tiendaId } = useParams()
  return <ContenidoTienda key={tiendaId} tiendaId={tiendaId} />
}

function ContenidoTienda({ tiendaId }) {
  const [tienda, setTienda] = useState(null)
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [errorProductos, setErrorProductos] = useState('')
  const [cargandoProductos, setCargandoProductos] = useState(true)
  const [pestana, setPestana] = useState('productos')
  const [mensajeCompartir, setMensajeCompartir] = useState('')
  const [portadaFallida, setPortadaFallida] = useState(false)

  useEffect(() => {
    let activo = true
    async function cargar() {
      try {
        const datos = await obtenerTiendaPublica(tiendaId)
        if (!activo) return
        setTienda(datos)
        setCargando(false)
        if (!datos) return
        try {
          const lista = await obtenerProductosPorTienda(tiendaId)
          if (activo) setProductos(lista.filter(p => p.visible))
        } catch {
          if (activo) setErrorProductos('No pudimos cargar los productos. Recarga la página para reintentar.')
        } finally {
          if (activo) setCargandoProductos(false)
        }
      } catch {
        if (activo) setError('No pudimos cargar esta tienda. Inténtalo nuevamente.')
      } finally {
        if (activo) setCargando(false)
      }
    }
    cargar()
    return () => { activo = false }
  }, [tiendaId])

  async function compartirTienda() {
    const datos = { title: tienda.nombre, text: `Conoce ${tienda.nombre} en BORA`, url: window.location.href }
    try {
      if (navigator.share) await navigator.share(datos)
      else {
        await navigator.clipboard.writeText(datos.url)
        setMensajeCompartir('¡Enlace copiado!')
      }
    } catch (errorCompartir) {
      if (errorCompartir.name !== 'AbortError') setMensajeCompartir('No se pudo compartir el enlace.')
    }
  }

  function navegarPestanas(evento) {
    const opciones = ['productos', 'informacion']
    const posicion = opciones.indexOf(pestana)
    let siguiente
    if (evento.key === 'ArrowRight') siguiente = opciones[(posicion + 1) % opciones.length]
    if (evento.key === 'ArrowLeft') siguiente = opciones[(posicion + opciones.length - 1) % opciones.length]
    if (evento.key === 'Home') siguiente = opciones[0]
    if (evento.key === 'End') siguiente = opciones.at(-1)
    if (siguiente) {
      evento.preventDefault()
      setPestana(siguiente)
      evento.currentTarget.parentElement.querySelector(`#tienda-tab-${siguiente}`).focus()
    }
  }

  if (cargando || error || !tienda) return (
    <main className="bora-tienda-detalle">
      <div className="bora-tienda-contenido">
        <div className="bora-tienda-estado" role={error ? 'alert' : 'status'}>
          <h1>{cargando ? 'Cargando emprendimiento…' : error ? 'No pudimos cargar la tienda' : 'No encontramos este emprendimiento'}</h1>
          <p>{cargando ? 'Estamos preparando la información de la tienda.' : error || 'La tienda que buscas no está disponible.'}</p>
          {!cargando && <Link to="/tiendas">Volver a emprendimientos</Link>}
        </div>
      </div>
    </main>
  )

  const tipo = tienda.categoria && tienda.categoria !== 'Tipo de emprendimiento no informado' ? tienda.categoria : 'Tipo no informado'
  const ubicacion = tienda.sector && tienda.sector !== 'Sector no informado' ? tienda.sector : ''
  const mensaje = `¡Hola! Encontré tu emprendimiento "${tienda.nombre}" en BORA y me gustaría obtener más información sobre tus productos.`
  const contactos = <ContactosPublicos whatsapp={tienda.whatsapp} correo={tienda.emailContacto} asunto={`Consulta desde BORA — ${tienda.nombre}`} mensajeWhatsApp={`${mensaje} ¡Muchas gracias!`} mensajeCorreo={mensaje} />

  return (
    <main className="bora-tienda-detalle">
      <div className="bora-tienda-contenido">
        <nav className="bora-tienda-migas" aria-label="Ubicación en BORA"><Link to="/tiendas">Emprendimientos</Link><span aria-hidden="true">/</span><span>{tienda.nombre}</span></nav>
        <section className="bora-tienda-cabecera" aria-label="Perfil del emprendimiento">
          <div className={`bora-tienda-portada ${!tienda.portada || portadaFallida ? 'bora-tienda-portada--sin-foto' : ''}`}>
            {tienda.portada && !portadaFallida && <img src={tienda.portada} alt={`Portada de ${tienda.nombre}`} onError={() => setPortadaFallida(true)} />}
            <div className="bora-tienda-portada-overlay" />
            <span className="bora-tienda-portada-distintivo">HECHO CON TALENTO LOCAL</span>
          </div>
          <div className="bora-tienda-perfil">
            <div className="bora-tienda-avatar">{tienda.imagen ? <ImagenPublica src={tienda.imagen} alt={`Logo de ${tienda.nombre}`} /> : <span aria-label={`Inicial de ${tienda.nombre}`}>{tienda.nombre.charAt(0).toUpperCase()}</span>}</div>
            <div className="bora-tienda-identidad">
              <span className="bora-tienda-tipo">{tipo}</span>
              <h1>{tienda.nombre}</h1>
              <p className="bora-tienda-descripcion">{tienda.descripcion}</p>
              <div className="bora-tienda-metadatos">
                {ubicacion && <span><span aria-hidden="true">⌖ </span>{ubicacion}</span>}
                {/* El servicio público devuelve únicamente tiendas activas. */}
                <span className="bora-tienda-activa"><span aria-hidden="true">● </span>Tienda activa</span>
                {!cargandoProductos && !errorProductos && <span>{productos.length} {productos.length === 1 ? 'producto publicado' : 'productos publicados'}</span>}
              </div>
            </div>
            <div className="bora-tienda-acciones">
              {contactos}
              <BotonSeguirTienda tiendaId={tiendaId} />
              <button type="button" className="bora-tienda-compartir" onClick={compartirTienda}>Compartir tienda <span aria-hidden="true">↗</span></button>
              {mensajeCompartir && <p role="status">{mensajeCompartir}</p>}
            </div>
          </div>
        </section>
        <div className="bora-tienda-pestanas" role="tablist" aria-label="Contenido de la tienda">
          {[['productos', 'Productos'], ['informacion', 'Información de la tienda']].map(([id, titulo]) => <button key={id} type="button" role="tab" id={`tienda-tab-${id}`} aria-selected={pestana === id} aria-controls={`tienda-panel-${id}`} tabIndex={pestana === id ? 0 : -1} onClick={() => setPestana(id)} onKeyDown={navegarPestanas}>{titulo}</button>)}
        </div>
        <section className="bora-tienda-productos" id="tienda-panel-productos" role="tabpanel" aria-labelledby="tienda-tab-productos" tabIndex={0} hidden={pestana !== 'productos'}>
          <div className="bora-tienda-seccion-titulo"><span>EXPLORA SUS CREACIONES</span><h2>Productos de {tienda.nombre}</h2></div>
          <CatalogoPublico productos={productos} tienda={tienda} cargando={cargandoProductos} error={errorProductos} />
        </section>
        <section className="bora-tienda-informacion" id="tienda-panel-informacion" role="tabpanel" aria-labelledby="tienda-tab-informacion" tabIndex={0} hidden={pestana !== 'informacion'}>
          <div><span className="bora-tienda-antetitulo">CONOCE EL EMPRENDIMIENTO</span><h2>Acerca de {tienda.nombre}</h2><p>{tienda.descripcion}</p></div>
          <dl><div><dt>Tipo de emprendimiento</dt><dd>{tipo}</dd></div>{ubicacion && <div><dt>Ubicación</dt><dd>{ubicacion}</dd></div>}<div><dt>Contacto</dt><dd>{tienda.whatsapp || tienda.emailContacto ? contactos : 'Esta tienda aún no ha informado sus datos de contacto.'}</dd></div></dl>
        </section>
      </div>
    </main>
  )
}
