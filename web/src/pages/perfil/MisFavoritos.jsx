
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../../firebase/config'
import { obtenerProductos } from '../../services/productos/productoService'
import './MisFavoritos.css'

const CLAVE_FAVORITOS = 'bora-favoritos'

function leerFavoritos() {
  try {
    const datos = JSON.parse(
      localStorage.getItem(CLAVE_FAVORITOS) || '[]'
    )
    return Array.isArray(datos) ? datos.map(String) : []
  } catch {
    return []
  }
}

export default function MisFavoritos() {
  const navigate = useNavigate()
  const [productos, setProductos] = useState([])
  const [favoritos, setFavoritos] = useState(leerFavoritos)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const sincronizar = useCallback(() => {
    setFavoritos(leerFavoritos())
  }, [])

  useEffect(() => {
    window.addEventListener('storage', sincronizar)
    window.addEventListener('bora:favoritos', sincronizar)

    return () => {
      window.removeEventListener('storage', sincronizar)
      window.removeEventListener('bora:favoritos', sincronizar)
    }
  }, [sincronizar])

  useEffect(() => {
    let cancelar = false

    const desuscribir = onAuthStateChanged(auth, async (usuario) => {
      if (!usuario) {
        navigate('/login', { replace: true })
        return
      }

      setCargando(true)
      setError('')

      try {
        const perfilRef = doc(db, 'usuarios', usuario.uid)
        const perfilDoc = await getDoc(perfilRef)

        if (!perfilDoc.exists()) {
          throw new Error('No encontramos tu perfil.')
        }

        const rol = String(
          perfilDoc.data().rol || perfilDoc.data().Rol || ''
        ).trim().toLowerCase()

        if (rol !== 'comprador') {
          navigate('/', { replace: true })
          return
        }

        const resultado = await obtenerProductos()

        if (!cancelar) {
          setProductos(resultado)
          setFavoritos(leerFavoritos())
        }
      } catch (err) {
        if (!cancelar) {
          setError(err.message || 'No pudimos cargar tus favoritos.')
        }
      } finally {
        if (!cancelar) setCargando(false)
      }
    })

    return () => {
      cancelar = true
      desuscribir()
    }
  }, [navigate])

  function quitarFavorito(id) {
    const actualizados = leerFavoritos().filter(
      (favorito) => favorito !== String(id)
    )

    localStorage.setItem(
      CLAVE_FAVORITOS,
      JSON.stringify(actualizados)
    )

    setFavoritos(actualizados)
    window.dispatchEvent(new Event('bora:favoritos'))
  }

  const productosFavoritos = productos.filter((producto) =>
    favoritos.includes(String(producto.id))
  )

  if (cargando) {
    return (
      <main className="bora-favoritos">
        <div className="bora-favoritos-cargando">
          Cargando tus productos favoritos...
        </div>
      </main>
    )
  }

  return (
    <main className="bora-favoritos">
      <div className="bora-favoritos-contenedor">
        <div className="bora-favoritos-encabezado">
          <div>
            <span className="bora-favoritos-etiqueta">
              TU SELECCIÓN PERSONAL
            </span>
            <h1>Mis favoritos <span>♥</span></h1>
            <p>
              Guarda los productos que te gustan y vuelve a
              encontrarlos cuando quieras.
            </p>
          </div>

          <div className="bora-favoritos-contador">
            <strong>{productosFavoritos.length}</strong>
            <span>
              {productosFavoritos.length === 1
                ? 'producto guardado'
                : 'productos guardados'}
            </span>
          </div>
        </div>

        {error && (
          <div className="bora-favoritos-error" role="alert">
            {error}
          </div>
        )}

        {!error && productosFavoritos.length === 0 && (
          <section className="bora-favoritos-vacio">
            <div className="bora-favoritos-corazon">♡</div>
            <h2>Aún no tienes favoritos</h2>
            <p>
              Explora los productos de nuestros emprendedores
              y guarda los que más te gusten.
            </p>
            <Link to="/productos">
              Explorar productos
            </Link>
          </section>
        )}

        {productosFavoritos.length > 0 && (
          <section className="bora-favoritos-grid">
            {productosFavoritos.map((producto) => (
              <article
                className="bora-favorito-card"
                key={producto.id}
              >
                <Link
                  to={`/productos/${producto.id}`}
                  className="bora-favorito-imagen"
                >
                  <img
                    src={producto.imagen}
                    alt={producto.nombre}
                    loading="lazy"
                  />
                </Link>

                <button
                  type="button"
                  className="bora-favorito-quitar"
                  onClick={() => quitarFavorito(producto.id)}
                  aria-label={`Quitar ${producto.nombre} de favoritos`}
                  title="Quitar de favoritos"
                >
                  ♥
                </button>

                <div className="bora-favorito-info">
                  <span>{producto.categoria}</span>

                  <Link
                    to={`/productos/${producto.id}`}
                    className="bora-favorito-nombre"
                  >
                    {producto.nombre}
                  </Link>

                  <small>{producto.tienda}</small>

                  <strong>
                    {Number(producto.precio).toLocaleString('es-CL', {
                      style: 'currency',
                      currency: 'CLP',
                      maximumFractionDigits: 0,
                    })}
                  </strong>

                  <Link
                    to={`/productos/${producto.id}`}
                    className="bora-favorito-ver"
                  >
                    Ver producto →
                  </Link>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}
