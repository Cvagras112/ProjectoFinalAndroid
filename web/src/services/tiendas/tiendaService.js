
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'

export async function obtenerTiendaEmprendedor(uid) {
  if (!uid) {
    throw new Error('Debes iniciar sesión para consultar tu tienda.')
  }

  const emprendedorRef = doc(db, 'emprendedores', uid)
  const emprendedorDoc = await getDoc(emprendedorRef)

  if (!emprendedorDoc.exists()) {
    throw new Error('No encontramos tu perfil de emprendedor.')
  }

  const emprendedor = emprendedorDoc.data()

  if (emprendedor.activo !== true) {
    throw new Error('Tu perfil de emprendedor no está activo.')
  }

  const tiendaId = emprendedor.ID_Tienda

  if (!tiendaId) {
    throw new Error('Tu perfil no tiene una tienda asociada.')
  }

  const tiendaRef = doc(db, 'tiendas', tiendaId)
  const tiendaDoc = await getDoc(tiendaRef)

  if (!tiendaDoc.exists()) {
    throw new Error('No encontramos tu tienda.')
  }

  const tienda = tiendaDoc.data()

  if (tienda.activo !== true || tienda.ID_Dueno !== uid) {
    throw new Error('No tienes acceso a esta tienda.')
  }

  return {
    id: tiendaDoc.id,
    ...tienda,
  }
}
