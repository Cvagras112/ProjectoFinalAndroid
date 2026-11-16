import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { ejecutarOperacionEmprendedoras } from '../../services/admin/asignacionesEmprendedorasService'

export async function listarAsignaciones() {
  const resultado = await getDocs(collection(db, 'asignaciones'))
  return resultado.docs.map(item => ({ id: item.id, ...item.data() }))
}

export function guardarAsignacion(emprendedoraId, asociacionId) {
  return ejecutarOperacionEmprendedoras('guardarAsignacionAdministrativa', { id: emprendedoraId, asociacionId })
}

export function quitarAsignacion(id) {
  return ejecutarOperacionEmprendedoras('quitarAsignacionAdministrativa', { id })
}
