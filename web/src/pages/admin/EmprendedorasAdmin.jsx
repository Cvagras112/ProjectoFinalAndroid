
import { useState } from 'react'

function EmprendedorasAdmin({
  emprendedoras,
  setEmprendedoras,
  asociaciones = [],
  asignaciones = []
}) {
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [mensajeValidacion, setMensajeValidacion] = useState('')
  const [emprendedoraEditando, setEmprendedoraEditando] = useState(null)
  const [busqueda, setBusqueda] = useState('')

  // Normalizar texto para buscar sin distinguir tildes.
  const normalizarTexto = (texto) =>
    String(texto || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('es')
      .trim()

  // Filtrar emprendedoras.
  const emprendedorasFiltradas = emprendedoras.filter((emprendedora) => {
    const textoBusqueda = normalizarTexto(busqueda)

    return (
      normalizarTexto(emprendedora.nombre).includes(textoBusqueda) ||
      normalizarTexto(emprendedora.correo).includes(textoBusqueda) ||
      normalizarTexto(emprendedora.emprendimiento).includes(textoBusqueda)
    )
  })

  // Obtener asociación mediante su identificador.
  const obtenerAsociacion = (emprendedoraId) => {
    const asignacion = asignaciones.find(
      (item) => item.emprendedoraId === emprendedoraId
    )

    if (!asignacion) return 'Sin asignar'

    const asociacion = asociaciones.find(
      (item) => item.id === asignacion.asociacionId
    )

    return asociacion?.nombre || 'Asociación no disponible'
  }

  // Activar o desactivar emprendedora.
  const cambiarEstado = (emprendedora) => {
    const nuevoEstado =
      emprendedora.estado === 'Inactiva' ? 'Activa' : 'Inactiva'

    const confirmar = window.confirm(
      `¿Deseas ${
        nuevoEstado === 'Activa' ? 'activar' : 'desactivar'
      } a ${emprendedora.nombre}?`
    )

    if (!confirmar) return

    setEmprendedoras((anteriores) =>
      anteriores.map((item) =>
        item.id === emprendedora.id
          ? { ...item, estado: nuevoEstado }
          : item
      )
    )

    setMensajeValidacion('')
  }

  // Editar emprendedora.
  const editarEmprendedora = (emprendedora) => {
    setEmprendedoraEditando(emprendedora)
    setMostrarFormulario(true)
    setMensajeValidacion('')

    requestAnimationFrame(() => {
      const formulario = document.getElementById(
        'formulario-emprendedora'
      )

      if (!formulario) return

      formulario.elements.namedItem('nombre').value =
        emprendedora.nombre

      formulario.elements.namedItem('correo').value =
        emprendedora.correo

      formulario.elements.namedItem('telefono').value =
        emprendedora.telefono

      formulario.elements.namedItem('emprendimiento').value =
        emprendedora.emprendimiento
    })
  }

  // Mostrar u ocultar formulario.
  const alternarFormulario = () => {
    setMostrarFormulario((anterior) => !anterior)
    setEmprendedoraEditando(null)
    setMensajeValidacion('')

    const formulario = document.getElementById(
      'formulario-emprendedora'
    )

    if (formulario) {
      formulario.reset()
    }
  }

  // Registrar o actualizar emprendedora.
  const validarFormulario = (e) => {
    e.preventDefault()

    const formulario = e.currentTarget

    if (!formulario.reportValidity()) return

    const datos = new FormData(formulario)

    const datosEmprendedora = {
      nombre: String(datos.get('nombre') || '').trim(),
      correo: String(datos.get('correo') || '').trim(),
      telefono: String(datos.get('telefono') || '').trim(),
      emprendimiento: String(datos.get('emprendimiento') || '').trim()
    }

    if (emprendedoraEditando) {
      setEmprendedoras((anteriores) =>
        anteriores.map((emprendedora) =>
          emprendedora.id === emprendedoraEditando.id
            ? { ...emprendedora, ...datosEmprendedora }
            : emprendedora
        )
      )

      setEmprendedoraEditando(null)

      setMensajeValidacion(
        'Los datos de la emprendedora se actualizaron correctamente.'
      )
    } else {
      const nuevaEmprendedora = {
        id: crypto.randomUUID(),
        ...datosEmprendedora,
        asociacion: null,
        estado: 'Activa'
      }

      setEmprendedoras((anteriores) => [
        ...anteriores,
        nuevaEmprendedora
      ])

      setMensajeValidacion(
        'Emprendedora agregada a la lista temporal.'
      )
    }

    formulario.reset()
  }

  return (
    <section className="bora-card">

      {/* ENCABEZADO */}
      <div className="bora-emprendedoras-header">
        <div>
          <h2>Gestión de emprendedoras</h2>
          <p>
            Administra las emprendedoras registradas
            en la plataforma BORA.
          </p>
        </div>

        <button
          type="button"
          onClick={alternarFormulario}
        >
          {mostrarFormulario
            ? 'Cancelar'
            : '+ Nueva emprendedora'}
        </button>
      </div>

      {/* FORMULARIO */}
      {mostrarFormulario && (
        <div className="bora-formulario">

          <h3>
            {emprendedoraEditando
              ? 'Editar emprendedora'
              : 'Registrar nueva emprendedora'}
          </h3>

          <p>
            Completa la información para registrar
            una nueva emprendedora en BORA.
          </p>

          <form
            id="formulario-emprendedora"
            className="bora-formulario-campos"
            onSubmit={validarFormulario}
            onChange={() => setMensajeValidacion('')}
          >

            {/* NOMBRE */}
            <div className="bora-campo">
              <label htmlFor="nombre-emprendedora">
                Nombre de la emprendedora
              </label>

              <input
                type="text"
                id="nombre-emprendedora"
                name="nombre"
                placeholder="Ingresa el nombre completo"
                minLength={3}
                maxLength={100}
                autoComplete="name"
                required
              />
            </div>

            {/* CORREO */}
            <div className="bora-campo">
              <label htmlFor="correo-emprendedora">
                Correo electrónico
              </label>

              <input
                type="email"
                id="correo-emprendedora"
                name="correo"
                placeholder="ejemplo@correo.com"
                maxLength={150}
                autoComplete="email"
                required
              />
            </div>

            {/* TELÉFONO */}
            <div className="bora-campo">
              <label htmlFor="telefono-emprendedora">
                Teléfono de contacto
              </label>

              <input
                type="tel"
                id="telefono-emprendedora"
                name="telefono"
                placeholder="Ejemplo: 912345678"
                pattern="[0-9]{9}"
                title="Ingresa 9 dígitos, sin espacios ni +56"
                maxLength={9}
                autoComplete="tel"
                required
              />
            </div>

            {/* EMPRENDIMIENTO */}
            <div className="bora-campo">
              <label htmlFor="emprendimiento-nombre">
                Nombre del emprendimiento
              </label>

              <input
                type="text"
                id="emprendimiento-nombre"
                name="emprendimiento"
                placeholder="Ejemplo: Artesanías del Sur"
                minLength={3}
                maxLength={100}
                required
              />
            </div>

            {/* GUARDAR */}
            <button type="submit">
              {emprendedoraEditando
                ? 'Guardar cambios'
                : 'Registrar emprendedora'}
            </button>

            {mensajeValidacion && (
              <p
                className="bora-mensaje-validacion"
                role="status"
              >
                {mensajeValidacion}
              </p>
            )}

          </form>
        </div>
      )}

      {/* BUSCADOR */}
      <div className="bora-buscador">
        <label htmlFor="buscar-emprendedora">
          Buscar emprendedora
        </label>

        <input
          type="search"
          id="buscar-emprendedora"
          placeholder="Buscar por nombre, correo o emprendimiento..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {/* TABLA */}
      <div className="bora-tabla-contenedor">
        <table className="bora-tabla">

          <thead>
            <tr>
              <th>Nombre</th>
              <th>Asociación</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {emprendedorasFiltradas.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  {emprendedoras.length === 0
                    ? 'Todavía no hay emprendedoras registradas.'
                    : 'No se encontraron emprendedoras que coincidan con la búsqueda.'}
                </td>
              </tr>
            ) : (
              emprendedorasFiltradas.map((emprendedora) => (
                <tr key={emprendedora.id}>

                  <td>
                    <strong>{emprendedora.nombre}</strong>
                    <div>{emprendedora.emprendimiento}</div>
                  </td>

                  {/* ASOCIACIÓN ACTUALIZADA */}
                  <td>
                    {obtenerAsociacion(emprendedora.id)}
                  </td>

                  {/* ESTADO */}
                  <td>
                    {emprendedora.estado === 'Inactiva'
                      ? 'Inactiva'
                      : 'Activa'}
                  </td>

                  {/* ACCIONES */}
                  <td>
                    <div className="bora-acciones-tabla">

                      <button
                        type="button"
                        onClick={() => editarEmprendedora(emprendedora)}
                        className="bora-boton-editar"
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={() => cambiarEstado(emprendedora)}
                        className={
                          emprendedora.estado === 'Inactiva'
                            ? 'bora-boton-editar'
                            : 'bora-boton-eliminar'
                        }
                      >
                        {emprendedora.estado === 'Inactiva'
                          ? 'Activar'
                          : 'Desactivar'}
                      </button>

                    </div>
                  </td>

                </tr>
              ))
            )}
          </tbody>

        </table>
      </div>

    </section>
  )
}

export default EmprendedorasAdmin
