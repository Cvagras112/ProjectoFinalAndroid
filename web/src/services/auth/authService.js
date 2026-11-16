import { reload, getIdTokenResult } from 'firebase/auth'
import { obtenerUsuario, crearCompradorSiNoExiste, obtenerEmprendedor } from '../../repositories/auth/usuarioRepository'

/**
 * Consulta el perfil de un usuario en Firestore.
 */
export async function obtenerPerfilUsuario(uid) {
  if (!uid) {
    throw new Error('No se recibió el identificador del usuario.')
  }

  return obtenerUsuario(uid)
}

/**
 * Completa el perfil de un comprador que ya verificó
 * su correo electrónico.
 *
 * Solo debe llamarse desde el flujo de registro público.
 */
export async function completarPerfilComprador(usuario) {
  if (!usuario) {
    throw new Error('Debes iniciar sesión para continuar.')
  }

  // Actualizar el estado del usuario desde Firebase.
  await reload(usuario)

  if (!usuario.emailVerified) {
    throw new Error(
      'Debes verificar tu correo electrónico antes de continuar.'
    )
  }

  // Actualizar el token utilizado por Firestore.
  await usuario.getIdToken(true)

  const token = await getIdTokenResult(usuario)

  if (!['password', 'google.com'].includes(token.signInProvider)) {
    throw new Error(
      'Este método de acceso no permite completar tu perfil.'
    )
  }

  // No sobrescribir perfiles existentes.
  const perfilExistente = await obtenerPerfilUsuario(usuario.uid)

  if (perfilExistente) {
    return perfilExistente
  }

  const nombre = String(usuario.displayName || '').trim()
  const email = String(usuario.email || '').trim()

  if (!nombre || nombre.length > 150 || !email) {
    throw new Error(
      'Tu cuenta no tiene los datos necesarios para completar el perfil.'
    )
  }

  const nuevoPerfil = {
    ID: usuario.uid,
    nombre,
    email,
    rol: 'comprador',
    activo: true,
  }

  return crearCompradorSiNoExiste(usuario.uid, nuevoPerfil)
}

export async function emprendedorActivo(uid) {
  const perfil = await obtenerEmprendedor(uid)
  return perfil?.activo === true
}
