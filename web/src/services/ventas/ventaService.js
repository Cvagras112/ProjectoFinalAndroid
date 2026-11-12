import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { auth, db } from '../../firebase/config'
import { registrarVentaTransaccion } from '../productos/inventarioTransacciones'

export function observarVentas(tiendaId, recibir, error) {
  const uid = auth.currentUser?.uid
  if (!uid) { error(new Error('Inicia sesión.')); return () => {} }
  return onSnapshot(query(collection(db, 'ventas'), where('usuarioId', '==', uid), where('tiendaId', '==', tiendaId)), resultado => {
    recibir(resultado.docs.map(d => ({...d.data(), id: d.id})).sort((a,b) => (b.fecha?.toMillis() || 0) - (a.fecha?.toMillis() || 0)))
  }, error)
}

export async function registrarVenta(datos, operacionId) {
  if (!auth.currentUser) throw new Error('Inicia sesión.')
  return registrarVentaTransaccion(db, auth.currentUser.uid, { ...datos, operacionId })
}
