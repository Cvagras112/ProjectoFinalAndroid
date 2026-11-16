import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { ejecutarOperacionCatalogo } from '../../services/admin/catalogosService'

// Solo se exportan operaciones ligadas a los tres catálogos existentes.
function operacionesCatalogo(tipo) {
  return {
    async crear(nombre) {
      const resultado = await ejecutarOperacionCatalogo(`crear${tipo}`, { nombre })
      return { id: resultado.elementoId, ...resultado.registro }
    },
    editarNombre(id, nombre) {
      return ejecutarOperacionCatalogo(`editar${tipo}`, { id, nombre })
    },
    cambiarEstado(id, estado) {
      if (!['Activa', 'Inactiva'].includes(estado)) {
        throw new Error('El estado debe ser Activa o Inactiva.')
      }
      return ejecutarOperacionCatalogo(`cambiarEstado${tipo}`, { id, estado })
    },
  }
}

const tiposEmprendimiento = operacionesCatalogo('TipoEmprendimiento')
const tiposProductos = operacionesCatalogo('TipoProducto')
const categorias = operacionesCatalogo('Categoria')

export const crearTipoEmprendimiento = tiposEmprendimiento.crear
export const editarNombreTipoEmprendimiento = tiposEmprendimiento.editarNombre
export const cambiarEstadoTipoEmprendimiento = tiposEmprendimiento.cambiarEstado

export const crearTipoProducto = tiposProductos.crear
export const editarNombreTipoProducto = tiposProductos.editarNombre
export const cambiarEstadoTipoProducto = tiposProductos.cambiarEstado

export const crearCategoria = categorias.crear
export const editarNombreCategoria = categorias.editarNombre
export const cambiarEstadoCategoria = categorias.cambiarEstado

export async function listarCategorias() {
  const resultado = await getDocs(collection(db, 'categorias'))
  return resultado.docs.map(item => ({ id: item.id, ...item.data() }))
}

export async function listarTiposEmprendimiento() {
  const resultado = await getDocs(collection(db, 'tipos_emprendimiento'))
  return resultado.docs.map(item => ({ id: item.id, ...item.data() }))
}

export async function listarTiposProductos() {
  const resultado = await getDocs(collection(db, 'tipos_productos'))
  return resultado.docs.map(item => ({ id: item.id, ...item.data() }))
}
