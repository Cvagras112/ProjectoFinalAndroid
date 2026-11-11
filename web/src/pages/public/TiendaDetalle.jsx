
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  collection,
  doc,
  getDoc,
  getDocs,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import './TiendaDetalle.css'

const IMAGEN_PREDETERMINADA =
  'https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?w=1200&auto=format&fit=crop&q=85'

const CLAVE_SEGUIDAS = 'bora-tiendas-seguidas'

function normalizarTexto(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function obtenerSeguidas() {
  try {
    const datos = JSON.parse(
      localStorage.getItem(CLAVE_SEGUIDAS) || '[]'
    )

    return Array.isArray(datos) ? datos : []
  } catch {
    return []
  }
}

export default function TiendaDetalle() {
  const { slug: tiendaId } = useParams()

  const [tienda, setTienda] = useState(null)
  const [productos, setProductos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [seguida, setSeguida] = useState(() => obtenerSeguidas().includes(tiendaId))
  const [mensajeCompartir, setMensajeCompartir] = useState('')

  useEffect(() => {
    let activo = true

    async function cargarTienda() {
      try {
        setCargando(true)
        setError('')
        setTienda(null)
        setProductos([])

        const referencia = doc(db, 'tiendas', tiendaId)
        const resultado = await getDoc(referencia)

        if (!resultado.exists() || resultado.data().activo !== true) {
          return
        }

        const datosTienda = {
          id: resultado.id,
          ...resultado.data(),
        }

        const resultadoProductos = await getDocs(
          collection(db, 'productos')
        )

        const productosTienda = resultadoProductos.docs
          .map((documento) => ({
            ...documento.data(),
            id: documento.id,
          }))
          .filter(
            (producto) =>
              producto.ID_Tienda === tiendaId &&
              producto.Disponible !== false
          )

        if (activo) {
          setTienda(datosTienda)
          setProductos(productosTienda)
        }
      } catch (errorFirebase) {
        console.error('Error al cargar tienda:', errorFirebase)

        if (activo) {
          setError(
            'No pudimos cargar esta tienda. Inténtalo nuevamente.'
          )
        }
      } finally {
        if (activo) {
          setCargando(false)
        }
      }
    }

    cargarTienda()

    return () => {
      activo = false
    }
  }, [tiendaId])

  const productosFiltrados = productos.filter((producto) => {
    const contenido = normalizarTexto(
      `${producto.Nombre || producto.nombre || ''} ${producto.Categoria || producto.categoria || ''
      }`
    )

    return contenido.includes(normalizarTexto(busqueda))
  })

  function cambiarSeguimiento() {
    const seguidas = obtenerSeguidas()

    const nuevas = seguida
      ? seguidas.filter((id) => id !== tiendaId)
      : [...new Set([...seguidas, tiendaId])]

    localStorage.setItem(
      CLAVE_SEGUIDAS,
      JSON.stringify(nuevas)
    )

    setSeguida(!seguida)
  }

  async function compartirTienda() {
    const datos = {
      title: tienda?.nombre || 'Emprendimiento BORA',
      text: `Conoce ${tienda?.nombre} en BORA`,
      url: window.location.href,
    }

    try {
      if (navigator.share) {
        await navigator.share(datos)
      } else {
        await navigator.clipboard.writeText(datos.url)
        setMensajeCompartir('¡Enlace copiado!')
      }
    } catch (errorCompartir) {
      if (errorCompartir.name !== 'AbortError') {
        setMensajeCompartir('No se pudo compartir el enlace.')
      }
    }
  }

  if (cargando) {
    return (
      <main className="bora-tienda-detalle">
        <div style={{ padding: 70, textAlign: 'center' }}>
          <h2>🌿 Cargando emprendimiento...</h2>
          <p>Estamos preparando la información de la tienda.</p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="bora-tienda-detalle">
        <div style={{ padding: 70, textAlign: 'center' }}>
          <h2>⚠️ No pudimos cargar la tienda</h2>
          <p>{error}</p>
          <Link to="/tiendas">Volver a emprendimientos</Link>
        </div>
      </main>
    )
  }

  if (!tienda) {
    return (
      <main className="bora-tienda-detalle">
        <div style={{ padding: 70, textAlign: 'center' }}>
          <h1>No encontramos este emprendimiento</h1>
          <p>La tienda que buscas no está disponible.</p>
          <Link to="/tiendas">Volver a emprendimientos</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="bora-tienda-detalle">

      <section className="bora-tienda-portada">
        <img
          src={tienda.imagen?.trim() || IMAGEN_PREDETERMINADA}
          alt={tienda.nombre}
          onError={(evento) => {
            evento.currentTarget.onerror = null
            evento.currentTarget.src = IMAGEN_PREDETERMINADA
          }}
        />
      </section>

      <section className="bora-tienda-contenido">

        <Link to="/tiendas">
          ← Volver a emprendimientos
        </Link>

        <div className="bora-tienda-perfil">
          <div className="bora-tienda-avatar">
            {tienda.nombre?.charAt(0).toUpperCase() || 'B'}
          </div>

          <div className="bora-tienda-informacion">
            <span>{tienda.categoria || 'Emprendimiento BORA'}</span>

            <h1>{tienda.nombre}</h1>

            <p>
              {tienda.descripcion ||
                'Conoce los productos de este emprendimiento.'}
            </p>
          </div>


          <div className="bora-tienda-acciones">


            {(() => {
              const telefono = String(
                tienda.whatsapp || tienda.telefono || ''
              ).replace(/\D/g, '')

              const numeroWhatsApp =
                telefono.length === 9 && telefono.startsWith('9')
                  ? `56${telefono}`
                  : telefono


              const correo = String(
                tienda.emailContacto || tienda.correo || tienda.email || ''
              ).trim()


              const mensaje = `¡Hola! Vi tu tienda "${tienda.nombre}" en BORA y me gustaría obtener más información sobre tus productos.`

              const asunto = `Consulta sobre ${tienda.nombre} - BORA`

              return (
                <div className="bora-tienda-contactos">

                  {numeroWhatsApp && (
                    <a
                      href={`https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensaje)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bora-tienda-contacto-whatsapp"
                    >
                      <span aria-hidden="true">💬</span>
                      WhatsApp
                    </a>
                  )}

                  {correo && (
                    <a
                      href={`mailto:${correo}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensaje)}`}
                      className="bora-tienda-contacto-email"
                    >
                      <span aria-hidden="true">✉️</span>
                      Correo 
                    </a>
                  )}

                  {!numeroWhatsApp && !correo && (
                    <span className="bora-tienda-contacto-no-disponible">
                      Contacto no disponible
                    </span>
                  )}

                </div>
              )
            })()}


            <button
              type="button"
              onClick={cambiarSeguimiento}
            >
              {seguida ? '💚 Siguiendo' : '🤍 Seguir tienda'}
            </button>

            <button
              type="button"
              onClick={compartirTienda}
            >
              🔗 Compartir tienda
            </button>

            {mensajeCompartir && (
              <p role="status">{mensajeCompartir}</p>
            )}

          </div>
        </div>


        <section className="bora-tienda-productos">

          <div className="bora-tienda-productos-header">
            <div>
              <h2>🛍️ Productos de {tienda.nombre}</h2>
              <p>
                Descubre los productos de este emprendimiento.
              </p>
            </div>

            <input
              type="search"
              placeholder="Buscar en esta tienda..."
              aria-label="Buscar productos de esta tienda"
              value={busqueda}
              onChange={(evento) =>
                setBusqueda(evento.target.value)
              }
            />
          </div>

          <p>
            {productosFiltrados.length}{' '}
            {productosFiltrados.length === 1
              ? 'producto encontrado'
              : 'productos encontrados'}
          </p>

          {productosFiltrados.length > 0 ? (
            <div className="bora-tienda-productos-grid">
              {productosFiltrados.map((producto) => {
                const nombre =
                  producto.Nombre || producto.nombre || 'Producto'

                const precio =
                  producto.Precio ?? producto.precio ?? 0

                return (
                  <Link
                    key={producto.id}
                    to={`/productos/${producto.id}`}
                    className="bora-tienda-producto"
                  >
                    <img
                      src={
                        producto.imagen?.trim() ||
                        IMAGEN_PREDETERMINADA
                      }
                      alt={nombre}
                      loading="lazy"
                      onError={(evento) => {
                        evento.currentTarget.onerror = null
                        evento.currentTarget.src =
                          IMAGEN_PREDETERMINADA
                      }}
                    />

                    <div>
                      <span>
                        {producto.Categoria ||
                          producto.categoria ||
                          'Artesanía'}
                      </span>

                      <h3>{nombre}</h3>

                      <strong>
                        ${Number(precio).toLocaleString('es-CL')}
                      </strong>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="bora-tienda-sin-productos">
              <h3>🌱 Aún no hay productos disponibles</h3>
              <p>
                {busqueda
                  ? 'Prueba con otra búsqueda.'
                  : 'Esta tienda todavía no tiene productos publicados.'}
              </p>
            </div>
          )}

        </section>
      </section>
    </main>
  )
}
