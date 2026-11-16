import { httpsCallable } from 'firebase/functions'
import { auth, functions } from '../../firebase/config'

const operaciones = new Set([
  'crearCategoria', 'editarCategoria', 'cambiarEstadoCategoria',
  'crearTipoProducto', 'editarTipoProducto', 'cambiarEstadoTipoProducto',
  'crearTipoEmprendimiento', 'editarTipoEmprendimiento', 'cambiarEstadoTipoEmprendimiento',
  'crearAsociacion', 'editarAsociacion', 'cambiarEstadoAsociacion',
])
// La clave se conserva para repetir manualmente una misma solicitud incierta,
// sin duplicar la modificación. No persistir ni registrar el contenido enviado.
const pendientes = new Map()

export async function ejecutarOperacionCatalogo(nombre, datos) {
  if (!import.meta.env.DEV || import.meta.env.MODE !== 'admin-emulator' ||
      import.meta.env.VITE_ADMIN_EMULATOR !== 'true' ||
      functions.app.options.projectId !== 'demo-bora-admin' || auth.app !== functions.app ||
      functions.region !== 'us-central1') {
    throw new Error('Las operaciones auditadas requieren el modo local admin-emulator.')
  }
  if (!auth.currentUser) throw new Error('Debes iniciar sesión como administrador.')
  if (!operaciones.has(nombre)) throw new Error('Operación no permitida.')
  const clave = JSON.stringify([auth.currentUser.uid, nombre, datos])
  const anterior = pendientes.get(clave)
  if (anterior?.promesa) return anterior.promesa
  const solicitudId = anterior?.solicitudId || crypto.randomUUID()
  const tarea = { solicitudId, promesa: null }
  const promesa = Promise.resolve().then(async () => {
    let respuesta
    try {
      respuesta = await httpsCallable(functions, nombre)({ ...datos, solicitudId })
    } catch (error) {
      const mensajes = {
        'functions/unauthenticated': 'Vuelve a iniciar sesión.',
        'functions/permission-denied': 'Se requiere un administrador activo.',
        'functions/invalid-argument': 'Revisa los datos del formulario.',
        'functions/not-found': 'El registro ya no existe. Actualiza el listado.',
        'functions/already-exists': 'Ya existe un registro o una operación con esos datos.',
        'functions/failed-precondition': 'El registro ya contiene esos valores. Actualiza el listado.',
      }
      if (Object.hasOwn(mensajes, error?.code)) {
        pendientes.delete(clave)
        // No adjuntar el error remoto: puede contener payloads sensibles.
        // eslint-disable-next-line preserve-caught-error
        throw new Error(mensajes[error.code])
      }
      tarea.promesa = null
      const operacionId = typeof error?.details?.operacionId === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(error.details.operacionId) ? error.details.operacionId : null
      // eslint-disable-next-line preserve-caught-error -- Exponer solo metadatos validados.
      throw new Error('Resultado no confirmado. Revisa la bitácora; no hubo reintentos automáticos.' + (operacionId ? ` Operación: ${operacionId}` : ''))
    }
    if (respuesta?.data?.resultado !== 'exito' || typeof respuesta.data.elementoId !== 'string' ||
        typeof respuesta.data.operacionId !== 'string') {
      tarea.promesa = null
      throw new Error('Respuesta no confirmada. Revisa la bitácora antes de continuar.')
    }
    pendientes.delete(clave)
    return respuesta.data
  })
  tarea.promesa = promesa
  pendientes.set(clave, tarea)
  return promesa
}
