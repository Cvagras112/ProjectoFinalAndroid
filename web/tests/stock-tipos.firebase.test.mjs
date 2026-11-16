import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { createMockUserToken } from '@firebase/util'
import { doc, getDocFromServer, getDocsFromServer, collection, writeBatch, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { guardarProductoTransaccion, registrarVentaTransaccion } from '../src/services/productos/inventarioTransacciones.js'
import { prepararVenta } from '../src/services/productos/inventarioModelo.js'

// Nunca enviar estas solicitudes REST a una base real.
assert.match(process.env.FIRESTORE_EMULATOR_HOST || '', /^(127\.0\.0\.1|localhost):\d+$/)
const proyecto = 'demo-bora-stock-tipos'
const documentos = `projects/${proyecto}/databases/(default)/documents/`
const endpoint = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/`
const token = createMockUserToken({ sub: 'duena', iat: Math.floor(Date.now() / 1000) }, proyecto)
let env, db

before(async () => {
  env = await initializeTestEnvironment({ projectId: proyecto, firestore: {
    rules: readFileSync(process.env.BORA_RULES_FILE || new URL('../../firestore.rules', import.meta.url), 'utf8'),
  } })
  db = env.authenticatedContext('duena').firestore()
})
after(async () => { await env?.cleanup() })
beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async ctx => {
    const d = ctx.firestore(), batch = writeBatch(d)
    for (const [ruta, datos] of Object.entries({
      'usuarios/duena': { rol: 'emprendedor', activo: true },
      'emprendedores/duena': { ID_Tienda: 't', activo: true },
      'tiendas/t': { ID_Dueno: 'duena', activo: true },
    })) batch.set(doc(d, ruta), datos)
    await batch.commit()
  })
})

async function crear({ cantidad = 2, legado = false, inactiva = false, ...opciones } = {}) {
  await guardarProductoTransaccion(db, 'duena', { tiendaId: 't', productoId: 'p', revision: null, datos: {
    Nombre: 'Taza', Categoria: 'Cerámica', Precio: 4000, StockOriginal: 2,
    Variantes: Array.from({ length: cantidad }, (_, i) => ({
      id: 'v' + i, name: 'Variante ' + i, price: 3000 + i, stock: 2, active: !inactiva || i !== cantidad - 1,
    })), ...opciones,
  } })
  if (legado) await env.withSecurityRulesDisabled(async ctx => {
    const referencia = doc(ctx.firestore(), 'productos/p'), p = (await getDocFromServer(referencia)).data()
    delete p.StockOriginal
    if (p.Variantes.length) p.Stock = p.Variantes.filter(v => v.active).reduce((n, v) => n + v.stock, 0)
    await setDoc(referencia, p)
  })
}
const vender = (varianteId = '', operacionId = 'op') => registrarVentaTransaccion(db, 'duena', {
  tiendaId: 't', productoId: 'p', varianteId, operacionId, cantidad: 1,
})
async function estado() {
  let resultado
  await env.withSecurityRulesDisabled(async ctx => {
    const d = ctx.firestore()
    const [producto, ventas, recibos] = await Promise.all([
      getDocFromServer(doc(d, 'productos/p')),
      getDocsFromServer(collection(d, 'ventas')),
      getDocsFromServer(collection(d, 'movimientosInventario/duena/operaciones')),
    ])
    resultado = { producto: producto.data(), ventas: ventas.docs.map(d => ({ id: d.id, ...d.data() })), recibos: recibos.docs.map(d => ({ id: d.id, ...d.data() })) }
  })
  return resultado
}

// El SDK convierte Number(1.0) en int. REST permite probar el tipo double real.
function valorREST(v) {
  if (typeof v === 'string') return { stringValue: v }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return { integerValue: String(v) }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(valorREST) } }
  return { mapValue: { fields: camposREST(v) } }
}
const camposREST = datos => Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, valorREST(v)]))
async function commitREST(writes, credencial = token) {
  const respuesta = await fetch(`${endpoint}projects/${proyecto}/databases/(default)/documents:commit`, {
    method: 'POST', headers: { Authorization: `Bearer ${credencial}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes }),
  })
  return { status: respuesta.status, datos: await respuesta.json() }
}
async function documentoREST() {
  const respuesta = await fetch(endpoint + documentos + 'productos/p', { headers: { Authorization: `Bearer ${token}` } })
  assert.equal(respuesta.status, 200)
  return respuesta.json()
}
const stockVarianteREST = (campos, i) => campos.Variantes.arrayValue.values[i].mapValue.fields

