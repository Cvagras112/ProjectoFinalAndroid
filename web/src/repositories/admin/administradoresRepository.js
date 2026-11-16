import { collection, doc, getDocs, query, runTransaction, setDoc, where } from 'firebase/firestore'
import { auth, db } from '../../firebase/config'

export function crearPerfilAdministrador(uid, { nombre, email }) {
  return setDoc(doc(db, 'usuarios', uid), {
    ID: uid, nombre, email, rol: 'administrador', activo: true
  })
}

export async function listarAdministradores() {
  const resultado = await getDocs(query(collection(db, 'usuarios'), where('rol', '==', 'administrador')))
  return resultado.docs.map((documento) => ({ ...documento.data(), uid: documento.id }))
    .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'))
}

export async function cambiarEstadoAdministrador(uid, activo) {
  const actual = auth.currentUser
  if (!actual) throw new Error('Debes iniciar sesión como administrador.')
  if (!uid || typeof uid !== 'string' || typeof activo !== 'boolean') throw new Error('Administrador o estado inválido.')
  if (!activo && uid === actual.uid) throw new Error('No puedes desactivar tu propia cuenta.')
  const referencia = doc(db, 'usuarios', uid)
  return runTransaction(db, async (transaccion) => {
    const resultado = await transaccion.get(referencia)
    if (!resultado.exists() || resultado.data().rol !== 'administrador') throw new Error('Administrador no válido.')
    transaccion.update(referencia, { activo })
  })
}

export async function editarNombreAdministrador(uid, nombre) {
  const actual = auth.currentUser
  if (!actual) throw new Error('Debes iniciar sesión como administrador.')
  if (typeof uid !== 'string' || !uid || uid.includes('/')) throw new Error('Administrador no válido.')
  if (uid === actual.uid) throw new Error('No puedes editar tu propio perfil.')
  if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 150) {
    throw new Error('El nombre es obligatorio y no puede superar los 150 caracteres.')
  }
  const nombreLimpio = nombre.trim()
  return runTransaction(db, async (transaccion) => {
    const solicitante = await transaccion.get(doc(db, 'usuarios', actual.uid))
    if (!solicitante.exists() || solicitante.data().rol !== 'administrador' || solicitante.data().activo !== true) {
      throw new Error('No tienes permisos de administrador activo.')
    }
    const referencia = doc(db, 'usuarios', uid)
    const resultado = await transaccion.get(referencia)
    if (!resultado.exists() || resultado.data().rol !== 'administrador') throw new Error('Administrador no válido.')
    transaccion.update(referencia, { nombre: nombreLimpio })
  })
}
