import { useCallback, useEffect, useRef, useState } from 'react'
import { listarAdministradores } from '../../repositories/admin/administradoresRepository'
import { cambiarEstadoAdministrador, editarNombreAdministrador, crearAdministradorAuditado } from '../../services/admin/administradoresAuditadosService'
import { auth } from '../../firebase/config'
import { cambiarPasswordDeAdministrador } from '../../services/admin/administradoresService'

function AdministradoresAdmin() {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmarPassword, setConfirmarPassword] = useState('')
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  const [administradores, setAdministradores] = useState([])
  const [cargandoLista, setCargandoLista] = useState(true)
  const [errorLista, setErrorLista] = useState('')
  const [cambiandoUid, setCambiandoUid] = useState(null)
  const [editando, setEditando] = useState(null)
  const [nombreEdicion, setNombreEdicion] = useState('')
  const [destinoPassword, setDestinoPassword] = useState(null)
  const [nuevaPassword, setNuevaPassword] = useState('')
  const [confirmacionPassword, setConfirmacionPassword] = useState('')
  const [procesandoPassword, setProcesandoPassword] = useState(false)
  const [avisoPassword, setAvisoPassword] = useState(null)
  const operacionEnCurso = useRef(false)
  const solicitudLista = useRef(0)
  const permiteCambioPassword = import.meta.env.DEV &&
    import.meta.env.MODE === 'admin-emulator' &&
    import.meta.env.VITE_ADMIN_EMULATOR === 'true'

  const limpiarCambioPassword = () => {
    setNuevaPassword('')
    setConfirmacionPassword('')
    setDestinoPassword(null)
  }

  const abrirCambioPassword = (administrador) => {
    if (!permiteCambioPassword || operacionEnCurso.current || cargando ||
        !auth.currentUser || administrador.uid === auth.currentUser.uid) return
    limpiarCambioPassword()
    setEditando(null)
    setNombreEdicion('')
    setError('')
    setMensaje('')
    setAvisoPassword(null)
    setDestinoPassword(administrador)
  }

  const guardarPassword = async (e) => {
    e.preventDefault()
    if (operacionEnCurso.current || cargando) return
    setMensaje('')
    setError('')
    if (!permiteCambioPassword || !destinoPassword) return
    if (!auth.currentUser || destinoPassword.uid === auth.currentUser.uid) {
      limpiarCambioPassword()
      setError('Debes iniciar sesión y seleccionar otra cuenta administradora.')
      return
    }
    if (nuevaPassword.length < 8 || nuevaPassword.length > 128 || !nuevaPassword.trim()) {
      setError('La contraseña debe tener entre 8 y 128 caracteres y no estar vacía.')
      return
    }
    if (nuevaPassword !== confirmacionPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    operacionEnCurso.current = true
    setProcesandoPassword(true)
    setCambiandoUid(destinoPassword.uid)
    setAvisoPassword(null)
    try {
      const resultado = await cambiarPasswordDeAdministrador(destinoPassword.uid, nuevaPassword)
      if (resultado?.resultado === 'exito') {
        setMensaje('Contraseña actualizada correctamente.')
      } else {
        const operacionId = typeof resultado?.operacionId === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(resultado.operacionId) ? resultado.operacionId : null
        setAvisoPassword({ operacionId })
      }
    } catch (err) {
      const operacionId = typeof err?.operacionId === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(err.operacionId) ? err.operacionId : null
      if (err?.resultadoIncierto || ![
        'functions/unauthenticated', 'functions/failed-precondition',
        'functions/permission-denied', 'functions/invalid-argument', 'admin/emulator-required',
      ].includes(err?.code)) {
        setAvisoPassword({ operacionId })
      } else {
        const mensajesPassword = {
          'functions/unauthenticated': 'La sesión no es válida. Vuelve a iniciar sesión antes de continuar.',
          'functions/failed-precondition': 'Puede ser necesario volver a iniciar sesión para autenticarte recientemente. Comprueba también la cuenta destinataria.',
          'functions/permission-denied': 'No tienes permisos para cambiar la contraseña de esta cuenta.',
          'functions/invalid-argument': 'El administrador o la contraseña no son válidos.',
          'admin/emulator-required': 'Esta operación solo está disponible en el modo local de pruebas.',
        }
        setError(mensajesPassword[err.code] + (operacionId ? ` Operación: ${operacionId}` : ''))
      }
    } finally {
      limpiarCambioPassword()
      operacionEnCurso.current = false
      setProcesandoPassword(false)
      setCambiandoUid(null)
    }
  }

  const cargarAdministradores = useCallback(async () => {
    const solicitud = ++solicitudLista.current
    setCargandoLista(true)
    setErrorLista('')
    try {
      const datos = await listarAdministradores()
      if (solicitud === solicitudLista.current) setAdministradores(datos)
    } catch (err) {
      if (solicitud === solicitudLista.current) setErrorLista(err.message || 'No fue posible cargar los administradores.')
    } finally {
      if (solicitud === solicitudLista.current) setCargandoLista(false)
    }
  }, [])

  useEffect(() => {
    let vigente = true
    const solicitud = ++solicitudLista.current
    listarAdministradores().then((datos) => {
      if (vigente && solicitud === solicitudLista.current) setAdministradores(datos)
    }).catch((err) => {
      if (vigente && solicitud === solicitudLista.current) setErrorLista(err.message || 'No fue posible cargar los administradores.')
    }).finally(() => {
      if (vigente && solicitud === solicitudLista.current) setCargandoLista(false)
    })
    return () => { vigente = false }
  }, [])

  const cambiarEstado = async (administrador) => {
    if (operacionEnCurso.current) return
    const nuevoActivo = administrador.activo !== true
    setError('')
    setMensaje('')
    if (!nuevoActivo && administrador.uid === auth.currentUser?.uid) {
      setError('No puedes desactivar tu propia cuenta.')
      return
    }
    if (!nuevoActivo && !window.confirm('¿Desactivar a ' + (administrador.nombre || administrador.email) + '?')) return
    operacionEnCurso.current = true
    setCambiandoUid(administrador.uid)
    try {
      await cambiarEstadoAdministrador(administrador.uid, nuevoActivo)
      setMensaje(nuevoActivo ? 'Administrador reactivado correctamente.' : 'Administrador desactivado correctamente.')
      await cargarAdministradores()
    } catch (err) {
      setError(err.message || 'No fue posible cambiar el estado.')
    } finally {
      operacionEnCurso.current = false
      setCambiandoUid(null)
    }
  }

  const guardarNombre = async (e) => {
    e.preventDefault()
    if (operacionEnCurso.current || !editando) return
    setError('')
    setMensaje('')
    if (editando.uid === auth.currentUser?.uid) {
      setError('No puedes editar tu propio perfil.')
      return
    }
    if (!nombreEdicion.trim() || nombreEdicion.trim().length > 150) {
      setError('El nombre es obligatorio y no puede superar los 150 caracteres.')
      return
    }
    operacionEnCurso.current = true
    setCambiandoUid(editando.uid)
    try {
      await editarNombreAdministrador(editando.uid, nombreEdicion)
      setEditando(null)
      setNombreEdicion('')
      setMensaje('Nombre actualizado correctamente.')
      await cargarAdministradores()
    } catch (err) {
      setError(err.message || 'No fue posible actualizar el nombre.')
    } finally {
      operacionEnCurso.current = false
      setCambiandoUid(null)
    }
  }

  const crearAdministrador = async (e) => {
    e.preventDefault()
    if (operacionEnCurso.current) return
    setMensaje('')
    setError('')

    if (!auth.currentUser) {
      setError('Debes iniciar sesión como administrador.')
      return
    }

    if (!nombre.trim() || password.length < 8 || password.length > 128) {
      setError('Revisa el nombre y la contraseña.')
      return
    }

    if (nombre.trim().length > 150) {
      setError('El nombre completo no puede superar los 150 caracteres.')
      return
    }

    if (password !== confirmarPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    operacionEnCurso.current = true
    setCargando(true)

    try {
      const correo = email.trim().toLowerCase()

      const resultado = await crearAdministradorAuditado(
        nombre.trim(),
        correo,
        password
      )

      setMensaje(
        `Administrador creado correctamente. Operación: ${resultado.operacionId}`
      )
      setNombre('')
      setEmail('')
      setPassword('')
      setConfirmarPassword('')

      await cargarAdministradores()
    } catch (err) {
      console.error('Error creando administrador:', err)

      const mensajes = {
        'functions/permission-denied': 'No tienes permisos para crear administradores.',
        'functions/unauthenticated': 'Debes iniciar sesión.',
        'functions/invalid-argument': 'Revisa los datos ingresados.',
        'functions/internal': 'No se pudo confirmar la creación. Revisa Authentication, Firestore y la Bitácora antes de reintentar.'
      }

      setError(mensajes[err.code] || err.message || 'Error al crear administrador.')
    } finally {
      operacionEnCurso.current = false
      setCargando(false)
    }
  }
  return (
    <section className="bora-card" style={{ maxWidth: 750 }}>
      <h2 style={{ color: '#194C36' }}>Crear administrador</h2>
      <p>Registra nuevos administradores de BORA.</p>

      {mensaje && <p role="status" style={estiloMensaje}>{mensaje}</p>}
      {error && <p role="alert" style={estiloError}>{error}</p>}
      {avisoPassword && (
        <p role="alert" style={estiloError}>
          No se pudo confirmar el resultado del cambio de contraseña. Puede haberse aplicado.
          Revisa la auditoría antes de intentarlo nuevamente; no se reintentará automáticamente.
          {avisoPassword.operacionId && <> Operación: {avisoPassword.operacionId}</>}
        </p>
      )}

      <form onSubmit={crearAdministrador}>
        <Campo label="Nombre completo" value={nombre} change={setNombre} maxLength={150} />
        <Campo label="Correo electrónico" value={email} change={setEmail} type="email" />
        <Campo label="Contraseña" value={password} change={setPassword} type="password" />
        <Campo label="Confirmar contraseña" value={confirmarPassword} change={setConfirmarPassword} type="password" />

        <button type="submit" disabled={cargando || cambiandoUid !== null} className="bora-admin-btn bora-admin-btn--primary">
          {cargando ? 'Creando...' : 'Crear administrador'}
        </button>
      </form>
      <h2 style={{ color: '#194C36', marginTop: 32 }}>Administradores existentes</h2>
      {permiteCambioPassword && destinoPassword && (
        <form onSubmit={guardarPassword} aria-labelledby="titulo-cambio-password" aria-busy={procesandoPassword}>
          <h3 id="titulo-cambio-password">Cambiar contraseña de {destinoPassword.nombre || destinoPassword.email}</h3>
          <p>Solo pruebas locales. Se requiere una sesión autenticada recientemente.</p>
          <label htmlFor="nueva-password-admin">Nueva contraseña</label>
          <input id="nueva-password-admin" type="password" autoComplete="new-password"
            value={nuevaPassword} onChange={(e) => setNuevaPassword(e.target.value)}
            required minLength={8} maxLength={128} disabled={procesandoPassword} style={estiloInput} />
          <label htmlFor="confirmacion-password-admin">Confirmar nueva contraseña</label>
          <input id="confirmacion-password-admin" type="password" autoComplete="new-password"
            value={confirmacionPassword} onChange={(e) => setConfirmacionPassword(e.target.value)}
            required minLength={8} maxLength={128} disabled={procesandoPassword} style={estiloInput} />
          <button type="submit" className="bora-admin-btn bora-admin-btn--primary" disabled={cargando || cambiandoUid !== null}>
            {procesandoPassword ? 'Cambiando contraseña...' : 'Guardar contraseña'}
          </button>
          <button type="button" className="bora-admin-btn bora-admin-btn--secondary" onClick={limpiarCambioPassword} disabled={procesandoPassword}>Cancelar</button>
        </form>
      )}
      {editando && (
        <form onSubmit={guardarNombre}>
          <p>Editar nombre de {editando.email}</p>
          <label htmlFor="nombre-administrador">Nombre completo</label>
          <input id="nombre-administrador" value={nombreEdicion} onChange={(e) => setNombreEdicion(e.target.value)} required maxLength={150} disabled={cambiandoUid !== null} style={estiloInput} />
          <button type="submit" disabled={cargando || cambiandoUid !== null}>Guardar</button>
          <button type="button" className="bora-admin-btn bora-admin-btn--secondary" disabled={cambiandoUid !== null} onClick={() => { setEditando(null); setNombreEdicion('') }}>Cancelar</button>
        </form>
      )}
      <button type="button" onClick={cargarAdministradores} disabled={cargandoLista || cargando || cambiandoUid !== null}>Actualizar listado</button>
      {cargandoLista && <p role="status">Cargando administradores...</p>}
      {errorLista && <p role="alert" style={estiloError}>{errorLista}</p>}
      {!cargandoLista && !errorLista && administradores.length === 0 && <p>No hay administradores registrados.</p>}
      {!cargandoLista && !errorLista && administradores.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', marginTop: 16 }}>
            <thead><tr><th scope="col">Nombre</th><th scope="col">Correo</th><th scope="col">Estado</th><th scope="col">Acciones</th></tr></thead>
            <tbody>
              {administradores.map((administrador) => {
                const esActual = administrador.uid === auth.currentUser?.uid
                const estaActivo = administrador.activo === true
                return (
                  <tr key={administrador.uid}>
                    <td>{administrador.nombre || 'Sin nombre'}{esActual && ' (tu cuenta)'}</td>
                    <td>{administrador.email || 'Sin correo'}</td>
                    <td>{estaActivo ? 'Activo' : 'Inactivo'}</td>
                    <td>
                      <button type="button" disabled={esActual || cargando || cambiandoUid !== null}
                        onClick={() => { limpiarCambioPassword(); setEditando(administrador); setNombreEdicion(administrador.nombre || ''); setError(''); setMensaje('') }}
                      >Editar nombre</button>
                      {permiteCambioPassword && (
                        <button type="button" disabled={esActual || cargando || cambiandoUid !== null}
                          onClick={() => abrirCambioPassword(administrador)}
                          title={esActual ? 'No puedes cambiar tu propia contraseña mediante esta operación.' : undefined}
                        >Cambiar contraseña</button>
                      )}
                      <button type="button"
                      disabled={cargando || cambiandoUid !== null || (esActual && estaActivo)}
                      className={`bora-admin-btn ${estaActivo ? "bora-admin-btn--danger" : "bora-admin-btn--primary"}`} onClick={() => cambiarEstado(administrador)}
                      title={esActual && estaActivo ? 'No puedes desactivar tu propia cuenta.' : undefined}
                    >{cambiandoUid === administrador.uid ? 'Guardando...' : estaActivo ? 'Desactivar' : 'Reactivar'}</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Campo({ label, value, change, type = 'text', maxLength = type === 'password' ? 128 : 254 }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => change(e.target.value)}
        minLength={type === 'password' ? 8 : undefined}
        maxLength={maxLength}
        required
        style={estiloInput}
      />
    </div>
  )
}

const estiloInput = {
  display: 'block',
  width: '100%',
  padding: 12,
  marginTop: 8,
  border: '1px solid #DCE3DD',
  borderRadius: 8,
  boxSizing: 'border-box'
}

const estiloMensaje = {
  padding: 14,
  background: '#E8F5E9',
  color: '#236B4B',
  borderRadius: 10
}

const estiloError = {
  padding: 14,
  background: '#FFF1E9',
  color: '#A43D25',
  borderRadius: 10
}

export default AdministradoresAdmin
