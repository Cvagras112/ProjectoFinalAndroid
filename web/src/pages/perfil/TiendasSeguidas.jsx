import { useState } from 'react'
import { Link } from 'react-router-dom'
import { listaSeguimientos, obtenerDetallesTiendasSeguidas } from '../../services/tiendas/seguimientoService'
import { useDetallesLista } from '../../hooks/useListaPersonal'
import AccesoListaPersonal from '../../components/perfil/AccesoListaPersonal'
import ImagenPublica from '../../components/ImagenPublica'
import '../../components/perfil/ListasPersonales.css'
import './MisFavoritos.css'

export default function TiendasSeguidas() {
  const lista = useDetallesLista(listaSeguimientos, obtenerDetallesTiendasSeguidas)
  const { detalles: tiendas, cargando } = lista
  const [fallo, setFallo] = useState(null)
  const error = lista.error || (fallo?.sesion === lista.sesion ? fallo.mensaje : '')
  const eliminando = lista.pendientes[0] || ''

  async function quitarSeguimiento(tiendaId) {
    setFallo(null)
    try {
      await listaSeguimientos.quitar(tiendaId)
    } catch {
      if (listaSeguimientos.leerEstado().sesion === lista.sesion) setFallo({ sesion: lista.sesion, mensaje: 'No pudimos dejar de seguir la tienda. Inténtalo nuevamente.' })
    }
  }

  if (['sin-sesion', 'sin-permiso'].includes(lista.estado)) return <AccesoListaPersonal estado={lista.estado} />

  return (
    <main className="bora-favoritos">
      <div className="bora-favoritos-contenedor">
        <div className="bora-favoritos-encabezado">
          <div>
            <span className="bora-favoritos-etiqueta">
              TUS EMPRENDIMIENTOS PREFERIDOS
            </span>
            <h1>Tiendas seguidas</h1>
            <p>
              Encuentra los emprendimientos que sigues en BORA.
            </p>
          </div>

          <div className="bora-favoritos-contador">
            <strong>{tiendas.length}</strong>
            <span>Tiendas seguidas</span>
          </div>
        </div>

        {error && (
          <p className="bora-favoritos-error" role="alert">
            {error}{' '}<button type="button" onClick={() => { setFallo(null); lista.reintentar() }}>Reintentar</button>
          </p>
        )}

        {cargando ? (
          <p className="bora-favoritos-cargando">
            Cargando tus tiendas seguidas…
          </p>
        ) : error ? null : tiendas.length === 0 ? (
          <section className="bora-favoritos-vacio">
            <div className="bora-favoritos-corazon">♡</div>
            <h2>Aún no sigues ninguna tienda</h2>
            <p>
              Explora los emprendimientos de BORA y sigue
              tus tiendas favoritas para encontrarlas aquí.
            </p>
            <Link to="/tiendas">
              Explorar emprendimientos
            </Link>
          </section>
        ) : (
          <div className="bora-favoritos-grid">
            {tiendas.map(tienda => (
              <article className={`bora-favorito-card ${tienda.estado !== 'publicada' ? 'bora-favorito-card--no-disponible' : ''}`} key={tienda.id}>
                <div className="bora-favorito-imagen">
                  {tienda.imagen ? (
                    <ImagenPublica
                      src={tienda.imagen}
                      alt={`Logo de ${tienda.nombre}`}
                      loading="lazy"
                    />
                  ) : (
                    <span
                      style={{
                        display: 'grid',
                        placeItems: 'center',
                        height: '100%',
                        fontSize: 60,
                        color: '#236b4b'
                      }}
                    >
                      {tienda.nombre?.charAt(0).toUpperCase() || '♡'}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  className="bora-favorito-quitar"
                  onClick={() => quitarSeguimiento(tienda.id)}
                  disabled={Boolean(eliminando)}
                  aria-label={`Dejar de seguir ${tienda.nombre}`}
                  title="Dejar de seguir"
                >
                  {eliminando === tienda.id ? '…' : '×'}
                </button>

                <div className="bora-favorito-info">
                  <span>
                    {tienda.categoria || 'Emprendimiento'}
                  </span>

                  {tienda.estado === 'publicada' ? <Link
                    className="bora-favorito-nombre"
                    to={`/tiendas/${encodeURIComponent(tienda.id)}`}
                  >
                    {tienda.nombre}
                  </Link> : <h2 className="bora-favorito-nombre">{tienda.nombre}</h2>}

                  {tienda.sector && (
                    <small>{tienda.sector}</small>
                  )}

                  {tienda.estado === 'publicada' ? <Link
                    className="bora-favorito-ver"
                    to={`/tiendas/${encodeURIComponent(tienda.id)}`}
                  >
                    Ver tienda
                  </Link> : <p className="bora-lista-no-disponible">Tienda no disponible. Puedes dejar de seguirla.</p>}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
