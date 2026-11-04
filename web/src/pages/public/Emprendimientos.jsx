
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../firebase/config'
import './Emprendimientos.css'

// Imagen predeterminada para tiendas sin fotografía
const IMAGEN_PREDETERMINADA =
  'https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?w=900&auto=format&fit=crop&q=85'

function normalizarTexto(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export default function Emprendimientos() {
  const [busqueda, setBusqueda] = useState('')
  const [emprendimientos, setEmprendimientos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let activo = true

    async function cargarEmprendimientos() {
      try {
        setCargando(true)
        setError('')

        const resultado = await getDocs(collection(db, 'tiendas'))

        const tiendas = resultado.docs
          .map((documento) => ({
            id: documento.id,
            ...documento.data(),
          }))
          .filter((tienda) => tienda.activo === true)

        if (activo) {
          setEmprendimientos(tiendas)
        }
      } catch (errorFirebase) {
        console.error(
          'Error al obtener emprendimientos:',
          errorFirebase
        )

        if (activo) {
          setError(
            'No pudimos cargar los emprendimientos. Inténtalo nuevamente.'
          )
        }
      } finally {
        if (activo) {
          setCargando(false)
        }
      }
    }

    cargarEmprendimientos()

    return () => {
      activo = false
    }
  }, [])

  const emprendimientosFiltrados = emprendimientos.filter(
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

        {/* CARGANDO */}
        {cargando && (
          <div className="bora-emprendimientos-vacio">
            <h3>🌿 Cargando emprendimientos...</h3>
            <p>Estamos buscando las tiendas de nuestra comunidad.</p>
          </div>
        )}

        {/* ERROR */}
        {!cargando && error && (
          <div className="bora-emprendimientos-vacio" role="alert">
            <h3>⚠️ No pudimos cargar las tiendas</h3>
            <p>{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
            >
              Reintentar
            </button>
          </div>
        )}

        {/* TIENDAS */}
        {!cargando && !error && (
          <>
            <p className="bora-emprendimientos-contador">
              {emprendimientosFiltrados.length}{' '}
              {emprendimientosFiltrados.length === 1
                ? 'emprendimiento encontrado'
                : 'emprendimientos encontrados'}
            </p>

            <div className="bora-emprendimientos-grid">
              {emprendimientosFiltrados.map((emprendimiento) => (
                <Link
                  key={emprendimiento.id}
                  to={`/tiendas/${emprendimiento.id}`}
                  className="bora-emprendimiento-tarjeta"
                  aria-label={`Visitar tienda ${emprendimiento.nombre}`}
                >
                  {/* IMAGEN */}
                  <div className="bora-emprendimiento-imagen">
                    <img
                      src={
                        emprendimiento.imagen?.trim()
                          ? emprendimiento.imagen
                          : IMAGEN_PREDETERMINADA
                      }
                      alt={emprendimiento.nombre}
                      loading="lazy"
                      onError={(evento) => {
                        evento.currentTarget.onerror = null
                        evento.currentTarget.src =
                          IMAGEN_PREDETERMINADA
                      }}
                    />

                    <span className="bora-emprendimiento-etiqueta">
                      ✨ Emprendimiento BORA
                    </span>
                  </div>

                  {/* INFORMACIÓN */}
                  <div className="bora-emprendimiento-info">

                    <span className="bora-emprendimiento-categoria">
                      {emprendimiento.categoria || 'Artesanía'}
                    </span>

                    <h3>{emprendimiento.nombre}</h3>

                    <p className="bora-emprendimiento-descripcion">
                      {emprendimiento.descripcion ||
                        'Conoce este emprendimiento de nuestra comunidad.'}
                    </p>

                    <div className="bora-emprendimiento-pie">
                      <span>💚 Talento local</span>

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
                <h3>🔎 No encontramos emprendimientos</h3>

                <p>
                  {busqueda
                    ? 'Prueba con otro nombre o categoría.'
                    : 'Todavía no hay tiendas activas registradas.'}
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
          </>
        )}

      </section>
    </main>
  )
}