async function ventaREST({ varianteId = '', modificar = () => {}, omitirOriginal = false } = {}) {
  const { producto } = await estado(), { cambios, venta } = prepararVenta(producto, { varianteId, cantidad: 1 })
  if (omitirOriginal) delete cambios.StockOriginal
  const campos = camposREST({ ...cambios, UltimaVenta: 'duena_op' })
  modificar(campos, producto)
  const crearDocumento = (ruta, datos, fecha) => ({
    update: { name: documentos + ruta, fields: camposREST(datos) }, currentDocument: { exists: false },
    updateTransforms: [{ fieldPath: fecha, setToServerValue: 'REQUEST_TIME' }],
  })
  return commitREST([
    { update: { name: documentos + 'productos/p', fields: campos }, updateMask: { fieldPaths: Object.keys(campos) },
      currentDocument: { exists: true }, updateTransforms: [{ fieldPath: 'ActualizadoEn', setToServerValue: 'REQUEST_TIME' }] },
    crearDocumento('ventas/duena_op', {
      ...venta, productoId: 'p', tiendaId: 't', usuarioId: 'duena', operacionId: 'op',
      indiceVariante: producto.Variantes.findIndex(v => v.id === varianteId),
    }, 'fecha'),
    crearDocumento('movimientosInventario/duena/operaciones/op', {
      productoId: 'p', tiendaId: 't', varianteId, cantidad: 1, ventaId: 'duena_op',
    }, 'fecha'),
  ])
}
async function rechazarSinCambios(opciones) {
  const antes = await estado(), respuesta = await ventaREST(opciones)
  assert.equal(respuesta.status, 403, JSON.stringify(respuesta.datos))
  assert.equal(respuesta.datos.error.status, 'PERMISSION_DENIED')
  assert.deepEqual(await estado(), antes, 'Una venta rechazada no debe dejar escrituras parciales.')
}
async function comprobarEnteros() {
  const { fields } = await documentoREST()
  assert.ok('integerValue' in fields.Stock)
  if (fields.StockOriginal) assert.ok('integerValue' in fields.StockOriginal)
  for (const v of fields.Variantes.arrayValue.values || []) assert.ok('integerValue' in v.mapValue.fields.stock)
}

test('REST: rechaza double 1.0 en la variante seleccionada sin escrituras parciales', async () => {
  await crear()
  await rechazarSinCambios({ varianteId: 'v0', modificar: campos => { stockVarianteREST(campos, 0).stock = { doubleValue: 1.0 } } })
  const respuesta = await ventaREST({ varianteId: 'v0' })
  assert.equal(respuesta.status, 200, JSON.stringify(respuesta.datos))
  await comprobarEnteros()
  const despues = await estado()
  assert.equal(despues.producto.StockOriginal, 2)
  assert.deepEqual(despues.producto.Variantes.map(v => v.stock), [1, 2])
  assert.equal(despues.producto.Stock, 5)
  assert.equal(despues.ventas.length, 1); assert.equal(despues.recibos.length, 1)
  assert.equal((await vender('v0')).repetida, true)
  assert.deepEqual(await estado(), despues)
  await updateDoc(doc(db, 'productos/p'), { Nombre: 'Taza actualizada', Revision: 3, ActualizadoEn: serverTimestamp() })
})

for (let indice = 0; indice < 5; indice++) {
  test(`original: rechaza double en stock de variante ${indice}, incluida la inactiva`, async () => {
    await crear({ cantidad: 5, inactiva: true })
    await rechazarSinCambios({ modificar: (campos, p) => {
      campos.Variantes = valorREST(p.Variantes)
      stockVarianteREST(campos, indice).stock = { doubleValue: 2.0 }
    } })
    await vender(); await comprobarEnteros()
  })
}
for (let indice = 1; indice < 5; indice++) {
  test(`variante: rechaza double en otra opción ${indice}, incluida la inactiva`, async () => {
    await crear({ cantidad: 5, inactiva: true })
    await rechazarSinCambios({ varianteId: 'v0', modificar: campos => { stockVarianteREST(campos, indice).stock = { doubleValue: 2.0 } } })
    await vender('v0'); await comprobarEnteros()
  })
}

