import { crearListaPersonal } from '../perfil/listaPersonalService'
import { consultarDestino } from '../../repositories/perfil/listasPersonalesRepository'
import { normalizarTiendaPublica } from './tiendaPublicaModelo'

export const listaSeguimientos = crearListaPersonal('tiendasSeguidas', 'tiendaId')
export const comprobarSeguimiento = listaSeguimientos.comprobar
export const seguirTienda = listaSeguimientos.agregar
export const dejarDeSeguirTienda = listaSeguimientos.quitar
export const obtenerTiendasSeguidas = listaSeguimientos.obtener

export async function obtenerDetallesTiendasSeguidas(ids) {
  return Promise.all(ids.map(async id => {
    const datos = await consultarDestino('tiendas', id)
    const tienda = normalizarTiendaPublica(datos)
    return tienda ? { ...tienda, estado: 'publicada' }
      : { id, nombre: datos?.nombre || 'Tienda eliminada', estado: 'no-disponible' }
  }))
}
