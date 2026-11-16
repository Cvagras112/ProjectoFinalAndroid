import { crearListaPersonal } from '../perfil/listaPersonalService'
import { consultarDestino } from '../../repositories/perfil/listasPersonalesRepository'
import { normalizarProducto } from './productoModelo'

export const listaFavoritos = crearListaPersonal('favoritos', 'productoId')
export const obtenerFavoritos = listaFavoritos.obtener
export const comprobarFavorito = listaFavoritos.comprobar
export const agregarFavorito = listaFavoritos.agregar
export const quitarFavorito = listaFavoritos.quitar

export async function obtenerDetallesFavoritos(ids) {
  const productos = await Promise.all(ids.map(id => consultarDestino('productos', id)))
  const tiendas = new Map()
  for (const producto of productos.filter(Boolean)) {
    const tiendaId = producto.ID_Tienda || producto.idTienda
    if (tiendaId && !tiendas.has(tiendaId)) tiendas.set(tiendaId, consultarDestino('tiendas', tiendaId))
  }
  await Promise.all([...tiendas].map(async ([id, consulta]) => tiendas.set(id, await consulta)))
  return ids.map((id, indice) => {
    const datos = productos[indice]
    if (!datos) return { id, estado: 'eliminado', nombre: 'Producto eliminado' }
    const producto = normalizarProducto(datos, id)
    const tienda = tiendas.get(producto.tiendaId)
    return { ...producto, tienda: tienda?.nombre || 'Emprendimiento no disponible', estado: producto.visible && tienda?.activo !== false ? 'publicado' : 'no-disponible' }
  })
}