for (const cantidad of [0, 2]) for (const varianteId of (cantidad ? ['', 'v0'] : [''])) {
  for (const campo of ['Stock', 'StockOriginal']) {
    test(`${cantidad} variantes, venta ${varianteId || 'original'}: ${campo} exige int`, async () => {
      await crear({ cantidad })
      await rechazarSinCambios({ varianteId, modificar: campos => { campos[campo] = { doubleValue: Number(campos[campo].integerValue) } } })
      await vender(varianteId); await comprobarEnteros()
    })
  }
}
for (const campo of ['Stock', 'StockOriginal']) {
  test(`sin control de stock: ${campo} sigue exigiendo int`, async () => {
    await crear({ cantidad: 0, ManejaStock: false })
    await rechazarSinCambios({ modificar: campos => { campos[campo] = { doubleValue: 2.0 } } })
    await vender(); await comprobarEnteros()
    assert.equal((await estado()).producto.Stock, 2)
  })
}

test('documento antiguo sin variantes: Stock double 1.0 se rechaza aun sin StockOriginal', async () => {
  await crear({ cantidad: 0, legado: true })
  await rechazarSinCambios({ omitirOriginal: true, modificar: campos => { campos.Stock = { doubleValue: 1.0 } } })
  await vender(); await comprobarEnteros()
})
test('documento antiguo con variantes: rechaza double sin exigir conversión de esquema', async () => {
  await crear({ legado: true })
  await rechazarSinCambios({ varianteId: 'v0', omitirOriginal: true, modificar: campos => { stockVarianteREST(campos, 0).stock = { doubleValue: 1.0 } } })
  assert.equal((await ventaREST({ varianteId: 'v0', omitirOriginal: true })).status, 200)
  await comprobarEnteros()
  assert.equal((await estado()).producto.StockOriginal, undefined)
})
test('pieza única: double no deja venta ni cambia estado; una venta int bloquea todo', async () => {
  await crear({ PiezaUnica: true })
  await rechazarSinCambios({ varianteId: 'v0', modificar: campos => { stockVarianteREST(campos, 0).stock = { doubleValue: 1.0 } } })
  await vender('v0'); await comprobarEnteros()
  const final = await estado()
  assert.equal(final.producto.Vendido, true); assert.equal(final.producto.Disponible, false)
  assert.equal((await vender('v0')).repetida, true)
  await assert.rejects(vender('', 'segunda'), /no está disponible/)
  assert.deepEqual(await estado(), final)
})

test('no permite modificar existencias de otra variante aunque ambos stocks sean int', async () => {
  await crear()
  await rechazarSinCambios({ varianteId: 'v0', modificar: campos => { stockVarianteREST(campos, 1).stock = { integerValue: '1' } } })
  await vender('v0'); await comprobarEnteros()
})

test('documento heredado con double integral: requiere normalizar antes de conservar ese stock en una venta', async () => {
  await crear()
  const p = (await estado()).producto, variantes = valorREST(p.Variantes)
  variantes.arrayValue.values[1].mapValue.fields.stock = { doubleValue: 2.0 }
  // Fixture histórica con reglas deshabilitadas, exclusivamente en Emulator.
  let carga
  await env.withSecurityRulesDisabled(async () => {
    carga = await commitREST([{ update: { name: documentos + 'productos/p', fields: { Variantes: variantes } }, updateMask: { fieldPaths: ['Variantes'] } }], 'owner')
  })
  assert.equal(carga.status, 200)
  assert.ok('doubleValue' in (await documentoREST()).fields.Variantes.arrayValue.values[1].mapValue.fields.stock)
  const antes = await estado()
  await assert.rejects(vender(), e => e.code === 'permission-denied')
  assert.deepEqual(await estado(), antes)
  // La edición completa ya existente reserializa los números integrales como int.
  await guardarProductoTransaccion(db, 'duena', { tiendaId: 't', productoId: 'p', revision: 1, datos: {} })
  await comprobarEnteros()
  assert.deepEqual((await estado()).producto.Variantes.map(v => v.stock), [2, 2])
  await vender(); await comprobarEnteros()
  assert.equal((await estado()).producto.StockOriginal, 1)
})
