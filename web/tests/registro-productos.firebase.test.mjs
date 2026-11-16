import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, setDoc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { guardarProductoTransaccion } from '../src/services/productos/inventarioTransacciones.js'
import { prepararProducto } from '../src/services/productos/inventarioModelo.js'
import { normalizarProducto } from '../src/services/productos/productoModelo.js'

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Usa exclusivamente Firestore Emulator.')
let env
const base = { Nombre: 'Chal', Categoria: 'Textil', Descripcion: 'Tejido a mano.', Precio: 12000, Stock: 3, imagen: 'https://example.test/chal.png', Disponible: true }
const variantes = cantidad => Array.from({ length: cantidad }, (_, i) => ({ id: 'v' + i, name: 'Variante ' + i, price: 1000 + i, stock: 2, imageUrl: '', imagePath: '', active: true }))
const crudo = cantidad => ({ ...prepararProducto({ ...base, Variantes: variantes(cantidad) }), ID_Producto: 'p', ID_Tienda: 't', ActualizadoEn: serverTimestamp() })
const cliente = uid => env.authenticatedContext(uid).firestore()
const escribir = (datos, uid = 'duena') => setDoc(doc(cliente(uid), 'productos/p'), datos)

async function prepararCuentas(entorno) {
  await entorno.withSecurityRulesDisabled(async contexto => {
    const db = contexto.firestore(), batch = writeBatch(db)
    for (const [uid, tiendaId] of [['duena', 't'], ['otra', 'otra-tienda']]) {
      batch.set(doc(db, 'usuarios', uid), { rol: 'emprendedor', activo: true })
      batch.set(doc(db, 'emprendedores', uid), { ID_Tienda: tiendaId, activo: true })
      batch.set(doc(db, 'tiendas', tiendaId), { ID_Dueno: uid, activo: true })
    }
    await batch.commit()
  })
}

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-bora-registro', firestore: {
    rules: readFileSync(process.env.BORA_RULES_FILE || new URL('../../firestore.rules', import.meta.url), 'utf8'),
  } })
})
beforeEach(async () => { await env.clearFirestore(); await prepararCuentas(env) })
after(async () => { await env?.cleanup() })

for (let cantidad = 0; cantidad <= 5; cantidad++) {
  test(`crear con ${cantidad} variantes: persiste y se lee públicamente`, async () => {
    await guardarProductoTransaccion(cliente('duena'), 'duena', {
      tiendaId: 't', productoId: 'p', revision: null, datos: { ...base, Variantes: variantes(cantidad) },
    })
    const documento = await getDoc(doc(env.unauthenticatedContext().firestore(), 'productos/p'))
    assert.equal(documento.exists(), true)
    const datos = documento.data()
    assert.equal(datos.ID_Tienda, 't')
    assert.equal(datos.ID_Producto, 'p')
    assert.equal(datos.Revision, 1)
    assert.equal(datos.Stock, cantidad ? cantidad * 2 : base.Stock)
    assert.equal(datos.Variantes.length, cantidad)
    assert.ok(datos.ActualizadoEn)
    const publico = normalizarProducto(datos, documento.id)
    assert.equal(publico.nombre, base.Nombre)
    assert.equal(publico.imagen, base.imagen)
    assert.equal(publico.descripcion, base.Descripcion)
    assert.equal(publico.categoria, base.Categoria)
    assert.equal(publico.precio, base.Precio)
    assert.equal(publico.visible, true)
  })
}

test('cuenta ajena activa y visitante no pueden crear en la tienda de la dueña', async () => {
  await assertFails(escribir(crudo(5), 'otra'))
  await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'productos/p'), crudo(0)))
  assert.equal((await getDoc(doc(cliente('duena'), 'productos/p'))).exists(), false)
})

test('reglas rechazan seis o más variantes incluso si el cliente omite la validación web', async () => {
  for (const cantidad of [6,7,10,11]) {
    const datos = crudo(5)
    datos.Variantes = variantes(cantidad)
    datos.Stock = cantidad * 2
    await assertFails(escribir(datos))
    assert.equal((await getDoc(doc(cliente('duena'), 'productos/p'))).exists(), false)
  }
  await assertSucceeds(escribir(crudo(5)))
  const edicion = crudo(5)
  edicion.Variantes = variantes(6)
  edicion.Stock = 12
  edicion.Revision = 2
  await assertFails(escribir(edicion))
  assert.equal((await getDoc(doc(cliente('duena'), 'productos/p'))).data().Variantes.length, 5)
})

