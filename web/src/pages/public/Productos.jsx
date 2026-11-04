
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  obtenerProductos,
  IMAGEN_PRODUCTO_PREDETERMINADA,
} from '../../services/productos/productoService'
import BotonFavorito from '../../components/BotonFavorito'
import './Productos.css'

// Permite buscar con o sin tildes.
function normalizarTexto(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

// Formato de precios chilenos.
function formatoPrecio(precio) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(precio)
}

export default function Productos() {
  const navigate = useNavigate()

  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState('relevancia')
  const [categoria, setCategoria] = useState('Todas')
  const [tienda, setTienda] = useState('Todas')
  const [precioMin, setPrecioMin] = useState('')
  const [precioMax, setPrecioMax] = useState('')

  // Consultar productos reales de Firestore.
  useEffect(() => {
    let activo = true

    async function cargarProductos() {
      try {
        setCargando(true)
        setError('')

        const resultado = await obtenerProductos()

        if (activo) {
          setProductos(resultado)
        }
      } catch (errorFirebase) {
        console.error('Error al cargar productos:', errorFirebase)

        if (activo) {
          setError(
            'No pudimos cargar los productos desde Firebase.'
          )
        }
      } finally {
        if (activo) {
          setCargando(false)
        }
      }
    }

    cargarProductos()

    return () => {
      activo = false
    }
  }, [])

  const categorias = [
    'Todas',
    ...new Set(productos.map((producto) => producto.categoria)),
  ]

  const tiendas = [
    'Todas',
    ...new Set(productos.map((producto) => producto.tienda)),
  ]

  function contarCategoria(nombre) {
    if (nombre === 'Todas') return productos.length

    return productos.filter(
      (producto) => producto.categoria === nombre
    ).length
  }

  function contarTienda(nombre) {
    if (nombre === 'Todas') return productos.length

    return productos.filter(
      (producto) => producto.tienda === nombre
    ).length
  }

  // Buscar, filtrar y ordenar productos.
  const productosFiltrados = productos
    .filter((producto) => {
      const contenido = normalizarTexto(
        `${producto.nombre} ${producto.categoria} ${producto.tienda}`
      )

      const coincideBusqueda = contenido.includes(
        normalizarTexto(busqueda.trim())
      )

      const coincideCategoria =
        categoria === 'Todas' || producto.categoria === categoria

      const coincideTienda =
        tienda === 'Todas' || producto.tienda === tienda

      const coincideMinimo =
        precioMin === '' ||
        producto.precio >= Number(precioMin)

      const coincideMaximo =
        precioMax === '' ||
        producto.precio <= Number(precioMax)

      return (
        coincideBusqueda &&
        coincideCategoria &&
        coincideTienda &&
        coincideMinimo &&
        coincideMaximo
      )
    })
    .sort((a, b) => {
      if (orden === 'menor-precio') return a.precio - b.precio
      if (orden === 'mayor-precio') return b.precio - a.precio

      if (orden === 'nombre') {
        return a.nombre.localeCompare(b.nombre, 'es')
      }

      // Los IDs de Firestore son cadenas, no números.
      return 0
    })

  function limpiarFiltros() {
    setBusqueda('')
    setCategoria('Todas')
    setTienda('Todas')
    setPrecioMin('')
    setPrecioMax('')
    setOrden('relevancia')
  }

  function abrirProducto(id) {
    navigate(`/productos/${id}`)
  }

  return (
    <main className="bora-catalogo">

      {/* ENCABEZADO */}
      <section className="bora-catalogo-encabezado">
        <span>DESCUBRE EL TALENTO LOCAL</span>

        <h1>Explorar productos</h1>

        <p>
          Encuentra productos únicos creados por emprendedoras
          de nuestra comunidad.
        </p>
      </section>

      {/* CATÁLOGO */}
      <section className="bora-catalogo-contenido">

        {/* BUSCADOR */}
        <input
          type="search"
          placeholder="Buscar productos, categorías o tiendas..."
          aria-label="Buscar productos"
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
        />

        <div className="bora-catalogo-layout">

          {/* FILTROS LATERALES */}
          <aside className="bora-catalogo-filtros">

            <div className="bora-filtros-cabecera">
              <h2>Filtrar productos</h2>

              <button type="button" onClick={limpiarFiltros}>
                Limpiar
              </button>
            </div>

            {/* CATEGORÍAS */}
            <div className="bora-filtro-grupo">
              <h3>Categorías</h3>

              {categorias.map((nombre) => (
                <button
                  key={nombre}
                  type="button"
                  className={
                    categoria === nombre
                      ? 'bora-filtro-opcion activo'
                      : 'bora-filtro-opcion'
                  }
                  onClick={() => setCategoria(nombre)}
                  aria-pressed={categoria === nombre}
                >
                  <span>{nombre}</span>
                  <small>({contarCategoria(nombre)})</small>
                </button>
              ))}
            </div>

            {/* PRECIOS */}
            <div className="bora-filtro-grupo">
              <h3>Precio</h3>

              <button
                type="button"
                className="bora-filtro-opcion"
                onClick={() => {
                  setPrecioMin('')
                  setPrecioMax('10000')
                }}
              >
                Hasta $10.000
              </button>

              <button
                type="button"
                className="bora-filtro-opcion"
                onClick={() => {
                  setPrecioMin('10000')
                  setPrecioMax('20000')
                }}
              >
                $10.000 a $20.000
              </button>

              <button
                type="button"
                className="bora-filtro-opcion"
                onClick={() => {
                  setPrecioMin('20000')
                  setPrecioMax('')
                }}
              >
                Desde $20.000
              </button>

              <div className="bora-filtro-precios">
                <input
                  type="number"
                  min="0"
                  placeholder="Mínimo"
                  aria-label="Precio mínimo"
                  value={precioMin}
                  onChange={(evento) =>
                    setPrecioMin(evento.target.value)
                  }
                />

                <span>—</span>

                <input
                  type="number"
                  min="0"
                  placeholder="Máximo"
                  aria-label="Precio máximo"
                  value={precioMax}
                  onChange={(evento) =>
                    setPrecioMax(evento.target.value)
                  }
                />
              </div>
            </div>

            {/* EMPRENDIMIENTOS */}
            <div className="bora-filtro-grupo">
              <h3>Emprendimientos</h3>

              {tiendas.map((nombre) => (
                <button
                  key={nombre}
                  type="button"
                  className={
                    tienda === nombre
                      ? 'bora-filtro-opcion activo'
                      : 'bora-filtro-opcion'
                  }
                  onClick={() => setTienda(nombre)}
                  aria-pressed={tienda === nombre}
                >
                  <span>{nombre}</span>
                  <small>({contarTienda(nombre)})</small>
                </button>
              ))}
            </div>
          </aside>

          {/* RESULTADOS */}
          <div className="bora-catalogo-resultados">

            {cargando ? (
              <div className="bora-catalogo-sin-resultados">
                <h3>🌿 Cargando productos...</h3>
                <p>Estamos buscando los productos de nuestra comunidad.</p>
              </div>
            ) : error ? (
              <div className="bora-catalogo-sin-resultados">
                <h3>⚠️ No pudimos cargar los productos</h3>
                <p>{error}</p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                >
                  Reintentar
                </button>
              </div>
            ) : (
              <>
                <div className="bora-catalogo-herramientas">
                  <p>
                    {productosFiltrados.length}{' '}
                    {productosFiltrados.length === 1
                      ? 'producto encontrado'
                      : 'productos encontrados'}
                  </p>

                  <div className="bora-catalogo-orden">
                    <label htmlFor="orden-productos">
                      Ordenar por:
                    </label>

                    <select
                      id="orden-productos"
                      value={orden}
                      onChange={(evento) =>
                        setOrden(evento.target.value)
                      }
                    >
                      <option value="relevancia">
                        Predeterminado
                      </option>
                      <option value="menor-precio">
                        Menor precio
                      </option>
                      <option value="mayor-precio">
                        Mayor precio
                      </option>
                      <option value="nombre">
                        Nombre A-Z
                      </option>
                    </select>
                  </div>
                </div>

                {/* TARJETAS SELECCIONABLES */}
                <div className="bora-catalogo-grid">
                  {productosFiltrados.map((producto) => (
                    <article
                      key={producto.id}
                      className="bora-catalogo-tarjeta bora-tarjeta-clickable"
                      onClick={() => abrirProducto(producto.id)}
                      onKeyDown={(evento) => {
                        if (
                          evento.target === evento.currentTarget &&
                          (evento.key === 'Enter' ||
                            evento.key === ' ')
                        ) {
                          evento.preventDefault()
                          abrirProducto(producto.id)
                        }
                      }}
                      tabIndex={0}
                      role="link"
                      aria-label={`Ver detalles de ${producto.nombre}`}
                    >
                      <div className="bora-catalogo-imagen">
                        <img
                          src={producto.imagen}
                          alt={producto.nombre}
                          loading="lazy"
                          onError={(evento) => {
                            evento.currentTarget.onerror = null
                            evento.currentTarget.src =
                              IMAGEN_PRODUCTO_PREDETERMINADA
                          }}
                        />

                        <span className="bora-catalogo-etiqueta">
                          {producto.etiqueta}
                        </span>

                        <div
                          onClick={(evento) =>
                            evento.stopPropagation()
                          }
                          onKeyDown={(evento) =>
                            evento.stopPropagation()
                          }
                        >
                          <BotonFavorito productoId={producto.id} />
                        </div>
                      </div>

                      <div className="bora-catalogo-info">
                        <span className="bora-catalogo-categoria">
                          {producto.categoria}
                        </span>

                        <h2>{producto.nombre}</h2>

                        <p className="bora-catalogo-tienda">
                          {producto.tienda}
                        </p>

                        <p className="bora-catalogo-descripcion">
                          {producto.descripcion}
                        </p>

                        <strong>
                          {formatoPrecio(producto.precio)}
                        </strong>
                      </div>
                    </article>
                  ))}
                </div>

                {/* SIN RESULTADOS */}
                {productosFiltrados.length === 0 && (
                  <div className="bora-catalogo-sin-resultados">
                    <h3>
                      {productos.length === 0
                        ? '🌱 Aún no hay productos disponibles'
                        : 'No encontramos productos'}
                    </h3>

                    <p>
                      {productos.length === 0
                        ? 'Todavía no hay productos publicados en BORA.'
                        : 'Prueba con otra búsqueda o modifica los filtros.'}
                    </p>

                    {productos.length > 0 && (
                      <button
                        type="button"
                        onClick={limpiarFiltros}
                      >
                        Limpiar filtros
                      </button>
                    )}
                  </div>
                )}
              </>
            )}

          </div>
        </div>
      </section>
    </main>
  )
}
