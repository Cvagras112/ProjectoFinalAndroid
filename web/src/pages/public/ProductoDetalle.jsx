import { disponibilidadProducto } from '../../services/productos/productoModelo'

import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
  obtenerProductoPorId,
  obtenerProductos,
  IMAGEN_PRODUCTO_PREDETERMINADA,
} from '../../services/productos/productoService'

import BotonFavorito from '../../components/BotonFavorito'
import './ProductoDetalle.css'

function formatoPrecio(precio) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(precio)
}

function normalizarWhatsApp(numero) {
  const digitos = String(numero || '').replace(/\D/g, '')

  if (/^9\d{8}$/.test(digitos)) {
    return `56${digitos}`
  }

  if (/^569\d{8}$/.test(digitos)) {
    return digitos
  }

  return ''
}

export default function ProductoDetalle() {
  const { id } = useParams()

  const [varianteId, setVarianteId] = useState('')
  const [producto, setProducto] = useState(null)
  const [relacionados, setRelacionados] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let activo = true

    async function cargarProducto() {
      setCargando(true)
      setError('')
      setProducto(null)
      setVarianteId('')
      setRelacionados([])

      try {
        const productoFirebase = await obtenerProductoPorId(id)

        if (!activo) return

        if (!productoFirebase) {
          setCargando(false)
          return
        }

        setProducto(productoFirebase)

        try {
          const productosFirebase = await obtenerProductos()

          if (!activo) return

          const productosRelacionados = productosFirebase
            .filter(
              (item) =>
                item.categoria === productoFirebase.categoria &&
                item.id !== productoFirebase.id
            )
            .slice(0, 4)

          setRelacionados(productosRelacionados)
        } catch (errorRelacionados) {
          console.error(
            'Error al cargar productos relacionados:',
            errorRelacionados
          )
        }
      } catch (errorFirebase) {
        console.error('Error al cargar producto:', errorFirebase)

        if (activo) {
          setError(
            'No pudimos cargar el producto. Inténtalo nuevamente.'
          )
        }
      } finally {
        if (activo) setCargando(false)
      }
    }

    cargarProducto()

    return () => {
      activo = false
    }
  }, [id])

  if (cargando) {
    return (
      <main className="bora-producto-no-encontrado">
        <h1>🌿 Cargando producto...</h1>
        <p>Estamos preparando los detalles para ti.</p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="bora-producto-no-encontrado">
        <h1>⚠️ Ocurrió un problema</h1>
        <p>{error}</p>
        <Link to="/productos">Volver al catálogo</Link>
      </main>
    )
  }

  if (!producto) {
    return (
      <main className="bora-producto-no-encontrado">
        <h1>Producto no encontrado</h1>
        <p>El producto que buscas no está disponible.</p>
        <Link to="/productos">Volver al catálogo</Link>
      </main>
    )
  }

  const variante = producto.variantes.find(v => v.id === varianteId && v.active) || producto.variantes.find(v => v.active)
  const precioSeleccionado = variante?.price ?? producto.precio
  const imagenSeleccionada = variante?.imageUrl || producto.imagen
  const numeroWhatsApp = normalizarWhatsApp(producto.whatsapp)
  const correo = String(producto.emailContacto || '').trim()

  const mensaje =
    `¡Hola! Vi el producto "${producto.nombre}" ` +
    `en BORA, publicado por "${producto.tienda}", ` +
    `con un precio de ${formatoPrecio(precioSeleccionado)}. ` +
    'Me gustaría obtener más información.'

  const asunto = `Consulta por ${producto.nombre} - BORA`

  const enlaceWhatsApp = numeroWhatsApp
    ? `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensaje)}`
    : ''

  const enlaceCorreo = correo
    ? `mailto:${correo}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensaje)}`
    : ''

  return (
    <main className="bora-producto-pagina">

      {/* NAVEGACIÓN */}
      <nav
        className="bora-producto-ruta"
        aria-label="Ruta de navegación"
      >
        <Link to="/productos">← Volver al catálogo</Link>
        <span>/</span>
        <Link to="/productos">Productos</Link>
        <span>/</span>
        <span>{producto.categoria}</span>
        <span>/</span>
        <strong>{producto.nombre}</strong>
      </nav>

      {/* CONTENIDO PRINCIPAL */}
      <section className="bora-producto-contenedor">

        {/* FOTOGRAFÍA */}
        <div className="bora-producto-galeria">
          <div className="bora-producto-foto">
            <img
              src={imagenSeleccionada}
              alt={producto.nombre}
              onError={(evento) => {
                evento.currentTarget.onerror = null
                evento.currentTarget.src =
                  IMAGEN_PRODUCTO_PREDETERMINADA
              }}
            />
          </div>

          <p className="bora-producto-foto-nota">
            Fotografía referencial del producto.
          </p>
        </div>

        {/* INFORMACIÓN */}
        <div className="bora-producto-informacion">

          <span className="bora-producto-categoria">
            {producto.categoria}
          </span>

          <div className="bora-producto-titulo-fila">
            <h1>{producto.nombre}</h1>
            <BotonFavorito productoId={producto.id} />
          </div>

          <span className="bora-producto-etiqueta">
            ✨ {producto.etiqueta}
          </span>

          <strong className="bora-producto-precio">
            {formatoPrecio(precioSeleccionado)}
          </strong>

          {producto.variantes.length > 0 && (
            <label className="bora-producto-variantes">Elige una variante
              <select value={variante?.id || ''} onChange={e => setVarianteId(e.target.value)}>
                {producto.variantes.filter(v => v.active).map(v => (
                  <option key={v.id} value={v.id}>{v.name} · {formatoPrecio(v.price)} · {disponibilidadProducto(producto, v)}</option>
                ))}
              </select>
            </label>
          )}
          {/* TIENDA */}
          <div className="bora-producto-vendedor">
            <span className="bora-producto-vendedor-icono">
              🏪
            </span>

            <div>
              <small>Producto ofrecido por</small>
              <h2>{producto.tienda}</h2>

              {producto.tiendaId ? (
                <Link
                  to={`/tiendas/${producto.tiendaId}`}
                  style={{
                    color: '#236b4b',
                    fontSize: '13px',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Visitar emprendimiento →
                </Link>
              ) : (
                <p>Emprendimiento de nuestra comunidad</p>
              )}
            </div>
          </div>

          {/* DESCRIPCIÓN */}
          <div className="bora-producto-descripcion">
            <h2>📝 Descripción del producto</h2>
            <p>
              {producto.descripcion ||
                'Este producto todavía no tiene una descripción.'}
            </p>
          </div>

          {/* DISPONIBILIDAD */}
          <div className="bora-producto-descripcion">
            <h2>📦 Disponibilidad</h2>

            <p>
              {disponibilidadProducto(producto, variante)}
            </p>
          </div>

          {/* CONTACTO */}
          <div className="bora-producto-acciones">

            {enlaceWhatsApp && (
              <a
                href={enlaceWhatsApp}
                target="_blank"
                rel="noopener noreferrer"
                className="bora-producto-contactar"
              >
                💬 Consultar por WhatsApp
              </a>
            )}

            {enlaceCorreo && (
              <a
                href={enlaceCorreo}
                className="bora-producto-contactar bora-producto-contactar-correo"
              >
                ✉️ Consultar por correo
              </a>
            )}

            {!enlaceWhatsApp && !enlaceCorreo && (
              <>
                <button
                  type="button"
                  className="bora-producto-contactar"
                  disabled
                  title="La tienda no tiene datos de contacto"
                >
                  💬 Contactar emprendimiento
                </button>

                <p>
                  Este emprendimiento todavía no tiene
                  información de contacto disponible.
                </p>
              </>
            )}

          </div>

        </div>
      </section>

      {/* PRODUCTOS RELACIONADOS */}
      {relacionados.length > 0 && (
        <section className="bora-producto-relacionados">

          <div className="bora-producto-relacionados-titulo">
            <h2>✨ También te puede interesar</h2>
            <Link to="/productos">
              Explorar más productos
            </Link>
          </div>

          <div className="bora-producto-relacionados-grid">
            {relacionados.map((item) => (
              <Link
                key={item.id}
                to={`/productos/${item.id}`}
                className="bora-producto-relacionado"
              >
                <img
                  src={item.imagen}
                  alt={item.nombre}
                  loading="lazy"
                  onError={(evento) => {
                    evento.currentTarget.onerror = null
                    evento.currentTarget.src =
                      IMAGEN_PRODUCTO_PREDETERMINADA
                  }}
                />

                <div>
                  <span>{item.categoria}</span>
                  <h3>{item.nombre}</h3>
                  <p>{item.tienda}</p>
                  <strong>
                    {formatoPrecio(item.precio)}
                  </strong>
                </div>
              </Link>
            ))}
          </div>

        </section>
      )}

    </main>
  )
}
