import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../firebase/config'

export async function listarSolicitudes() {
  const resultado = await getDocs(collection(db, 'solicitudes_emprendedores'))
  return resultado.docs.map(documento => ({ ...documento.data(), id: documento.id }))
}
