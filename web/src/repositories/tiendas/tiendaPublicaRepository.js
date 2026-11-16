import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { db } from '../../firebase/config'

export async function listarTiendasPublicas() {
  const resultado = await getDocs(collection(db, 'tiendas'))
  return resultado.docs.map((documento) => ({ ...documento.data(), id: documento.id }))
}

export async function consultarTiendaPublica(id) {
  const resultado = await getDoc(doc(db, 'tiendas', id))
  return resultado.exists() ? { ...resultado.data(), id: resultado.id } : null
}
