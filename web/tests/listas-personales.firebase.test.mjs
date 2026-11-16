import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { SourceTextModule, SyntheticModule } from 'node:vm'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import * as firestore from 'firebase/firestore'
import * as modelo from '../src/services/productos/productoModelo.js'

if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw Error('Solo se permiten pruebas con Firebase Emulator local.')
let env
const perfiles = { comprador: 'comprador', emprendedor: 'emprendedor', emprendedora: 'emprendedora', admin: 'administrador', inactivo: 'comprador' }
const cliente = uid => env.authenticatedContext(uid).firestore()
const ref = (db, uid, lista, id = 'destino') => firestore.doc(db, 'usuarios', uid, lista, id)
const datos = (uid, campo, id = 'destino') => ({ usuarioId: uid, [campo]: id, fecha: firestore.serverTimestamp() })
before(async () => { env = await initializeTestEnvironment({ projectId: 'demo-bora-listas-personales', firestore: { rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8') } }) })
after(async () => { await env?.cleanup() })
beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore(), batch = firestore.writeBatch(db)
    for (const [uid, rol] of Object.entries(perfiles)) batch.set(firestore.doc(db, 'usuarios', uid), { rol, activo: uid !== 'inactivo', email: `${uid}@example.test` })
    batch.set(firestore.doc(db, 'productos/destino'), { ID_Tienda: 'destino', Nombre: 'Taza', Precio: 4000, StockOriginal: 8, Stock: 23, Disponible: true, Variantes: [{ id: 'r', name: 'Roja', price: 3000, stock: 10, active: true }, { id: 'a', name: 'Azul', price: 5000, stock: 5, active: true }] })
    batch.set(firestore.doc(db, 'tiendas/destino'), { nombre: 'Taller del Sur', activo: true, ID_Dueno: 'emprendedor' })
    await batch.commit()
  })
})

async function cargar(archivo, deps) {
  const modulo = new SourceTextModule(await readFile(new URL(archivo, import.meta.url), 'utf8'))
  await modulo.link(async nombre => {
    const valores = deps[nombre]; assert.ok(valores, nombre)
    return new SyntheticModule(Object.keys(valores), function () { for (const [k, v] of Object.entries(valores)) this.setExport(k, v) })
  })
  await modulo.evaluate(); return modulo.namespace
}

async function servicio(uid, tipo, controles = {}) {
  const db = cliente(uid), auth = { currentUser: { uid } }
  const sdk = {
    ...firestore,
    runTransaction: (base, ejecutar) => firestore.runTransaction(base, transaccion => ejecutar(new Proxy(transaccion, {
      get(objeto, clave) {
        if (clave === 'get') return async referencia => {
          const documento = await objeto.get(referencia)
          await controles.lectura?.()
          return documento
        }
        return typeof objeto[clave] === 'function' ? objeto[clave].bind(objeto) : objeto[clave]
      },
    }))),
  }
  const repo = await cargar('../src/repositories/perfil/listasPersonalesRepository.js', { 'firebase/firestore': sdk, '../../firebase/config': { db } })
  const acceso = {
    ...repo,
    guardarReferencia: async (...args) => {
      const resultado = await repo.guardarReferencia(...args)
      await controles.despuesGuardar?.()
      return resultado
    },
  }
  const fabrica = await cargar('../src/services/perfil/listaPersonalService.js', {
    'firebase/auth': { onAuthStateChanged: () => () => {} }, '../../firebase/config': { auth },
    '../../repositories/auth/usuarioRepository': { observarDocumentoCuenta: () => () => {} },
    '../../repositories/perfil/listasPersonalesRepository': acceso,
  })
  const deps = { '../perfil/listaPersonalService': fabrica, '../../repositories/perfil/listasPersonalesRepository': repo }
  if (tipo === 'favoritos') deps['./productoModelo'] = modelo
  else deps['./tiendaPublicaModelo'] = await import('../src/services/tiendas/tiendaPublicaModelo.js')
  const modulo = await cargar(tipo === 'favoritos' ? '../src/services/productos/favoritosService.js' : '../src/services/tiendas/seguimientoService.js', deps)
  return { db, auth, repo, modulo, lista: tipo === 'favoritos' ? modulo.listaFavoritos : modulo.listaSeguimientos }
}

for (const [lista, campo, coleccion] of [['favoritos', 'productoId', 'productos'], ['tiendasSeguidas', 'tiendaId', 'tiendas']]) {
  for (const rol of ['comprador', 'emprendedor', 'emprendedora']) test(`${lista}: ${rol} agrega, consulta, conserva al reingresar y elimina`, async () => {
    const { lista: api, db } = await servicio(rol, lista)
    const antes = (await firestore.getDoc(firestore.doc(db, 'productos/destino'))).data()
    await api.agregar('destino')
    assert.equal(await api.comprobar('destino'), true)
    const guardado = (await firestore.getDoc(ref(db, rol, lista))).data()
    assert.deepEqual(Object.keys(guardado).sort(), [campo, 'fecha', 'usuarioId'].sort())
    assert.equal(guardado[campo], 'destino'); assert.equal(guardado.usuarioId, rol); assert.ok(guardado.fecha instanceof firestore.Timestamp)
    const nuevaSesion = await servicio(rol, lista)
    assert.equal((await nuevaSesion.lista.obtener()).length, 1)
    assert.equal((await (await servicio(rol === 'comprador' ? 'emprendedor' : 'comprador', lista)).lista.obtener()).length, 0)
    await nuevaSesion.lista.quitar('destino'); assert.equal(await nuevaSesion.lista.comprobar('destino'), false)
    assert.deepEqual((await firestore.getDoc(firestore.doc(db, 'productos/destino'))).data(), antes)
  })
  test(`${lista}: creación concurrente e idempotente conserva documento y fecha únicos`, async () => {
    const { lista: api, db } = await servicio('comprador', lista)
    await Promise.all([api.agregar('destino'), api.agregar('destino')])
    const antes = (await firestore.getDoc(ref(db, 'comprador', lista))).data()
    await api.agregar('destino')
    assert.deepEqual((await firestore.getDoc(ref(db, 'comprador', lista))).data(), antes)
    assert.equal((await api.obtener()).length, 1)
  })
  test(`${lista}: una escritura iniciada persiste aunque se desmonten todos los observadores`, async () => {
    let avisarLectura, reanudar
    const lectura = new Promise(resolve => { avisarLectura = resolve })
    const barrera = new Promise(resolve => { reanudar = resolve })
    const { lista: api, db } = await servicio('comprador', lista, { lectura: async () => { avisarLectura(); await barrera } })
    const cancelar = api.suscribir(() => {})
    const escritura = api.agregar('destino')
    await lectura
    cancelar()
    assert.equal((await firestore.getDocFromServer(ref(db, 'comprador', lista))).exists(), false)
    reanudar()
    await escritura
    assert.equal((await firestore.getDocFromServer(ref(db, 'comprador', lista))).data().usuarioId, 'comprador')
    assert.equal((await (await servicio('comprador', lista)).lista.obtener()).length, 1)
  })
  test(`${lista}: cambiar de cuenta durante la lectura cancela la escritura antes de persistir`, async () => {
    let avisarLectura, reanudar
    const lectura = new Promise(resolve => { avisarLectura = resolve })
    const barrera = new Promise(resolve => { reanudar = resolve })
    const { lista: api, db, auth } = await servicio('comprador', lista, { lectura: async () => { avisarLectura(); await barrera } })
    const escritura = api.agregar('destino')
    const rechazada = assert.rejects(escritura, /sesión cambió/)
    await lectura
    auth.currentUser = { uid: 'emprendedor' }
    reanudar()
    await rechazada
    assert.equal((await firestore.getDocFromServer(ref(db, 'comprador', lista))).exists(), false)
    assert.equal((await (await servicio('emprendedor', lista)).lista.obtener()).length, 0)
  })
  test(`${lista}: una eliminación en espera no afecta la lista de la cuenta nueva`, async () => {
    let avisarConfirmacion, reanudar
    const confirmada = new Promise(resolve => { avisarConfirmacion = resolve })
    const barrera = new Promise(resolve => { reanudar = resolve })
    const otra = await servicio('emprendedor', lista)
    await otra.lista.agregar('destino')
    const { lista: api, db, auth } = await servicio('comprador', lista, { despuesGuardar: async () => { avisarConfirmacion(); await barrera } })
    const escritura = api.agregar('destino')
    const retirada = api.quitar('destino')
    const rechazada = assert.rejects(retirada, /sesión cambió/)
    await confirmada
    auth.currentUser = { uid: 'emprendedor' }
    reanudar()
    await escritura
    await rechazada
    assert.equal((await firestore.getDocFromServer(ref(db, 'comprador', lista))).exists(), true)
    assert.equal((await firestore.getDocFromServer(ref(otra.db, 'emprendedor', lista))).exists(), true)
  })
  test(`${lista}: nadie accede, crea o elimina registros ajenos`, async () => {
    const db = cliente('comprador')
    await assertFails(firestore.setDoc(ref(db, 'emprendedor', lista), datos('emprendedor', campo)))
    await assertFails(firestore.getDoc(ref(db, 'emprendedor', lista)))
    await assertFails(firestore.getDocs(firestore.collection(db, 'usuarios/emprendedor/' + lista)))
    await assertFails(firestore.deleteDoc(ref(db, 'emprendedor', lista)))
  })
  for (const uid of ['inactivo', 'admin', 'sin-perfil']) test(`${lista}: ${uid} no puede leer, guardar ni eliminar`, async () => {
    const db = cliente(uid)
    await assertFails(firestore.setDoc(ref(db, uid, lista), datos(uid, campo)))
    await assertFails(firestore.getDoc(ref(db, uid, lista)))
    await assertFails(firestore.getDocs(firestore.collection(db, `usuarios/${uid}/${lista}`)))
    await assertFails(firestore.deleteDoc(ref(db, uid, lista)))
  })
  test(`${lista}: sin sesión no hay lectura ni escritura`, async () => {
    const db = env.unauthenticatedContext().firestore()
    await assertFails(firestore.setDoc(ref(db, 'comprador', lista), datos('comprador', campo)))
    await assertFails(firestore.getDoc(ref(db, 'comprador', lista)))
  })
  test(`${lista}: rechaza destino inexistente, IDs manipulados, campos extra y fechas falsas`, async () => {
    const db = cliente('comprador')
    for (const cambios of [{ [campo]: 'otro' }, { usuarioId: 'otro' }, { campoExtra: true }, { fecha: firestore.Timestamp.fromMillis(0) }, { [campo]: 123 }]) {
      await assertFails(firestore.setDoc(ref(db, 'comprador', lista), { ...datos('comprador', campo), ...cambios }))
    }
    await assertFails(firestore.setDoc(ref(db, 'comprador', lista, 'inexistente'), datos('comprador', campo, 'inexistente')))
    await assertFails(firestore.setDoc(ref(db, 'comprador', lista), { usuarioId: 'comprador', [campo]: 'destino' }))
  })
  test(`${lista}: rechaza updates arbitrarios y permite quitar referencias cuyo destino fue eliminado`, async () => {
    const db = cliente('comprador')
    await assertSucceeds(firestore.setDoc(ref(db, 'comprador', lista), datos('comprador', campo)))
    await assertFails(firestore.updateDoc(ref(db, 'comprador', lista), { usuarioId: 'otro' }))
    await assertFails(firestore.updateDoc(ref(db, 'comprador', lista), { fecha: firestore.serverTimestamp() }))
    await env.withSecurityRulesDisabled(ctx => firestore.deleteDoc(firestore.doc(ctx.firestore(), coleccion, 'destino')))
    assert.equal((await firestore.getDoc(ref(db, 'comprador', lista))).exists(), true)
    await assertSucceeds(firestore.deleteDoc(ref(db, 'comprador', lista)))
  })
  for (const cambios of [{ activo: false }, { rol: 'administrador' }]) test(`${lista}: revocar cuenta o rol bloquea una lista previamente guardada ${JSON.stringify(cambios)}`, async () => {
    const db = cliente('comprador')
    await firestore.setDoc(ref(db, 'comprador', lista), datos('comprador', campo))
    await env.withSecurityRulesDisabled(ctx => firestore.updateDoc(firestore.doc(ctx.firestore(), 'usuarios/comprador'), cambios))
    await assertFails(firestore.getDocs(firestore.collection(db, 'usuarios/comprador/' + lista)))
    await assertFails(firestore.deleteDoc(ref(db, 'comprador', lista)))
  })
}

test('detalles reales: producto agotado, oculto o eliminado no se confunden ni pierden su referencia', async () => {
  const { modulo } = await servicio('comprador', 'favoritos')
  await env.withSecurityRulesDisabled(async ctx => {
    await firestore.setDoc(firestore.doc(ctx.firestore(), 'productos/oculto'), { Nombre: 'Oculto', ID_Tienda: 'destino', Precio: 3000, Stock: 0, Disponible: false })
    await firestore.setDoc(firestore.doc(ctx.firestore(), 'productos/agotado'), { Nombre: 'Agotado', ID_Tienda: 'destino', Precio: 2000, Stock: 0, Disponible: true })
  })
  const resultados = await modulo.obtenerDetallesFavoritos(['destino', 'oculto', 'agotado', 'eliminado'])
  assert.deepEqual([...resultados].map(r => r.estado), ['publicado', 'no-disponible', 'publicado', 'eliminado'])
  assert.equal(resultados[0].precio, 4000); assert.equal(resultados[0].stockOriginal, 8); assert.equal(resultados[0].stock, 23)
  assert.equal(resultados[0].tienda, 'Taller del Sur')
})

test('favorito y eliminación del producto en un mismo lote se rechazan sin modificar documentos', async () => {
  await env.withSecurityRulesDisabled(ctx => firestore.setDoc(firestore.doc(ctx.firestore(), 'emprendedores/emprendedor'), { activo: true, ID_Tienda: 'destino' }))
  const db = cliente('emprendedor'), batch = firestore.writeBatch(db)
  batch.set(ref(db, 'emprendedor', 'favoritos'), datos('emprendedor', 'productoId'))
  batch.delete(firestore.doc(db, 'productos/destino'))
  await assertFails(batch.commit())
  assert.equal((await firestore.getDoc(firestore.doc(db, 'productos/destino'))).exists(), true)
  assert.equal((await firestore.getDoc(ref(db, 'emprendedor', 'favoritos'))).exists(), false)
})

test('guardar favorito no permite manipular precio o stock en el mismo lote', async () => {
  const db = cliente('comprador'), producto = firestore.doc(db, 'productos/destino')
  const antes = (await firestore.getDoc(producto)).data(), batch = firestore.writeBatch(db)
  batch.set(ref(db, 'comprador', 'favoritos'), datos('comprador', 'productoId'))
  batch.update(producto, { Precio: 1, StockOriginal: 999, Stock: 999 })
  await assertFails(batch.commit())
  assert.deepEqual((await firestore.getDoc(producto)).data(), antes)
  assert.equal((await firestore.getDoc(ref(db, 'comprador', 'favoritos'))).exists(), false)
})

test('tiendas seguidas: inactivas y eliminadas permanecen visibles como no disponibles y se pueden quitar', async () => {
  const { lista, modulo } = await servicio('comprador', 'tiendasSeguidas')
  await lista.agregar('destino')
  await env.withSecurityRulesDisabled(ctx => firestore.updateDoc(firestore.doc(ctx.firestore(), 'tiendas/destino'), { activo: false }))
  const [inactiva] = await modulo.obtenerDetallesTiendasSeguidas(['destino'])
  assert.equal(inactiva.estado, 'no-disponible')
  await lista.quitar('destino')
  const [eliminada] = await modulo.obtenerDetallesTiendasSeguidas(['eliminada'])
  assert.equal(eliminada.nombre, 'Tienda eliminada'); assert.equal(eliminada.estado, 'no-disponible')
})
