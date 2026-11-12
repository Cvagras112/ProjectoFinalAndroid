import { doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { prepararProducto, prepararVenta } from './inventarioModelo.js'

function identificador(valor) {
  if (typeof valor !== 'string' || !valor || valor.length > 128 || valor.includes('/')) throw new Error('Identificador inválido.')
  return valor
}
async function verificarPropietaria(tx, db, uid, tiendaId) {
  const [usuario, perfil, tienda] = await Promise.all([
    tx.get(doc(db, 'usuarios', uid)), tx.get(doc(db, 'emprendedores', uid)), tx.get(doc(db, 'tiendas', tiendaId)),
  ])
  if (!usuario.exists() || usuario.data().rol !== 'emprendedor' || usuario.data().activo !== true || !perfil.exists() || perfil.data().activo !== true || perfil.data().ID_Tienda !== tiendaId || !tienda.exists() || tienda.data().activo !== true || tienda.data().ID_Dueno !== uid) {
    const error = new Error('Tu cuenta no puede administrar esta tienda.')
    error.code = 'inventario/propiedad'
    throw error
  }
}
export async function guardarProductoTransaccion(db, uid, solicitud) {
  if (!uid) throw new Error('Inicia sesión.')
  const tiendaId = identificador(solicitud.tiendaId)
  const productoId = identificador(solicitud.productoId)
  return runTransaction(db, async tx => {
    await verificarPropietaria(tx, db, uid, tiendaId)
    const ref = doc(db, 'productos', productoId)
    const snap = await tx.get(ref)
    if (snap.exists() && snap.data().ID_Tienda !== tiendaId) throw new Error('Producto ajeno.')
    if (snap.exists() && (snap.data().Revision || 0) !== solicitud.revision) throw new Error('El inventario cambió. Recarga el producto antes de editar.')
    if (!snap.exists() && solicitud.revision !== null) throw new Error('El producto ya no existe.')
    tx.set(ref, {...prepararProducto(solicitud.datos || {}, snap.exists() ? snap.data() : {}), ID_Producto: productoId, ID_Tienda: tiendaId, ActualizadoEn: serverTimestamp()})
    return { productoId }
  })
}
export async function registrarVentaTransaccion(db, uid, solicitud) {
  if (!uid) throw new Error('Inicia sesión.')
  const tiendaId = identificador(solicitud.tiendaId)
  const productoId = identificador(solicitud.productoId)
  const operacionId = identificador(solicitud.operacionId)
  const ventaId = uid + '_' + operacionId
  return runTransaction(db, async tx => {
    await verificarPropietaria(tx, db, uid, tiendaId)
    const reciboRef = doc(db, 'movimientosInventario', uid, 'operaciones', operacionId)
    const recibo = await tx.get(reciboRef)
    const firma = { productoId, tiendaId, varianteId: solicitud.varianteId || '', cantidad: solicitud.cantidad }
    if (recibo.exists()) {
      if (Object.keys(firma).some(campo => recibo.data()[campo] !== firma[campo])) throw new Error('Este identificador ya corresponde a otra operación.')
      return { ventaId: recibo.data().ventaId, repetida: true }
    }
    const ref = doc(db, 'productos', productoId)
    const snap = await tx.get(ref)
    if (!snap.exists() || snap.data().ID_Tienda !== tiendaId) throw new Error('No encontramos un producto de tu tienda.')
    const producto = snap.data()
    const { cambios, venta } = prepararVenta(producto, solicitud)
    const indiceVariante = (producto.Variantes || []).findIndex(v => v.id === venta.varianteId)
    tx.update(ref, {...cambios, UltimaVenta: ventaId, ActualizadoEn: serverTimestamp()})
    tx.set(reciboRef, {...firma, ventaId, fecha: serverTimestamp()})
    tx.set(doc(db, 'ventas', ventaId), {...venta, productoId, tiendaId, usuarioId: uid, operacionId, indiceVariante, fecha: serverTimestamp()})
    return { ventaId }
  })
}
