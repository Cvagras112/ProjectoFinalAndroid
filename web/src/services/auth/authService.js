
import {
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore'

import {
  reload,
  getIdTokenResult,
} from 'firebase/auth'

import { db } from '../../firebase/config'

/**
 * Consulta el perfil de un usuario en Firestore.
 */
export async function obtenerPerfilUsuario(uid) {
  if (!uid) {
    throw new Error('No se recibió el identificador del usuario.')
  }

  const referencia = doc(db, 'usuarios', uid)
  const resultado = await getDoc(referencia)

  if (!resultado.exists()) {
    return null
  }

  return {
    ...resultado.data(),
    id: resultado.id,
  }
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

  if (!token.signInProvider ||
      token.signInProvider !== 'password') {
    throw new Error(
      'Este proceso está disponible únicamente para cuentas registradas con correo y contraseña.'
    )
  }

  // No sobrescribir perfiles existentes.
  const perfilExistente = await obtenerPerfilUsuario(usuario.uid)

  if (perfilExistente) {
    return perfilExistente
  }

  const nombre = String(usuario.displayName || '').trim()
  const email = String(usuario.email || '').trim()

  if (!nombre || !email) {
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

  const referencia = doc(db, 'usuarios', usuario.uid)

  await setDoc(referencia, nuevoPerfil)

  return {
    ...nuevoPerfil,
    id: usuario.uid,
  }
}
