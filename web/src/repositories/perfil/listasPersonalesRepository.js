import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'

function referencia(uid, lista, id) {
  if (!['favoritos', 'tiendasSeguidas'].includes(lista)) throw new Error('Lista no válida.')
  return doc(db, 'usuarios', uid, lista, id)
}

export function observarLista(uid, lista, recibir, error) {
  return onSnapshot(collection(db, 'usuarios', uid, lista), resultado => {
    recibir(resultado.docs.map(d => ({ ...d.data(), id: d.id })))
  }, error)
}

export async function consultarLista(uid, lista) {
  const resultado = await getDocs(collection(db, 'usuarios', uid, lista))
  return resultado.docs.map(d => ({ ...d.data(), id: d.id }))
}

export async function contieneReferencia(uid, lista, id) {
  return (await getDoc(referencia(uid, lista, id))).exists()
}

export function guardarReferencia(uid, lista, campo, id, vigente) {
  // Crear solo si no existe: repetir la acción conserva fecha y evita updates prohibidos.
  return runTransaction(db, async transaccion => {
    const ref = referencia(uid, lista, id)
    const existente = await transaccion.get(ref)
    if (!vigente()) throw new Error('La sesión cambió. Vuelve a intentarlo.')
    if (!existente.exists()) transaccion.set(ref, { [campo]: id, usuarioId: uid, fecha: serverTimestamp() })
  })
}

export function eliminarReferencia(uid, lista, id) {
  return deleteDoc(referencia(uid, lista, id))
}

export async function consultarDestino(coleccion, id) {
  if (!['productos', 'tiendas'].includes(coleccion)) throw new Error('Destino no válido.')
  const resultado = await getDoc(doc(db, coleccion, id))
  return resultado.exists() ? { ...resultado.data(), id: resultado.id } : null
}
