import { useRef, useState } from 'react'
import { guardarAsignacion, quitarAsignacion } from '../../repositories/admin/asignacionesRepository'

export default function AsignacionesAdmin({
  emprendedoras,
  asociaciones,
  asignaciones,
  setAsignaciones
}) {
  const [emprendedoraId, setEmprendedoraId] = useState('')
  const [asociacionId, setAsociacionId] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [reemplazando, setReemplazando] = useState(false)
  const operacionEnCurso = useRef(false)

  const disponibles = emprendedoras.filter(item =>
    item.estado === 'Activa' &&
    !asignaciones.some(a => a.emprendedoraId === item.id)
  )

  const activas = asociaciones.filter(item => item.estado === 'Activa')
  const asignadas = emprendedoras.filter(item => item.estado === 'Activa' &&
    asignaciones.some(a => a.emprendedoraId === item.id))
  const actual = asignaciones.find(item => item.emprendedoraId === emprendedoraId)
  const asociacionActual = asociaciones.find(item => item.id === actual?.asociacionId)
  const candidatas = reemplazando ? asignadas : disponibles
  const nuevasAsociaciones = activas.filter(item => !reemplazando || item.id !== actual?.asociacionId)

  const cerrarCambio = () => {
    setReemplazando(false)
    setEmprendedoraId('')
    setAsociacionId('')
    setError('')
  }
  const abrirCambio = (item = null) => {
    if (operacionEnCurso.current) return
    setReemplazando(true)
    setEmprendedoraId(item?.emprendedoraId || '')
    setAsociacionId('')
    setError('')
  }

  const guardar = async (e) => {
    e.preventDefault()
    if (operacionEnCurso.current) return

    if (!candidatas.some(item => item.id === emprendedoraId) ||
        !activas.some(item => item.id === asociacionId)) {
      setError('Selecciona una emprendedora y una asociación disponibles.')
      return
    }

    if (reemplazando) {
      if (!actual || actual.asociacionId === asociacionId) {
        setError('Selecciona una asociación diferente de la actual.')
        return
      }
      const nueva = asociaciones.find(item => item.id === asociacionId)
      if (!window.confirm(`¿Cambiar la asociación de ${asociacionActual?.nombre || actual.asociacionId} a ${nueva.nombre}?`)) return
    }

    operacionEnCurso.current = true
    setGuardando(true)
    setError('')

    try {
      const datos = { emprendedoraId, asociacionId }

      await guardarAsignacion(emprendedoraId, asociacionId)

      setAsignaciones(anteriores => [
        ...anteriores.filter(item => item.emprendedoraId !== emprendedoraId),
        { id: emprendedoraId, ...datos }
      ])

      setEmprendedoraId('')
      setAsociacionId('')
      setReemplazando(false)
    } catch (err) {
      console.error(err)
      setError('No se pudo guardar: ' + err.message)
    } finally {
      operacionEnCurso.current = false
      setGuardando(false)
    }
  }

  const quitar = async (item) => {
    if (operacionEnCurso.current) return
    if (!window.confirm('¿Desvincular esta emprendedora?')) return

    operacionEnCurso.current = true
    setGuardando(true)
    try {
      await quitarAsignacion(item.id)
      setAsignaciones(anteriores =>
        anteriores.filter(actual => actual.id !== item.id)
      )
      if (emprendedoraId === item.emprendedoraId) cerrarCambio()
    } catch (err) {
      console.error(err)
      window.alert('No se pudo desvincular: ' + err.message)
    } finally {
      operacionEnCurso.current = false
      setGuardando(false)
    }
  }

  return (
    <div className="bora-seccion-admin">
      <div className="bora-emprendedoras-header">
        <div>
          <h2>Gestión de asignaciones</h2>
          <p>Vincula emprendedoras con asociaciones de BORA.</p>
        </div>
      </div>

      <div className="bora-formulario">
        <h3>{reemplazando ? 'Cambiar asociación' : 'Asignar emprendedora'}</h3>
        {!reemplazando && (
          <button type="button" onClick={() => abrirCambio()} disabled={guardando || asignadas.length === 0}>
            Cambiar asociación
          </button>
        )}
        {!reemplazando && asignadas.length === 0 && <p>No hay emprendedoras activas con asignación para cambiar.</p>}
        <form className="bora-formulario-campos" onSubmit={guardar}>
          <div className="bora-campo">
            <label htmlFor="asig-emprendedora">Emprendedora</label>
            <select
              id="asig-emprendedora"
              value={emprendedoraId}
              onChange={e => { setEmprendedoraId(e.target.value); setAsociacionId('') }}
              disabled={guardando}
              required
            >
              <option value="">Seleccionar emprendedora</option>
              {candidatas.map(item => (
                <option key={item.id} value={item.id}>
                  {item.nombre} - {item.emprendimiento}
                </option>
              ))}
            </select>
          </div>

          {reemplazando && actual && (
            <p role="status">Asociación actual: <strong>{asociacionActual?.nombre || actual.asociacionId}</strong></p>
          )}

          <div className="bora-campo">
            <label htmlFor="asig-asociacion">{reemplazando ? 'Nueva asociación' : 'Asociación'}</label>
            <select
              id="asig-asociacion"
              value={asociacionId}
              onChange={e => setAsociacionId(e.target.value)}
              disabled={guardando}
              required
            >
              <option value="">Seleccionar asociación</option>
              {nuevasAsociaciones.map(item => (
                <option key={item.id} value={item.id}>
                  {item.nombre}
                </option>
              ))}
            </select>
          </div>

          {error && <p role="alert" style={{ color: '#b42318' }}>{error}</p>}

          <button type="submit" disabled={guardando}>
            {guardando ? 'Guardando...' : reemplazando ? 'Confirmar cambio' : 'Guardar asignación'}
          </button>
          {reemplazando && <button type="button" disabled={guardando} onClick={cerrarCambio}>Cancelar cambio</button>}
        </form>
      </div>

      <div className="bora-tabla-contenedor">
        <table className="bora-tabla">
          <thead>
            <tr>
              <th>Emprendedora</th>
              <th>Asociación</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {asignaciones.length === 0 ? (
              <tr>
                <td colSpan={4}>No hay asignaciones registradas.</td>
              </tr>
            ) : asignaciones.map(item => {
              const emprendedora = emprendedoras.find(
                e => e.id === item.emprendedoraId
              )
              const asociacion = asociaciones.find(
                a => a.id === item.asociacionId
              )
              const vigente =
                emprendedora?.estado === 'Activa' &&
                asociacion?.estado === 'Activa'

              return (
                <tr key={item.id}>
                  <td>{emprendedora?.nombre || 'No disponible'}</td>
                  <td>{asociacion?.nombre || 'No disponible'}</td>
                  <td>{vigente ? 'Vigente' : 'Revisar'}</td>
                  <td>
                    <button type="button" disabled={guardando || emprendedora?.estado !== 'Activa'} onClick={() => abrirCambio(item)}>
                      Cambiar asociación
                    </button>
                    <button
                      type="button"
                      className="bora-boton-eliminar"
                      onClick={() => quitar(item)}
                      disabled={guardando}
                    >
                      Desvincular
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
