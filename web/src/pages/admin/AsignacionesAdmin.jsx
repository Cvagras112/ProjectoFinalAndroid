
import { useState } from 'react'

export default function AsignacionesAdmin({
  emprendedoras,
  setEmprendedoras,
  asociaciones,
  asignaciones,
  setAsignaciones
}) {
  const [emprendedoraId, setEmprendedoraId] = useState('')
  const [asociacionId, setAsociacionId] = useState('')

  // Solo permitir nuevas asignaciones a registros activos.
  const emprendedorasDisponibles = emprendedoras.filter(
    (emprendedora) =>
      emprendedora.estado === 'Activa' &&
      !asignaciones.some(
        (asignacion) =>
          asignacion.emprendedoraId === emprendedora.id
      )
  )

  const asociacionesActivas = asociaciones.filter(
    (asociacion) => asociacion.estado === 'Activa'
  )

  // Registrar una nueva asignación.
  const guardarAsignacion = (e) => {
    e.preventDefault()

    const emprendedora = emprendedorasDisponibles.find(
      (item) => item.id === emprendedoraId
    )

    const asociacion = asociacionesActivas.find(
      (item) => item.id === asociacionId
    )

    if (!emprendedora) {
      window.alert(
        'Selecciona una emprendedora activa que no tenga una asociación asignada.'
      )
      return
    }

    if (!asociacion) {
      window.alert('Selecciona una asociación activa.')
      return
    }

    const asignacionExistente = asignaciones.some(
      (item) => item.emprendedoraId === emprendedoraId
    )

    if (asignacionExistente) {
      window.alert(
        'Esta emprendedora ya tiene una asociación asignada.'
      )
      return
    }

    setAsignaciones((anteriores) => [
      ...anteriores,
      {
        id: crypto.randomUUID(),
        emprendedoraId,
        asociacionId
      }
    ])

    setEmprendedoras((anteriores) =>
      anteriores.map((item) =>
        item.id === emprendedoraId
          ? {
              ...item,
              asociacion: asociacion.nombre
            }
          : item
      )
    )

    setEmprendedoraId('')
    setAsociacionId('')
  }

  // Desvincular una emprendedora de su asociación.
  const quitarAsignacion = (asignacion) => {
    const emprendedora = emprendedoras.find(
      (item) => item.id === asignacion.emprendedoraId
    )

    const confirmar = window.confirm(
      `¿Deseas desvincular a ${
        emprendedora?.nombre || 'esta emprendedora'
      } de su asociación?`
    )

    if (!confirmar) return

    setAsignaciones((anteriores) =>
      anteriores.filter(
        (item) => item.id !== asignacion.id
      )
    )

    setEmprendedoras((anteriores) =>
      anteriores.map((item) =>
        item.id === asignacion.emprendedoraId
          ? {
              ...item,
              asociacion: null
            }
          : item
      )
    )
  }

  return (
    <div className="bora-seccion-admin">

      {/* ENCABEZADO */}
      <div className="bora-emprendedoras-header">
        <div>
          <h2>Gestión de asignaciones</h2>
          <p>
            Vincula emprendedoras con las asociaciones de BORA.
          </p>
        </div>
      </div>

      {/* FORMULARIO */}
      <div className="bora-formulario">
        <h3>Asignar emprendedora a una asociación</h3>
        <p>
          Solo puedes seleccionar emprendedoras y asociaciones activas.
        </p>

        <form
          className="bora-formulario-campos"
          onSubmit={guardarAsignacion}
        >

          {/* EMPRENDEDORA */}
          <div className="bora-campo">
            <label htmlFor="asignacion-emprendedora">
              Emprendedora
            </label>

            <select
              id="asignacion-emprendedora"
              value={emprendedoraId}
              onChange={(e) => setEmprendedoraId(e.target.value)}
              required
            >
              <option value="">
                Seleccionar emprendedora
              </option>

              {emprendedorasDisponibles.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nombre} - {item.emprendimiento}
                </option>
              ))}
            </select>
          </div>

          {/* ASOCIACIÓN */}
          <div className="bora-campo">
            <label htmlFor="asignacion-asociacion">
              Asociación
            </label>

            <select
              id="asignacion-asociacion"
              value={asociacionId}
              onChange={(e) => setAsociacionId(e.target.value)}
              required
            >
              <option value="">
                Seleccionar asociación
              </option>

              {asociacionesActivas.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nombre}
                </option>
              ))}
            </select>
          </div>

          <button type="submit">
            Guardar asignación
          </button>

        </form>
      </div>

      {/* TABLA DE ASIGNACIONES */}
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
                <td colSpan={4}>
                  Todavía no hay asignaciones registradas.
                </td>
              </tr>
            ) : (
              asignaciones.map((asignacion) => {
                const emprendedora = emprendedoras.find(
                  (item) =>
                    item.id === asignacion.emprendedoraId
                )

                const asociacion = asociaciones.find(
                  (item) =>
                    item.id === asignacion.asociacionId
                )

                const registrosActivos =
                  emprendedora?.estado === 'Activa' &&
                  asociacion?.estado === 'Activa'

                return (
                  <tr key={asignacion.id}>

                    <td>
                      {emprendedora?.nombre ||
                        'Emprendedora no disponible'}
                    </td>

                    <td>
                      {asociacion?.nombre ||
                        'Asociación no disponible'}
                    </td>

                    <td>
                      {registrosActivos
                        ? 'Vigente'
                        : 'Revisar: registro inactivo o no disponible'}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="bora-boton-eliminar"
                        onClick={() =>
                          quitarAsignacion(asignacion)
                        }
                      >
                        Desvincular
                      </button>
                    </td>

                  </tr>
                )
              })
            )}
          </tbody>

        </table>
      </div>

    </div>
  )
}
