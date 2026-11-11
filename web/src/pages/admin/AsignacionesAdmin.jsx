import { useState } from 'react'
import { doc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'

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

  const disponibles = emprendedoras.filter(item =>
    item.estado === 'Activa' &&
    !asignaciones.some(a => a.emprendedoraId === item.id)
  )

  const activas = asociaciones.filter(item => item.estado === 'Activa')

  const guardar = async (e) => {
    e.preventDefault()
    if (guardando) return

    if (!disponibles.some(item => item.id === emprendedoraId) ||
        !activas.some(item => item.id === asociacionId)) {
      setError('Selecciona una emprendedora y una asociación disponibles.')
      return
    }

    setGuardando(true)
    setError('')

    try {
      const datos = { emprendedoraId, asociacionId }

      await setDoc(doc(db, 'asignaciones', emprendedoraId), datos)

      setAsignaciones(anteriores => [
        ...anteriores.filter(item => item.emprendedoraId !== emprendedoraId),
        { id: emprendedoraId, ...datos }
      ])

      setEmprendedoraId('')
      setAsociacionId('')
    } catch (err) {
      console.error(err)
      setError('No se pudo guardar: ' + err.message)
    } finally {
      setGuardando(false)
    }
  }

  const quitar = async (item) => {
    if (!window.confirm('¿Desvincular esta emprendedora?')) return

    try {
      await deleteDoc(doc(db, 'asignaciones', item.id))
      setAsignaciones(anteriores =>
        anteriores.filter(actual => actual.id !== item.id)
      )
    } catch (err) {
      console.error(err)
      window.alert('No se pudo desvincular: ' + err.message)
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
        <h3>Asignar emprendedora</h3>
        <form className="bora-formulario-campos" onSubmit={guardar}>
          <div className="bora-campo">
            <label htmlFor="asig-emprendedora">Emprendedora</label>
            <select
              id="asig-emprendedora"
              value={emprendedoraId}
              onChange={e => setEmprendedoraId(e.target.value)}
              required
            >
              <option value="">Seleccionar emprendedora</option>
              {disponibles.map(item => (
                <option key={item.id} value={item.id}>
                  {item.nombre} - {item.emprendimiento}
                </option>
              ))}
            </select>
          </div>

          <div className="bora-campo">
            <label htmlFor="asig-asociacion">Asociación</label>
            <select
              id="asig-asociacion"
              value={asociacionId}
              onChange={e => setAsociacionId(e.target.value)}
              required
            >
              <option value="">Seleccionar asociación</option>
              {activas.map(item => (
                <option key={item.id} value={item.id}>
                  {item.nombre}
                </option>
              ))}
            </select>
          </div>

          {error && <p role="alert" style={{ color: '#b42318' }}>{error}</p>}

          <button type="submit" disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar asignación'}
          </button>
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
                    <button
                      type="button"
                      className="bora-boton-eliminar"
                      onClick={() => quitar(item)}
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