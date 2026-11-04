
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

export default function ProductoDetalle() {
  const { id } = useParams()

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
      setRelacionados([])

      try {
        const productoFirebase = await obtenerProductoPorId(id)

        if (!activo) return

        if (!productoFirebase) {
          setCargando(false)
          return
        }

        setProducto(productoFirebase)

        // Los relacionados son complementarios:
        // si fallan, igualmente mostramos el producto.
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
              src={producto.imagen}
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
            {formatoPrecio(producto.precio)}
          </strong>

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
            <p>{producto.descripcion}</p>
          </div>

          {/* DISPONIBILIDAD */}
          <div className="bora-producto-descripcion">
            <h2>📦 Disponibilidad</h2>

            <p>
              {producto.stock > 0
                ? `Disponible · ${producto.stock} unidades en stock`
                : 'Sin existencias por el momento'}
            </p>
          </div>

          {/* CONTACTO */}
          <div className="bora-producto-acciones">
            <button
              type="button"
              className="bora-producto-contactar"
              disabled
              title="Función disponible próximamente"
            >
              💬 Contactar emprendimiento
            </button>

            <p>
              Próximamente podrás contactar directamente
              a los emprendimientos de BORA.
            </p>
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
