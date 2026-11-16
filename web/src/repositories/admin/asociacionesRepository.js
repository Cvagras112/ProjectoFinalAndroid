import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { ejecutarOperacionCatalogo } from '../../services/admin/catalogosService'

function datosAsociacion({ nombre, descripcion, sector, contacto, logo }) {
  return { nombre, descripcion, sector, contacto, logo }
}

export async function crearAsociacion(datos) {
  const resultado = await ejecutarOperacionCatalogo('crearAsociacion', datosAsociacion(datos))
  return { id: resultado.elementoId, ...resultado.registro }
}

export function editarAsociacion(id, datos) {
  return ejecutarOperacionCatalogo('editarAsociacion', { id, ...datosAsociacion(datos) })
}

export function cambiarEstadoAsociacion(id, estado) {
  return ejecutarOperacionCatalogo('cambiarEstadoAsociacion', { id, estado })
}

export async function listarAsociaciones() {
  const resultado = await getDocs(collection(db, 'asociaciones'))
  return resultado.docs.map(item => ({ id: item.id, ...item.data() }))
}
