import { httpsCallable } from 'firebase/functions'
import { auth, functions } from '../../firebase/config'

function errorSeguro(code, mensaje, operacionId = null, resultadoIncierto = false) {
  return Object.assign(new Error(mensaje), { code, operacionId, resultadoIncierto })
}

function comprobarEntorno() {
  if (!import.meta.env.DEV || import.meta.env.MODE !== 'admin-emulator' ||
      import.meta.env.VITE_ADMIN_EMULATOR !== 'true' ||
      functions.app.options.projectId !== 'demo-bora-admin' ||
      auth.app !== functions.app || functions.region !== 'us-central1') {
    throw errorSeguro('admin/emulator-required', 'Disponible únicamente en el emulador administrativo.')
  }
  if (!auth.currentUser) throw errorSeguro('functions/unauthenticated', 'Debes iniciar sesión como administrador.')
}

function validarDestino(uid) {
  if (typeof uid !== 'string' || !uid || uid.length > 128 || uid.includes('/') || uid === auth.currentUser.uid) {
    throw errorSeguro('functions/invalid-argument', 'Selecciona otra cuenta administradora válida.')
  }
}

async function invocar(nombre, datos) {
  let respuesta
  try {
    respuesta = await httpsCallable(functions, nombre)(datos)
  } catch (fallo) {
    const mensajes = {
      'functions/unauthenticated': 'Vuelve a iniciar sesión.',
      'functions/permission-denied': 'Se requiere un administrador activo.',
      'functions/invalid-argument': 'Revisa los datos del formulario.',
      'functions/failed-precondition': 'Comprueba la cuenta destinataria y si existen cambios que guardar.',
    }
    const conocido = Object.hasOwn(mensajes, fallo?.code)
    const id = typeof fallo?.details?.operacionId === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(fallo.details.operacionId) ? fallo.details.operacionId : null
    throw errorSeguro(conocido ? fallo.code : 'functions/unavailable', conocido ? mensajes[fallo.code] :
      'Resultado no confirmado. Revisa la bitácora y las cuentas antes de repetir; no se reintentó automáticamente.', id, !conocido)
  }
  const resultado = respuesta?.data
  if (resultado?.resultado !== 'exito' || typeof resultado.operacionId !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(resultado.operacionId) ||
      (nombre === 'crearAdministradorConAuditoria' && (typeof resultado.uid !== 'string' || !resultado.uid))) {
    throw errorSeguro('functions/unknown', 'Resultado no confirmado. Revisa la bitácora antes de continuar.', null, true)
  }
  return { resultado: 'exito', operacionId: resultado.operacionId,
    ...(nombre === 'crearAdministradorConAuditoria' ? { uid: resultado.uid } : {}) }
}

export async function editarNombreAdministrador(uid, nombre) {
  comprobarEntorno()
  validarDestino(uid)
  if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 150) {
    throw errorSeguro('functions/invalid-argument', 'El nombre es obligatorio y admite hasta 150 caracteres.')
  }
  return invocar('operarAdministradorAuditado', { accion: 'editar', uid, nombre })
}

export async function cambiarEstadoAdministrador(uid, activo) {
  comprobarEntorno()
  validarDestino(uid)
  if (typeof activo !== 'boolean') throw errorSeguro('functions/invalid-argument', 'Estado inválido.')
  return invocar('operarAdministradorAuditado', { accion: activo ? 'activar' : 'desactivar', uid })
}

export async function crearAdministradorAuditado(nombre, email, password) {
  comprobarEntorno()
  if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 150 ||
      typeof email !== 'string' || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof password !== 'string' || password.length < 8 || password.length > 128 || !password.trim()) {
    throw errorSeguro('functions/invalid-argument', 'Revisa el nombre, correo y contraseña de 8 a 128 caracteres.')
  }
  return invocar('crearAdministradorConAuditoria', { nombre, email, password })
}
