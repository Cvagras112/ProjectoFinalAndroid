// Contrato público compartido con Android; conserva documentos anteriores.
import { stockOriginalProducto } from './inventarioModelo.js'

export function normalizarProducto(datos, id) {
  const variantes = (datos.Variantes || []).map(v => ({...v, active: v.active !== false}))
  const activas = variantes.filter(v => v.active)
  const manejaStock = variantes.length > 0 || datos.ManejaStock !== false
  const stockOriginal = Number(stockOriginalProducto(datos))
  const stockVariantes = activas.reduce((n,v) => n + Number(v.stock || 0), 0)
  const stock = stockOriginal + stockVariantes
  const accionAgotado = datos.AccionAgotado || 'mostrar'
  const vendido = datos.Vendido === true
  const disponible = datos.Disponible !== false && !vendido
  const ofrecerPedido = datos.OfrecerPedido === true || (manejaStock && stock <= 0 && accionAgotado === 'pedido')
  return {
    id, nombre: datos.Nombre || datos.nombre || 'Producto sin nombre',
    categoria: datos.Categoria || datos.categoria || 'Sin categoría',
    tipoProducto: datos.TipoProducto || '',
    precio: Number(datos.Precio ?? datos.precio ?? 0),
    precioBase: Number(datos.Precio ?? datos.precio ?? 0),
    ofrecerPedidoBase: datos.OfrecerPedido === true,
    stock, stockOriginal, stockVariantes,
    requiereConfirmarStockOriginal: datos.StockOriginal == null && variantes.length > 0,
    manejaStock, disponible, vendido, ofrecerPedido,
    piezaUnica: datos.PiezaUnica === true, accionAgotado,
    visible: disponible && (!manejaStock || stock > 0 || accionAgotado !== 'ocultar'),
    imagen: datos.imagen || datos.Imagen || '',
    descripcion: datos.Descripcion || datos.descripcion || '',
    tiendaId: datos.ID_Tienda || datos.idTienda || '', variantes,
    revision: datos.Revision || 0,
  }
}
export function disponibilidadProducto(producto, variante) {
  if (!producto.disponible || variante?.active === false) return 'No disponible'
  if (!producto.manejaStock) return producto.ofrecerPedido ? 'A pedido' : 'Disponible'
  // Sin opción se muestra el resumen del catálogo; con opción, sus existencias.
  const stock = variante?.stock ?? producto.stock
  if (stock > 0) return 'Disponible · ' + stock + ' unidades'
  return producto.accionAgotado === 'pedido' || producto.ofrecerPedido ? 'A pedido' : 'Agotado'
}
