
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { productosDemo } from '../../data/productosDemo'
import './Emprendimientos.css'

// ==========================================
// BORA - EMPRENDIMIENTOS DE DEMOSTRACIÓN
// ==========================================

const emprendimientosDemo = [
  {
    id: 1,
    nombre: 'Taller Raíces',
    categoria: 'Artesanía y cerámica',
    descripcion:
      'Creamos piezas artesanales únicas, inspiradas en nuestras tradiciones y en el trabajo hecho a mano.',
    imagen:
      'https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?w=900&auto=format&fit=crop&q=85',
  },
  {
    id: 2,
    nombre: 'Manos Creativas',
    categoria: 'Accesorios y papelería',
    descripcion:
      'Diseños originales y productos elaborados con creatividad, dedicación y mucho cariño.',
    imagen:
      'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=900&auto=format&fit=crop&q=85',
  },
  {
    id: 3,
    nombre: 'Casa Natural',
    categoria: 'Decoración',
    descripcion:
      'Detalles decorativos que aportan calidez, naturaleza y personalidad a cada espacio.',
    imagen:
      'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=900&auto=format&fit=crop&q=85',
  },
  {
    id: 4,
    nombre: 'Tejidos del Sur',
    categoria: 'Textiles y tejidos',
    descripcion:
      'Tejidos y accesorios artesanales que reflejan tradición, identidad y dedicación.',
    imagen:
      'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=900&auto=format&fit=crop&q=85',
  },
  {
    id: 5,
    nombre: 'Esencia Natural',
    categoria: 'Cuidado personal',
    descripcion:
      'Productos artesanales pensados para acompañar tus momentos de bienestar.',
    imagen:
      'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=900&auto=format&fit=crop&q=85',
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

function contarProductos(nombreTienda) {
  return productosDemo.filter(
    (producto) =>
      normalizarTexto(producto.tienda) ===
      normalizarTexto(nombreTienda)
  ).length
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export default function Emprendimientos() {
  const [busqueda, setBusqueda] = useState('')

  const emprendimientosFiltrados = emprendimientosDemo.filter(
    (emprendimiento) => {
      const contenido = normalizarTexto(
        `${emprendimiento.nombre} ${emprendimiento.categoria} ${emprendimiento.descripcion}`
      )

      return contenido.includes(normalizarTexto(busqueda))
    }
  )

  return (
    <main className="bora-emprendimientos">

      {/* ENCABEZADO */}
      <section className="bora-emprendimientos-hero">
        <span>CONOCE A NUESTRA COMUNIDAD</span>

        <h1>Descubre emprendimientos</h1>

        <p>
          Conoce las historias, el talento y los productos
          de las emprendedoras que forman parte de BORA.
        </p>
      </section>

      {/* CONTENIDO */}
      <section className="bora-emprendimientos-contenido">

        <div className="bora-emprendimientos-superior">
          <div>
            <span className="bora-emprendimientos-subtitulo">
              TALENTO LOCAL
            </span>

            <h2>Emprendimientos de nuestra comunidad</h2>

            <p>
              Explora tiendas y descubre productos
              creados con dedicación.
            </p>
          </div>

          {/* BUSCADOR */}
          <div className="bora-emprendimientos-buscador">
            <input
              type="search"
              placeholder="Buscar emprendimientos..."
              aria-label="Buscar emprendimientos"
              value={busqueda}
              onChange={(evento) =>
                setBusqueda(evento.target.value)
              }
            />
          </div>
        </div>

        {/* CONTADOR */}
        <p className="bora-emprendimientos-contador">
          {emprendimientosFiltrados.length}{' '}
          {emprendimientosFiltrados.length === 1
            ? 'emprendimiento encontrado'
            : 'emprendimientos encontrados'}
        </p>

        {/* TARJETAS COMPLETAMENTE SELECCIONABLES */}
        <div className="bora-emprendimientos-grid">

          {emprendimientosFiltrados.map((emprendimiento) => (
            <Link
              key={emprendimiento.id}
              to={`/tiendas/${crearSlug(emprendimiento.nombre)}`}
              className="bora-emprendimiento-tarjeta"
              aria-label={`Visitar tienda ${emprendimiento.nombre}`}
            >

              {/* IMAGEN */}
              <div className="bora-emprendimiento-imagen">
                <img
                  src={emprendimiento.imagen}
                  alt={emprendimiento.nombre}
                  loading="lazy"
                />

                <span className="bora-emprendimiento-etiqueta">
                  Emprendimiento BORA
                </span>
              </div>

              {/* INFORMACIÓN */}
              <div className="bora-emprendimiento-info">

                <span className="bora-emprendimiento-categoria">
                  {emprendimiento.categoria}
                </span>

                <h3>{emprendimiento.nombre}</h3>

                <p className="bora-emprendimiento-descripcion">
                  {emprendimiento.descripcion}
                </p>

                {/* PIE DE TARJETA */}
                <div className="bora-emprendimiento-pie">
                  <span>
                    {contarProductos(emprendimiento.nombre)}{' '}
                    {contarProductos(emprendimiento.nombre) === 1
                      ? 'producto'
                      : 'productos'}
                  </span>

                  <span className="bora-emprendimiento-visitar">
                    Visitar tienda →
                  </span>
                </div>

              </div>

            </Link>
          ))}

        </div>

        {/* SIN RESULTADOS */}
        {emprendimientosFiltrados.length === 0 && (
          <div className="bora-emprendimientos-vacio">
            <h3>No encontramos emprendimientos</h3>

            <p>
              Prueba con otro nombre o categoría.
            </p>

            <button
              type="button"
              onClick={() => setBusqueda('')}
            >
              Limpiar búsqueda
            </button>
          </div>
        )}

      </section>
    </main>
  )
}
