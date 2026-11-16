import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, query, runTransaction, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore'

// No cargar la configuración de la aplicación ni permitir conexiones remotas.
const projectId = 'demo-bora-w23'
const host = process.env.FIRESTORE_EMULATOR_HOST
if (!host || !/^(127\.0\.0\.1|localhost):\d+$/.test(host)) throw new Error('Se requiere Firestore Emulator local.')
let env
const perfil = (uid, rol = 'administrador', activo = true) => ({ ID: uid, nombre: `Nombre ${uid}`, email: `${uid}@example.test`, rol, activo })
const cliente = (uid = 'principal') => uid === null ? env.unauthenticatedContext().firestore() : env.authenticatedContext(uid).firestore()
const referencia = (uid = 'otro', db = cliente()) => doc(db, 'usuarios', uid)
before(async () => {
  env = await initializeTestEnvironment({ projectId, firestore: { host: host.split(':')[0], port: Number(host.split(':')[1]), rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') } })
})
after(async () => { await env?.cleanup() })
beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const batch = writeBatch(ctx.firestore())
    for (const [uid, rol, activo] of [['principal', 'administrador', true], ['otro', 'administrador', true], ['inactivo', 'administrador', false], ['emprendedora', 'emprendedor', true], ['comprador', 'comprador', true]]) {
      batch.set(doc(ctx.firestore(), 'usuarios', uid), perfil(uid, rol, activo))
    }
    await batch.commit()
  })
})

test('lista administradores activos e inactivos', async () => {
  const resultado = await assertSucceeds(getDocs(query(collection(cliente(), 'usuarios'), where('rol', '==', 'administrador'))))
  assert.equal(resultado.size, 3)
})
test('edicion directa de nombres administrativos se rechaza y conserva campos', async () => {
  for (const uid of ['otro', 'inactivo']) {
    await assertFails(updateDoc(referencia(uid), { nombre: 'Nuevo nombre' }))
    assert.deepEqual((await getDoc(referencia(uid))).data(), perfil(uid, 'administrador', uid !== 'inactivo'))
  }
  await assertFails(updateDoc(referencia(), { nombre: 'a'.repeat(150) }))
})
test('administradores y emprendedoras requieren backend auditado para estados', async () => {
  for (const uid of ['otro']) {
    await assertFails(updateDoc(referencia(uid), { activo: false }))
    await assertFails(updateDoc(referencia(uid), { activo: true }))
    assert.deepEqual((await getDoc(referencia(uid))).data(), perfil(uid, uid === 'otro' ? 'administrador' : 'emprendedor'))
  }
  await assertFails(updateDoc(referencia('emprendedora'), { activo: false }))
  await assertFails(updateDoc(referencia('emprendedora'), { activo: true }))
})
test('rechaza autodesactivacion y autoedicion directas y en lote', async () => {
  await assertFails(updateDoc(referencia('principal'), { activo: false }))
  await assertFails(updateDoc(referencia('principal'), { nombre: 'Propio' }))
  const db = cliente()
  const batch = writeBatch(db)
  batch.update(referencia('principal', db), { activo: false })
  batch.update(referencia('otro', db), { nombre: 'Intento' })
  await assertFails(batch.commit())
})
test('rechaza nombres vacios, espacios Unicode, tipos invalidos, borrado y exceso de longitud', async () => {
  for (const nombre of ['', '  ', '\t\r\n', '\u00a0\u2003\ufeff', 123, null, true, {}, [], 'a'.repeat(151), deleteField()]) {
    await assertFails(updateDoc(referencia(), { nombre }))
  }
})
test('rechaza campos protegidos, adicionales y cambios combinados', async () => {
  for (const cambio of [{ rol: 'comprador' }, { email: 'otro@example.test.invalid' }, { ID: 'falso' }, { uid: 'falso' }, { extra: true }, { nombre: 'Nuevo', activo: false }, { nombre: 'Nuevo', rol: 'comprador' }, { nombre: 'Nuevo', email: deleteField() }, { activo: 'false' }]) {
    await assertFails(updateDoc(referencia(), cambio))
  }
  await assertFails(setDoc(referencia(), { nombre: 'Reemplazo' }))
  await assertFails(deleteDoc(referencia()))
  await assertFails(updateDoc(referencia('emprendedora'), { nombre: 'Cambio' }))
  await assertFails(updateDoc(referencia('comprador'), { nombre: 'Cambio' }))
})
test('rechaza usuarios sin permisos, incluso administrador inactivo con sesion', async () => {
  for (const uid of [null, 'comprador', 'emprendedora', 'inactivo', 'sin-perfil']) {
    const db = cliente(uid)
    await assertFails(updateDoc(referencia('otro', db), { nombre: 'Intento' }))
    await assertFails(updateDoc(referencia('otro', db), { activo: false }))
    await assertFails(getDocs(query(collection(db, 'usuarios'), where('rol', '==', 'administrador'))))
    await assertFails(setDoc(referencia('nuevo', db), perfil('nuevo')))
  }
})
test('bloquea creacion directa de administradores desde el cliente', async () => {
  await assertFails(setDoc(referencia('nuevo'), perfil('nuevo')))
  await assertFails(setDoc(referencia('comprador'), perfil('comprador')))
  await assertFails(setDoc(referencia('nuevo-inactivo'), perfil('nuevo-inactivo', 'administrador', false)))
})
test('intentos concurrentes directos no modifican nombre ni estado', async () => {
  const db = cliente()
  const ref = referencia('otro', db)
  await Promise.all([
    assertFails(updateDoc(ref, { nombre: 'Concurrente' })),
    assertFails(updateDoc(referencia('otro', cliente()), { activo: false })),
  ])
  assert.deepEqual((await getDoc(ref)).data(), perfil('otro'))
})

test('repositorio legado no elude reglas; el exito se valida en integracion HTTP', async () => {
  // Inyectar únicamente dependencias locales: no importar firebase/config de producción.
  const source = readFileSync(new URL('../src/repositories/admin/administradoresRepository.js', import.meta.url), 'utf8')
  const funcion = source.slice(source.indexOf('export async function editarNombreAdministrador')).replace('export ', '')
  const auth = { currentUser: { uid: 'principal' } }
  const editar = new Function('auth', 'db', 'doc', 'runTransaction', `${funcion}; return editarNombreAdministrador`)(auth, cliente(), doc, runTransaction)
  await assertFails(editar('otro', '  Nombre corregido  '))
  assert.deepEqual((await getDoc(referencia())).data(), perfil('otro'))
  await assert.rejects(editar('principal', 'Propio'), /propio/)
  for (const nombre of ['', '  ', null, 123, 'a'.repeat(151)]) await assert.rejects(editar('otro', nombre))
  await assert.rejects(editar('comprador', 'Cambio'))
  await assert.rejects(editar('inexistente', 'Cambio'))
  auth.currentUser = null
  await assert.rejects(editar('otro', 'Cambio'))
  auth.currentUser = { uid: 'inactivo' }
  await assert.rejects(editar('otro', 'Cambio'))
})
