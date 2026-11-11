
import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { aprobarSolicitudEmprendedor } from '../../services/solicitudes/aprobacionService'
import './SolicitudesAdmin.css'

function formatearFecha(fecha) {
  if (!fecha) return 'Sin fecha'

  const valor =
    typeof fecha.toDate === 'function'
      ? fecha.toDate()
      : new Date(fecha)

  if (Number.isNaN(valor.getTime())) return 'Sin fecha'

  return valor.toLocaleString('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function SolicitudesAdmin() {
  const [solicitudes, setSolicitudes] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [seleccionada, setSeleccionada] = useState(null)
  const [procesando, setProcesando] = useState(null)

  async function cargarSolicitudes() {

    try {
      const resultado = await getDocs(
        collection(db, 'solicitudes_emprendedores')
      )

      const datos = resultado.docs.map((documento) => ({
        ...documento.data(),
        id: documento.id,
      }))

      datos.sort((a, b) => {
        const fechaA = a.fechaSolicitud?.toMillis?.() || 0
        const fechaB = b.fechaSolicitud?.toMillis?.() || 0
        return fechaB - fechaA
      })

      setSolicitudes(datos)
    } catch (err) {
      console.error('Error al cargar solicitudes:', err)
      setError(
        'No fue posible consultar las solicitudes de Firebase.'
      )
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    const temporizador = setTimeout(() => {
      cargarSolicitudes()
    }, 0)

    return () => clearTimeout(temporizador)
  }, [])

  async function aprobarSolicitud(solicitud) {
    if (solicitud.estado !== 'pendiente' || procesando) {
      return
    }

    const confirmado = window.confirm(
      `¿Estás seguro de que deseas aprobar la solicitud de ${solicitud.nombre}?`
    )

    if (!confirmado) return

    setProcesando(solicitud.id)
    setError('')
    setMensaje('')

    try {
      const resultado = await aprobarSolicitudEmprendedor(
        solicitud.id
      )

      await cargarSolicitudes()

      setSeleccionada((actual) =>
        actual?.id === solicitud.id
          ? { ...actual, estado: 'aprobada' }
          : actual
      )

      setMensaje(
        resultado.mensaje ||
          `La solicitud de ${solicitud.nombre} fue aprobada correctamente.`
      )
    } catch (err) {
      console.error('Error al aprobar solicitud:', err)
      setError(
        err.message ||
          'No fue posible aprobar la solicitud.'
      )
    } finally {
      setProcesando(null)
    }
  }

  const solicitudesFiltradas = solicitudes.filter(
    (solicitud) => {
      const contenido = [
        solicitud.nombre,
        solicitud.email,
        solicitud.emprendimiento,
        solicitud.categoria,
        solicitud.estado,
      ].join(' ')

      return normalizar(contenido).includes(
        normalizar(busqueda)
      )
    }
  )

  const pendientes = solicitudes.filter(
    (solicitud) => solicitud.estado === 'pendiente'
  ).length

  return (
    <section className="bora-solicitudes">
      <div className="bora-solicitudes-encabezado">
        <div>
          <h2>Solicitudes de emprendedores</h2>
          <p>
            Revisa las solicitudes enviadas por personas
            que desean formar parte de BORA.
          </p>
        </div>

        <button
          type="button"
          className="bora-solicitudes-actualizar"
          onClick={cargarSolicitudes}
          disabled={cargando || procesando !== null}
        >
          ↻ Actualizar
        </button>
      </div>

      <div className="bora-solicitudes-resumen">
        <div>
          <span>Total de solicitudes</span>
          <strong>{solicitudes.length}</strong>
        </div>

        <div>
          <span>Pendientes</span>
          <strong>{pendientes}</strong>
        </div>
      </div>

      {mensaje && (
        <p
          role="status"
          style={{
            background: '#e5f5eb',
            color: '#236b4b',
            padding: '14px',
            borderRadius: '10px',
            marginBottom: '18px',
          }}
        >
          ✓ {mensaje}
        </p>
      )}

      {error && (
        <p
          className="bora-solicitudes-error"
          role="alert"
        >
          {error}
        </p>
      )}

      <label
        className="bora-solicitudes-label"
        htmlFor="buscar-solicitudes"
      >
        Buscar solicitud
      </label>

      <input
        id="buscar-solicitudes"
        className="bora-solicitudes-buscar"
        type="search"
        placeholder="Buscar por nombre, correo, emprendimiento o categoría..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      {cargando ? (
        <p className="bora-solicitudes-vacio">
          Cargando solicitudes desde Firebase...
        </p>
      ) : solicitudesFiltradas.length === 0 ? (
        <p className="bora-solicitudes-vacio">
          No se encontraron solicitudes.
        </p>
      ) : (
        <div className="bora-solicitudes-tabla-contenedor">
          <table className="bora-solicitudes-tabla">
            <thead>
              <tr>
                <th>Solicitante</th>
                <th>Emprendimiento</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {solicitudesFiltradas.map((solicitud) => {
                const pendiente =
                  solicitud.estado === 'pendiente'

                const ocupado = procesando !== null

                return (
                  <tr key={solicitud.id}>
                    <td>
                      <strong>{solicitud.nombre}</strong>
                      <small>{solicitud.email}</small>
                    </td>

                    <td>
                      {solicitud.emprendimiento}
                    </td>

                    <td>
                      {formatearFecha(
                        solicitud.fechaSolicitud
                      )}
                    </td>

                    <td>
                      <span
                        className="bora-solicitudes-estado"
                        style={{
                          background:
                            solicitud.estado === 'aprobada'
                              ? '#e5f5eb'
                              : solicitud.estado === 'rechazada'
                                ? '#fce8e4'
                                : '#fff1d9',
                          color:
                            solicitud.estado === 'aprobada'
                              ? '#236b4b'
                              : solicitud.estado === 'rechazada'
                                ? '#a43d25'
                                : '#986013',
                        }}
                      >
                        {solicitud.estado || 'Sin estado'}
                      </span>
                    </td>

                    <td>
                      <div
                        style={{
                          display: 'flex',
                          gap: '8px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <button
                          type="button"
                          className="bora-solicitudes-ver"
                          onClick={() =>
                            setSeleccionada(solicitud)
                          }
                        >
                          Ver detalles
                        </button>

                        {pendiente && (
                          <>
                            <button
                              type="button"
                              className="bora-solicitudes-ver"
                              disabled={ocupado || cargando}
                              onClick={() =>
                                aprobarSolicitud(solicitud)
                              }
                            >
                              {procesando === solicitud.id
                                ? 'Procesando...'
                                : '✓ Aprobar'}
                            </button>

                            <button
                              type="button"
                              className="bora-solicitudes-ver"
                              style={{
                                background: '#c96d4e',
                                opacity: 0.6,
                                cursor: 'not-allowed',
                              }}
                              disabled
                              title="Pendiente de implementar rechazo seguro"
                            >
                              ✕ Rechazar
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {seleccionada && (
        <div
          className="bora-solicitudes-overlay"
          onClick={() => setSeleccionada(null)}
        >
          <div
            className="bora-solicitudes-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-solicitud"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bora-solicitudes-modal-header">
              <div>
                <span>✦ FICHA DE SOLICITUD</span>
                <h2 id="titulo-solicitud">
                  {seleccionada.nombre}
                </h2>
              </div>

              <button
                type="button"
                aria-label="Cerrar detalles"
                onClick={() =>
                  setSeleccionada(null)
                }
              >
                ✕
              </button>
            </div>

            <div className="bora-solicitudes-detalles">
              {[
                ['Nombre completo', seleccionada.nombre],
                ['Correo electrónico', seleccionada.email],
                ['Teléfono', seleccionada.telefono],
                [
                  'Emprendimiento',
                  seleccionada.emprendimiento,
                ],
                ['Categoría', seleccionada.categoria],
                ['Descripción', seleccionada.descripcion],
                ['Estado', seleccionada.estado],
                [
                  'Fecha de solicitud',
                  formatearFecha(
                    seleccionada.fechaSolicitud
                  ),
                ],
              ].map(([etiqueta, valor]) => (
                <div key={etiqueta}>
                  <span>{etiqueta}</span>
                  <strong>
                    {valor || 'No registrado'}
                  </strong>
                </div>
              ))}
            </div>

            <div className="bora-solicitudes-modal-footer">
              <button
                type="button"
                onClick={() =>
                  setSeleccionada(null)
                }
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default SolicitudesAdmin
