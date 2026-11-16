import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../firebase/config'

export async function listarCategorias() {
  const resultado = await getDocs(collection(db, 'categorias'))
  return resultado.docs.map((documento) => documento.data())
}
