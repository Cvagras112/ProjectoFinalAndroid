import { useEffect, useRef, useState } from 'react'
import { auth } from '../../firebase/config'
import { observarVentas, registrarVenta } from '../../services/ventas/ventaService'

const precio = valor => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(valor)
const vacia = { productoId: '', varianteId: '', cantidad: '1' }

export default function VentasPanel({ tiendaId, productos, actualizarProductos }) {
  const clave = 'bora-venta-pendiente:' + auth.currentUser?.uid + ':' + tiendaId
  const [restaurada] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(clave) || 'null') } catch { return null }
  })
  const [formulario, setFormulario] = useState(restaurada?.datos || vacia)
  const [pendiente, setPendiente] = useState(restaurada)
  const [ventas, setVentas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [errorHistorial, setErrorHistorial] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [confirmada, setConfirmada] = useState(false)
  const [filtroProducto, setFiltroProducto] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const enCurso = useRef(false)

  useEffect(() => observarVentas(tiendaId, resultado => {
    setVentas(resultado); setCargando(false); setErrorHistorial('')
  }, () => { setCargando(false); setErrorHistorial('No pudimos consultar el historial. Revisa la conexión y los permisos de Firebase.') }), [tiendaId])

  const producto = productos.find(p => p.id === formulario.productoId)
  const variantes = producto?.variantes.filter(v => v.active) || []
  const variante = variantes.find(v => v.id === formulario.varianteId)
  const cantidad = Number(formulario.cantidad)
  const unitario = variante?.price ?? producto?.precioBase ?? producto?.precio ?? 0
  const stock = variante?.stock ?? producto?.stock ?? 0
  const requiereVariante = (producto?.variantes.length || 0) > 0
  const valida = producto?.disponible && (!requiereVariante || variante) && Number.isSafeInteger(cantidad) && cantidad > 0 &&
    (producto.manejaStock === false || cantidad <= stock) && (!producto.piezaUnica || cantidad === 1)

  async function confirmar(evento) {
    evento.preventDefault()
    if (enCurso.current || confirmada || (!valida && !pendiente)) return
    enCurso.current = true; setGuardando(true); setError(''); setMensaje('')
    const operacion = pendiente || { operacionId: crypto.randomUUID(), datos: { tiendaId, productoId: formulario.productoId, varianteId: formulario.varianteId, cantidad } }
    try {
      // Persistir antes de enviar permite reintentar la misma operación tras un corte o recarga.
      sessionStorage.setItem(clave, JSON.stringify(operacion))
      setPendiente(operacion)
      await registrarVenta(operacion.datos, operacion.operacionId)
      sessionStorage.removeItem(clave)
      setPendiente(null); setConfirmada(true); setMensaje('Venta registrada. El stock y el historial se actualizaron juntos.')
      try { await actualizarProductos() } catch { setMensaje('Venta registrada. Recarga los productos para ver el stock actualizado.') }
    } catch (err) {
      const terminales = ['permission-denied', 'unauthenticated', 'invalid-argument', 'not-found', 'already-exists', 'inventario/validacion', 'inventario/propiedad']
      if (terminales.includes(err.code)) { sessionStorage.removeItem(clave); setPendiente(null) }
      setError(err.message || 'No pudimos confirmar la venta. Reintenta para comprobar la misma operación sin duplicarla.')
    } finally { enCurso.current = false; setGuardando(false) }
  }

  const nombres = new Map(ventas.map(v => [v.productoId, v.productoNombre]))
  productos.forEach(p => nombres.set(p.id, p.nombre))
  const fechaInvalida = desde && hasta && desde > hasta
  const inicio = desde ? new Date(desde + 'T00:00:00').getTime() : -Infinity
  const fin = hasta ? new Date(hasta + 'T00:00:00') : null
  if (fin) fin.setDate(fin.getDate() + 1)
  const filtradas = fechaInvalida ? [] : ventas.filter(v => {
    const fecha = v.fecha?.toMillis()
    return (!filtroProducto || v.productoId === filtroProducto) && (!desde && !hasta || fecha != null && fecha >= inicio && fecha < (fin?.getTime() ?? Infinity))
  })

  return (
    <section className="panel-emprendedor__ventas panel-emprendedor__tarjeta" aria-labelledby="titulo-ventas">
      <h2 id="titulo-ventas">Ventas</h2>
      <p>Registra lo vendido. El precio se obtiene del producto o la variante y se verifica nuevamente al confirmar.</p>
      <form onSubmit={confirmar}>
        <fieldset disabled={guardando || confirmada || Boolean(pendiente)} className="panel-emprendedor__campos">
          <legend>Registrar venta</legend>
          <label>Producto
            <select value={formulario.productoId} required onChange={e => { setFormulario({productoId:e.target.value, varianteId:'', cantidad:'1'}); setError('') }}>
              <option value="">Selecciona un producto</option>
              {productos.filter(p => p.disponible).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
          {requiereVariante && <label>Variante
            <select value={formulario.varianteId} required onChange={e => setFormulario({...formulario, varianteId:e.target.value})}>
              <option value="">Selecciona una variante</option>
              {variantes.map(v => <option key={v.id} value={v.id}>{v.name} · {v.stock} unidades</option>)}
            </select>
          </label>}
          <label>Cantidad vendida
            <input type="number" min="1" max={producto?.manejaStock === false ? 100000 : stock} step="1" value={formulario.cantidad} required onChange={e => setFormulario({...formulario, cantidad:e.target.value})} />
          </label>
          <label>Precio unitario<input readOnly value={precio(unitario)} /></label>
          <label>Total<input readOnly value={precio(Number.isSafeInteger(cantidad) && cantidad > 0 ? unitario * cantidad : 0)} /></label>
        </fieldset>
        {producto && <p>{producto.manejaStock === false ? 'Producto sin control de stock.' : 'Existencias disponibles: ' + stock}</p>}
        {producto && !valida && !pendiente && !confirmada && <p role="status">Selecciona una variante y una cantidad con stock suficiente. Las piezas únicas se venden de a una.</p>}
        {pendiente && !guardando && <p role="status">Hay una operación pendiente de confirmación. Reinténtala para comprobar su resultado sin descontar dos veces.</p>}
        {error && <p className="panel-emprendedor__alerta-error" role="alert">{error}</p>}
        {mensaje && <p className="panel-emprendedor__alerta-exito" role="status">{mensaje}</p>}
        {!confirmada && <button className="panel-emprendedor__boton-crear" type="submit" disabled={guardando || (!valida && !pendiente)}>{guardando ? 'Confirmando…' : pendiente ? 'Reintentar confirmación' : 'Confirmar venta'}</button>}
        {confirmada && <button type="button" onClick={() => { setConfirmada(false); setFormulario(vacia); setMensaje('') }}>Registrar otra venta</button>}
      </form>
      <h3>Historial de ventas</h3>
      <div className="panel-emprendedor__campos">
        <label>Producto<select value={filtroProducto} onChange={e => setFiltroProducto(e.target.value)}><option value="">Todos los productos</option>{[...nombres].map(([id,nombre]) => <option key={id} value={id}>{nombre}</option>)}</select></label>
        <label>Desde<input type="date" value={desde} onChange={e => setDesde(e.target.value)} /></label>
        <label>Hasta<input type="date" value={hasta} min={desde || undefined} onChange={e => setHasta(e.target.value)} /></label>
      </div>
      {fechaInvalida && <p role="alert">La fecha final debe ser igual o posterior a la inicial.</p>}
      {errorHistorial && <p role="alert">{errorHistorial}</p>}
      {cargando ? <p>Cargando historial…</p> : !errorHistorial && <>
        <p>{filtradas.length} ventas · Total: {precio(filtradas.reduce((n,v) => n + v.total,0))}</p>
        <div className="panel-emprendedor__tabla-ventas">
          <table><caption>Ventas registradas, de más reciente a más antigua</caption>
            <thead><tr><th>Fecha</th><th>Producto</th><th>Variante</th><th>Cantidad</th><th>Precio unitario</th><th>Total</th></tr></thead>
            <tbody>{filtradas.map(v => <tr key={v.id}><td>{v.fecha?.toDate().toLocaleString('es-CL') || 'Confirmando fecha'}</td><td>{v.productoNombre}</td><td>{v.varianteNombre || 'Sin variante'}</td><td>{v.cantidad}</td><td>{precio(v.precioUnitario)}</td><td>{precio(v.total)}</td></tr>)}</tbody>
          </table>
          {!filtradas.length && <p>No hay ventas para estos filtros.</p>}
        </div>
      </>}
    </section>
  )
}
