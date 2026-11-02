
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { productosDemo } from '../../data/productosDemo'
import './TiendaDetalle.css'

// ==========================================
// BORA - DATOS TEMPORALES DE EMPRENDIMIENTOS
// Más adelante se conectarán con Firestore.
// ==========================================

const tiendasDemo = [
  {
    nombre: 'Taller Raíces',
    categoria: 'Artesanía y cerámica',
    descripcion:
      'Piezas artesanales elaboradas con dedicación, creatividad y amor por nuestras tradiciones.',
    portada:
      'https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?w=1400&auto=format&fit=crop&q=85',
  },
  {
    nombre: 'Manos Creativas',
    categoria: 'Accesorios y papelería',
    descripcion:
      'Productos originales, llenos de creatividad y pequeños detalles que hacen la diferencia.',
    portada:
      'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=1400&auto=format&fit=crop&q=85',
  },
  {
    nombre: 'Casa Natural',
    categoria: 'Decoración',
    descripcion:
      'Objetos decorativos para transformar tus espacios en lugares cálidos y acogedores.',
    portada:
      'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1400&auto=format&fit=crop&q=85',
  },
  {
    nombre: 'Tejidos del Sur',
    categoria: 'Textiles y tejidos',
    descripcion:
      'Tejidos artesanales que combinan tradición, identidad y diseños para cada ocasión.',
    portada:
      'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1400&auto=format&fit=crop&q=85',
  },
  {
    nombre: 'Esencia Natural',
    categoria: 'Cuidado personal',
    descripcion:
      'Productos artesanales inspirados en la naturaleza y en los momentos de bienestar.',
    portada:
      'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=1400&auto=format&fit=crop&q=85',
  },
]

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

