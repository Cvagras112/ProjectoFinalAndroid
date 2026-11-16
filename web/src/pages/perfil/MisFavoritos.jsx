import { useState } from 'react'
import { Link } from 'react-router-dom'
import { listaFavoritos, obtenerDetallesFavoritos } from '../../services/productos/favoritosService'
import { useDetallesLista } from '../../hooks/useListaPersonal'
import AccesoListaPersonal from '../../components/perfil/AccesoListaPersonal'
import ImagenPublica from '../../components/ImagenPublica'
import '../../components/perfil/ListasPersonales.css'
import './MisFavoritos.css'

export default function MisFavoritos() {
  const lista = useDetallesLista(listaFavoritos, obtenerDetallesFavoritos)
  const [fallo, setFallo] = useState(null)
  const { detalles: productosFavoritos, cargando } = lista
  const error = lista.error || (fallo?.sesion === lista.sesion ? fallo.mensaje : '')

  async function quitarFavorito(id) {
    setFallo(null)
    try {
      await listaFavoritos.quitar(id)
    } catch {
      if (listaFavoritos.leerEstado().sesion === lista.sesion) setFallo({ sesion: lista.sesion, mensaje: 'No pudimos quitar el favorito. Inténtalo nuevamente.' })
    }
  }

  if (['sin-sesion', 'sin-permiso'].includes(lista.estado)) return <AccesoListaPersonal estado={lista.estado} />

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
            {error}{' '}<button type="button" onClick={() => { setFallo(null); lista.reintentar() }}>Reintentar</button>
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
                className={`bora-favorito-card ${producto.estado !== 'publicado' ? 'bora-favorito-card--no-disponible' : ''}`}
                key={producto.id}
              >
                <div className="bora-favorito-imagen">
                  {producto.estado === 'publicado' ? <Link to={`/productos/${encodeURIComponent(producto.id)}`}><ImagenPublica src={producto.imagen} alt={producto.nombre} loading="lazy" /></Link> : producto.estado === 'eliminado' ? <span className="bora-lista-sin-imagen" aria-hidden="true">♡</span> : <ImagenPublica
                    src={producto.imagen}
                    alt={producto.nombre}
                    loading="lazy"
                  />}
                </div>

                <button
                  type="button"
                  className="bora-favorito-quitar"
                  onClick={() => quitarFavorito(producto.id)}
                  disabled={lista.pendientes.includes(producto.id)}
                  aria-label={`Quitar ${producto.nombre} de favoritos`}
                  title="Quitar de favoritos"
                >
                  {lista.pendientes.includes(producto.id) ? '…' : '♥'}
                </button>

                <div className="bora-favorito-info">
                  <span>{producto.categoria}</span>

                  {producto.estado === 'publicado' ? <Link
                    to={`/productos/${encodeURIComponent(producto.id)}`}
                    className="bora-favorito-nombre"
                  >
                    {producto.nombre}
                  </Link> : <h2 className="bora-favorito-nombre">{producto.nombre}</h2>}

                  <small>{producto.tienda}</small>

                  {producto.estado !== 'eliminado' && <strong>
                    {Number(producto.precio).toLocaleString('es-CL', {
                      style: 'currency',
                      currency: 'CLP',
                      maximumFractionDigits: 0,
                    })}
                  </strong>}

                  {producto.estado === 'publicado' ? <Link
                    to={`/productos/${encodeURIComponent(producto.id)}`}
                    className="bora-favorito-ver"
                  >
                    Ver producto →
                  </Link> : <p className="bora-lista-no-disponible">{producto.estado === 'eliminado' ? 'Este producto fue eliminado. Puedes quitarlo de tu lista.' : 'Producto no disponible. Puedes conservarlo o quitarlo de tu lista.'}</p>}
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}