test('cinco variantes conservan precios, fotografías y stock independientes al crear y editar', async () => {
  const opciones = variantes(5).map((v,i) => ({ ...v, stock:i+1, imageUrl:`https://example.test/${i}.png` }))
  const db = cliente('duena')
  await guardarProductoTransaccion(db, 'duena', {tiendaId:'t',productoId:'p',revision:null,datos:{...base,Variantes:opciones}})
  const referencia = doc(db,'productos/p')
  const creado = (await getDoc(referencia)).data()
  assert.deepEqual(creado.Variantes, opciones)
  const editadas = opciones.map((v,i) => i===4 ? {...v,price:25000,imageUrl:'https://example.test/nueva.png',stock:7} : v)
  await guardarProductoTransaccion(db, 'duena', {tiendaId:'t',productoId:'p',revision:1,datos:{...base,Variantes:editadas}})
  const editado = (await getDoc(referencia)).data()
  assert.deepEqual(editado.Variantes, editadas)
  assert.equal(editado.Stock,17)
  assert.equal(editado.Revision,2)
})

test('todos los índices de cinco variantes validan campos obligatorios, tipos y límites', async () => {
  for (let indice = 0; indice < 5; indice++) {
    for (const [campo, valor] of [['price', 0], ['price', 1.5], ['price', '1000'], ['stock', -1], ['stock', 100001], ['stock', '2'], ['name', false], ['active', 1], ['id', 'a/b'], ['imageUrl', 'javascript:alert(1)'], ['imagePath', false]]) {
      const datos = crudo(5)
      datos.Variantes[indice][campo] = valor
      await assertFails(escribir(datos))
    }
    for (const campo of ['id', 'name', 'price', 'stock', 'imageUrl', 'imagePath', 'active']) {
      const datos = crudo(5)
      delete datos.Variantes[indice][campo]
      datos.Variantes[indice].intruso = 'x'
      await assertFails(escribir(datos))
    }
  }
})

test('cinco variantes: rechaza IDs repetidos, stock total falso, campos extra y seis variantes', async () => {
  let datos = crudo(5)
  datos.Variantes[4].id = datos.Variantes[0].id
  await assertFails(escribir(datos))
  datos = crudo(5); datos.Stock++
  await assertFails(escribir(datos))
  datos = crudo(5); datos.Variantes[4].intruso = true
  await assertFails(escribir(datos))
  datos = crudo(5); datos.ManejaStock = false
  await assertFails(escribir(datos))
  datos = crudo(5); datos.Variantes.push({ ...datos.Variantes[4], id: 'v5' }); datos.Stock += 2
  await assertFails(escribir(datos))
})

test('cinco variantes admiten los límites exactos sin exceder la evaluación de reglas', async () => {
  const datos = crudo(5)
  datos.Variantes = datos.Variantes.map((v, i) => ({ ...v,
    id: String(i) + 'i'.repeat(63), name: 'n'.repeat(150), price: 999999999, stock: 100000,
    imageUrl: 'https://' + 'a'.repeat(1992), imagePath: 'r'.repeat(512),
  }))
  datos.Stock = 500000
  await assertSucceeds(escribir(datos))
  assert.equal((await getDoc(doc(cliente('duena'), 'productos/p'))).data().Variantes.length, 5)
})

test('variantes inactivas mantienen validación y solo las activas aportan stock', async () => {
  const datos = crudo(5)
  datos.Variantes = datos.Variantes.map((v, i) => ({ ...v, active: i % 2 === 0, stock: 100000 }))
  datos.Stock = 300000
  await assertSucceeds(escribir(datos))
  const invalido = crudo(5)
  invalido.Variantes = invalido.Variantes.map(v => ({ ...v, stock: 100000 }))
  invalido.Variantes[4].active = false
  invalido.Variantes[4].price = 0
  invalido.Stock = 400000
  await assertFails(escribir({ ...invalido, Revision: 2 }))
})

test('una variante inválida no puede compensarse con stock válido en los otros cuatro índices', async () => {
  for (let indice = 0; indice < 5; indice++) {
    const datos = crudo(5)
    datos.Variantes = datos.Variantes.map(v => ({ ...v, stock: 100000 }))
    datos.Variantes[indice].price = 0
    for (const stock of [0, 400000, 500000]) {
      await assertFails(escribir({ ...datos, Stock: stock }))
    }
  }
})

test('regresión histórica de registro: las reglas anteriores rechazaban los metadatos de inventario', {
  skip: !process.env.BORA_PUBLISHED_RULES_FILE && 'Requiere la copia histórica anterior a la publicación del inventario.',
}, async () => {
  const publicadas = await initializeTestEnvironment({ projectId: 'demo-bora-reglas-publicadas', firestore: {
    rules: readFileSync(process.env.BORA_PUBLISHED_RULES_FILE, 'utf8'),
  } })
  try {
    await prepararCuentas(publicadas)
    const db = publicadas.authenticatedContext('duena').firestore()
    await assertSucceeds(setDoc(doc(db, 'productos/antiguo'), { ...base, ID_Producto: 'antiguo', ID_Tienda: 't' }))
    for (const cantidad of [0, 1, 3, 5]) {
      const id = 'actual-' + cantidad
      await assertFails(guardarProductoTransaccion(db, 'duena', {
        tiendaId: 't', productoId: id, revision: null, datos: { ...base, Variantes: variantes(cantidad) },
      }))
      assert.equal((await getDoc(doc(db, 'productos', id))).exists(), false)
    }
  } finally {
    await publicadas.cleanup()
  }
})
