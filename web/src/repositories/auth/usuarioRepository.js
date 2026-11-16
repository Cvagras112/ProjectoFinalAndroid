import { doc, getDoc, onSnapshot, runTransaction } from 'firebase/firestore'
import { db } from '../../firebase/config'

export async function obtenerUsuario(uid) {
  const resultado = await getDoc(doc(db, 'usuarios', uid))
  return resultado.exists() ? { ...resultado.data(), id: resultado.id } : null
}

export async function crearCompradorSiNoExiste(uid, perfil) {
  return runTransaction(db, async (transaccion) => {
    const referencia = doc(db, 'usuarios', uid)
    const existente = await transaccion.get(referencia)
    if (existente.exists()) return { ...existente.data(), id: existente.id }
    transaccion.set(referencia, perfil)
    return { ...perfil, id: uid }
  })
}

export function observarDocumentoCuenta(coleccion, uid, recibir, error) {
  return onSnapshot(doc(db, coleccion, uid), (resultado) => {
    recibir(resultado.exists() ? resultado.data() : null)
  }, error)
}

export async function obtenerEmprendedor(uid) {
  const resultado = await getDoc(doc(db, 'emprendedores', uid))
  return resultado.exists() ? resultado.data() : null
}