function normalizarTexto(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function crearSlug(texto) {
  return normalizarTexto(texto)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function formatearPrecio(precio) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(Number(precio) || 0)
}

function obtenerTiendasSeguidas() {
  try {
    const datos = JSON.parse(
      localStorage.getItem('bora-tiendas-seguidas') || '[]'
    )

    return Array.isArray(datos) ? datos : []
  } catch {
    return []
  }
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export default function TiendaDetalle() {
  const { slug } = useParams()

  const [busqueda, setBusqueda] = useState('')
  const [mensajeCompartir, setMensajeCompartir] = useState('')

  const [tiendasSeguidas, setTiendasSeguidas] = useState(
    obtenerTiendasSeguidas
  )

  // Identificar la tienda desde la URL.
  const tienda = tiendasDemo.find(
    (item) => crearSlug(item.nombre) === slug
  )

  // Verificar si el comprador sigue esta tienda.
  const siguiendo = tiendasSeguidas.includes(slug)

  // Mostrar únicamente productos de esta tienda.
  const productosTienda = tienda
    ? productosDemo.filter(
        (producto) =>
          normalizarTexto(producto.tienda) ===
          normalizarTexto(tienda.nombre)
      )
    : []

  // Buscar solamente dentro de esta tienda.
  const productosFiltrados = productosTienda.filter((producto) =>
    normalizarTexto(
      `${producto.nombre} ${producto.categoria} ${producto.descripcion}`
    ).includes(normalizarTexto(busqueda))
  )

  // ==========================================
  // SEGUIR / DEJAR DE SEGUIR
  // ==========================================

  function alternarSeguimiento() {
    const nuevasTiendas = siguiendo
      ? tiendasSeguidas.filter((item) => item !== slug)
      : [...new Set([...tiendasSeguidas, slug])]

    setTiendasSeguidas(nuevasTiendas)

    localStorage.setItem(
      'bora-tiendas-seguidas',
      JSON.stringify(nuevasTiendas)
    )
  }

  // ==========================================
  // COMPARTIR TIENDA
  // ==========================================

  async function compartirTienda() {
    if (!tienda) return

    const enlace = window.location.href

    const datosCompartir = {
      title: `${tienda.nombre} | BORA`,
      text: `¡Conoce los productos de ${tienda.nombre} en BORA!`,
      url: enlace,
    }

    // Abrir menú de compartir del dispositivo.
    if (navigator.share) {
      try {
        await navigator.share(datosCompartir)
        setMensajeCompartir('')
        return
      } catch (error) {
        if (error.name === 'AbortError') return
      }
    }

    // Alternativa: copiar el enlace.
    try {
      await navigator.clipboard.writeText(enlace)
      setMensajeCompartir('¡Enlace copiado al portapapeles!')
    } catch {
      setMensajeCompartir(
        'No se pudo copiar el enlace automáticamente.'
      )
    }
  }

  // ==========================================
  // TIENDA NO ENCONTRADA
  // ==========================================

  if (!tienda) {
    return (
      <main className="bora-tienda-no-encontrada">
        <h1>No encontramos este emprendimiento</h1>

        <p>
          La tienda que buscas no está disponible.
        </p>

        <Link to="/tiendas">
          Volver a emprendimientos
        </Link>
      </main>
    )
  }

  // ==========================================
  // VISTA DE LA TIENDA
  // ==========================================

  return (
    <main className="bora-tienda-detalle">

      {/* PORTADA DEL EMPRENDIMIENTO */}
      <section className="bora-tienda-portada">
        <img
          src={tienda.portada}
          alt={`Portada de ${tienda.nombre}`}
        />

        <div className="bora-tienda-portada-overlay" />
      </section>

      {/* PERFIL DE LA EMPRENDEDORA */}
      <section className="bora-tienda-perfil">

        <div className="bora-tienda-avatar">
          {tienda.nombre.charAt(0)}
        </div>

        <div className="bora-tienda-identidad">
          <span className="bora-tienda-distintivo">
            EMPRENDIMIENTO BORA
          </span>

          <h1>{tienda.nombre}</h1>

          <p className="bora-tienda-categoria">
            {tienda.categoria}
          </p>

          <p className="bora-tienda-descripcion">
            {tienda.descripcion}
          </p>
        </div>

        {/* BOTONES DE SEGUIR Y COMPARTIR */}
        <div className="bora-tienda-acciones">

          <button
            type="button"
            className={`bora-tienda-seguir ${
              siguiendo ? 'activo' : ''
            }`}
            onClick={alternarSeguimiento}
            aria-pressed={siguiendo}
          >
            {siguiendo ? '✓ Siguiendo' : '+ Seguir tienda'}
          </button>

          <button
            type="button"
            className="bora-tienda-compartir"
            onClick={compartirTienda}
          >
            ↗ Compartir tienda
          </button>

          {mensajeCompartir && (
            <span
              className="bora-tienda-mensaje-compartir"
              role="status"
            >
              {mensajeCompartir}
            </span>
          )}

        </div>

        {/* CANTIDAD DE PRODUCTOS */}
        <div className="bora-tienda-resumen">
          <strong>{productosTienda.length}</strong>

          <span>
            {productosTienda.length === 1
              ? 'Producto publicado'
              : 'Productos publicados'}
          </span>
        </div>

      </section>

      {/* NAVEGACIÓN DE LA TIENDA */}
      <nav
        className="bora-tienda-navegacion"
        aria-label="Navegación de la tienda"
      >
        <a href="#productos-tienda">
          Productos
        </a>

        <Link to="/tiendas">
          Otros emprendimientos
        </Link>
      </nav>

      {/* CATÁLOGO EXCLUSIVO DE LA TIENDA */}
      <section
        className="bora-tienda-productos"
        id="productos-tienda"
      >

        <div className="bora-tienda-productos-encabezado">

          <div>
            <span className="bora-tienda-seccion-etiqueta">
              HECHO CON DEDICACIÓN
            </span>

            <h2>
              Productos de {tienda.nombre}
            </h2>

            <p>
              Descubre los productos creados por este
              emprendimiento.
            </p>
          </div>

          <input
            type="search"
            aria-label="Buscar productos de esta tienda"
            placeholder="Buscar en esta tienda..."
            value={busqueda}
            onChange={(evento) =>
              setBusqueda(evento.target.value)
            }
          />

        </div>

        <p className="bora-tienda-resultados">
          {productosFiltrados.length}{' '}
          {productosFiltrados.length === 1
            ? 'producto encontrado'
            : 'productos encontrados'}
        </p>

        {/* TARJETAS DE PRODUCTOS */}
        <div className="bora-tienda-productos-grid">

          {productosFiltrados.map((producto) => (
            <Link
              key={producto.id}
              to={`/productos/${producto.id}`}
              className="bora-tienda-producto-card"
            >

              <div className="bora-tienda-producto-imagen">
                <img
                  src={producto.imagen}
                  alt={producto.nombre}
                  loading="lazy"
                />
              </div>

              <div className="bora-tienda-producto-info">

                <span>
                  {producto.categoria}
                </span>

                <h3>
                  {producto.nombre}
                </h3>

                <strong>
                  {formatearPrecio(producto.precio)}
                </strong>

                <span className="bora-tienda-ver-producto">
                  Ver producto →
                </span>

              </div>

            </Link>
          ))}

        </div>

        {/* SIN PRODUCTOS */}
        {productosFiltrados.length === 0 && (
          <div className="bora-tienda-vacio">

            <h3>
              No hay productos para mostrar
            </h3>

            <p>
              Prueba otra búsqueda o revisa más adelante.
            </p>

            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
              >
                Limpiar búsqueda
              </button>
            )}

          </div>
        )}

      </section>

    </main>
  )
}
