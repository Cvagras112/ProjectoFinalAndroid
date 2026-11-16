import { httpsCallable } from 'firebase/functions'
import { auth, functions } from '../../firebase/config'

const mensajes = {
  'functions/unauthenticated': 'Debes iniciar sesión nuevamente.',
  'functions/permission-denied': 'No tienes permiso para cambiar esta contraseña.',
  'functions/invalid-argument': 'Revisa el administrador y la contraseña ingresados.',
  'functions/failed-precondition': 'Vuelve a autenticarte y comprueba que la cuenta destinataria sea administradora.',
}

function identificarOperacion(valor) {
  return typeof valor === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(valor) ? valor : null
}

function errorSeguro(code, message, operacionId = null, resultadoIncierto = false) {
  const error = new Error(message)
  error.code = code
  error.operacionId = operacionId
  error.resultadoIncierto = resultadoIncierto
  return error
}

export async function cambiarPasswordDeAdministrador(uid, nuevaPassword) {
  if (!import.meta.env.DEV || import.meta.env.MODE !== 'admin-emulator' ||
      import.meta.env.VITE_ADMIN_EMULATOR !== 'true' ||
      functions.app.options.projectId !== 'demo-bora-admin' ||
      auth.app !== functions.app || functions.region !== 'us-central1') {
    throw errorSeguro('admin/emulator-required', 'Esta operación solo está disponible en el entorno administrativo de pruebas.')
  }
  if (!auth.currentUser) {
    throw errorSeguro('functions/unauthenticated', mensajes['functions/unauthenticated'])
  }
  // Conservar el UID y la contraseña exactamente como fueron recibidos.
  if (typeof uid !== 'string' || !uid || uid.length > 128 || uid.includes('/') ||
      typeof nuevaPassword !== 'string' || nuevaPassword.length < 8 ||
      nuevaPassword.length > 128 || !nuevaPassword.trim()) {
    throw errorSeguro('functions/invalid-argument', mensajes['functions/invalid-argument'])
  }
  if (uid === auth.currentUser.uid) {
    throw errorSeguro('functions/permission-denied', 'No puedes cambiar tu propia contraseña mediante esta operación.')
  }

  let respuesta
  try {
    // Una sola invocación. El SDK adjunta el token de la sesión principal.
    const cambiar = httpsCallable(functions, 'cambiarPasswordAdministrador')
    respuesta = await cambiar({ uid, password: nuevaPassword })
  } catch (fallo) {
    const code = Object.hasOwn(mensajes, fallo?.code) ? fallo.code : 'functions/unavailable'
    throw errorSeguro(
      code,
      mensajes[code] || 'No se pudo confirmar el resultado. No repitas automáticamente la operación; revisa la auditoría.',
      identificarOperacion(fallo?.details?.operacionId),
      !Object.hasOwn(mensajes, fallo?.code),
    )
  }

  const operacionId = identificarOperacion(respuesta?.data?.operacionId)
  if (respuesta?.data?.resultado !== 'exito' || !operacionId) {
    throw errorSeguro('functions/unknown', 'El resultado no está confirmado. Revisa la auditoría antes de volver a intentarlo.', operacionId, true)
  }
  return { resultado: 'exito', operacionId }
}
