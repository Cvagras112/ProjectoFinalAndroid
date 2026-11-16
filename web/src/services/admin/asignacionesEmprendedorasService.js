import { httpsCallable } from 'firebase/functions'
import { auth, functions } from '../../firebase/config'

const permitidas = new Set(['guardarAsignacionAdministrativa', 'quitarAsignacionAdministrativa',
  'editarPerfilEmprendedoraAdministrativa', 'cambiarEstadoEmprendedoraAdministrativa'])
const pendientes = new Map()

// Compartido por los dos repositorios, sin cambios de formularios ni de altas.
export async function ejecutarOperacionEmprendedoras(nombre, datos) {
  if (!import.meta.env.DEV || import.meta.env.MODE !== 'admin-emulator' ||
      import.meta.env.VITE_ADMIN_EMULATOR !== 'true' ||
      functions.app.options.projectId !== 'demo-bora-admin' ||
      auth.app !== functions.app || functions.region !== 'us-central1') {
    throw new Error('Las operaciones auditadas requieren el modo local admin-emulator.')
  }
  if (!auth.currentUser) throw new Error('Debes iniciar sesión como administrador.')
  if (!permitidas.has(nombre)) throw new Error('Operación no permitida.')
  const clave = JSON.stringify([auth.currentUser.uid, nombre, datos])
  const anterior = pendientes.get(clave)
  if (anterior?.promesa) return anterior.promesa
  const tarea = { solicitudId: anterior?.solicitudId || crypto.randomUUID(), promesa: null }
  tarea.promesa = Promise.resolve().then(async () => {
    let respuesta
    try {
      respuesta = await httpsCallable(functions, nombre)({ ...datos, solicitudId: tarea.solicitudId })
    } catch (error) {
      const mensajes = {
        'functions/unauthenticated': 'Vuelve a iniciar sesión.',
        'functions/permission-denied': 'Se requiere un administrador activo.',
        'functions/invalid-argument': 'Revisa los datos del formulario.',
        'functions/failed-precondition': 'Comprueba los perfiles y estados; puede que el registro ya tenga esos valores.',
        'functions/not-found': 'La asignación ya no existe. Actualiza el listado.',
        'functions/already-exists': 'La clave de operación ya fue utilizada con otros datos.',
      }
      if (Object.hasOwn(mensajes, error?.code)) {
        pendientes.delete(clave)
        // eslint-disable-next-line preserve-caught-error -- No propagar datos del SDK.
        throw new Error(mensajes[error.code])
      }
      tarea.promesa = null
      const id = typeof error?.details?.operacionId === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(error.details.operacionId) ? error.details.operacionId : null
      // eslint-disable-next-line preserve-caught-error -- Solo metadatos validados.
      throw new Error('Resultado no confirmado. Revisa la bitácora; no hubo reintentos automáticos.' + (id ? ` Operación: ${id}` : ''))
    }
    if (respuesta?.data?.resultado !== 'exito' || typeof respuesta.data.operacionId !== 'string') {
      tarea.promesa = null
      throw new Error('Resultado no confirmado. Revisa la bitácora antes de continuar.')
    }
    pendientes.delete(clave)
    return { resultado: 'exito', operacionId: respuesta.data.operacionId, elementoId: respuesta.data.elementoId }
  })
  pendientes.set(clave, tarea)
  return tarea.promesa
}
