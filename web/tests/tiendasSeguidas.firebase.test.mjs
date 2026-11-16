import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} from '@firebase/rules-unit-testing'
import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore'

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Estas pruebas requieren Firestore Emulator.')
}

let env

const cliente = uid => env.authenticatedContext(uid).firestore()

const seguimiento = (db, uid, tiendaId = 'tienda1') =>
  doc(db, 'usuarios', uid, 'tiendasSeguidas', tiendaId)

const datosSeguimiento = (uid, tiendaId = 'tienda1') => ({
  usuarioId: uid,
  tiendaId,
  fecha: serverTimestamp()
})

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-bora-tiendas-seguidas',
    firestore: {
      rules: readFileSync(
        new URL('../../firestore.rules', import.meta.url),
        'utf8'
      )
    }
  })
})

after(async () => {
  await env?.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()

  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore()

    await Promise.all([
      setDoc(doc(db, 'usuarios/comprador1'), {
        rol: 'comprador',
        activo: true
      }),
      setDoc(doc(db, 'usuarios/emprendedor1'), {
        rol: 'emprendedor',
        activo: true
      }),
      setDoc(doc(db, 'usuarios/inactivo'), {
        rol: 'comprador',
        activo: false
      }),
      setDoc(doc(db, 'tiendas/tienda1'), {
        activo: true,
        ID_Dueno: 'emprendedor1'
      }),
      setDoc(doc(db, 'tiendas/tiendaInactiva'), {
        activo: false,
        ID_Dueno: 'emprendedor1'
      })
    ])
  })
})

test('comprador puede seguir una tienda activa', async () => {
  const db = cliente('comprador1')

  await assertSucceeds(
    setDoc(
      seguimiento(db, 'comprador1'),
      datosSeguimiento('comprador1')
    )
  )

  const resultado = await assertSucceeds(
    getDoc(seguimiento(db, 'comprador1'))
  )

  assert.equal(resultado.exists(), true)
})

test('emprendedor puede seguir una tienda activa', async () => {
  const db = cliente('emprendedor1')

  await assertSucceeds(
    setDoc(
      seguimiento(db, 'emprendedor1'),
      datosSeguimiento('emprendedor1')
    )
  )
})

test('usuario puede consultar su lista de tiendas seguidas', async () => {
  const db = cliente('comprador1')

  await assertSucceeds(
    getDocs(collection(db, 'usuarios/comprador1/tiendasSeguidas'))
  )
})

test('usuario no puede consultar seguimientos ajenos', async () => {
  const db = cliente('comprador1')

  await assertFails(
    getDocs(collection(db, 'usuarios/emprendedor1/tiendasSeguidas'))
  )
})

test('usuario no puede crear seguimientos ajenos', async () => {
  const db = cliente('comprador1')

  await assertFails(
    setDoc(
      seguimiento(db, 'emprendedor1'),
      datosSeguimiento('emprendedor1')
    )
  )
})

test('cuenta inactiva no puede seguir tiendas', async () => {
  const db = cliente('inactivo')

  await assertFails(
    setDoc(
      seguimiento(db, 'inactivo'),
      datosSeguimiento('inactivo')
    )
  )
})

test('no se pueden seguir tiendas inexistentes', async () => {
  const db = cliente('comprador1')

  await assertFails(
    setDoc(
      seguimiento(db, 'comprador1', 'noExiste'),
      datosSeguimiento('comprador1', 'noExiste')
    )
  )
})

test('no se pueden seguir tiendas inactivas', async () => {
  const db = cliente('comprador1')

  await assertFails(
    setDoc(
      seguimiento(db, 'comprador1', 'tiendaInactiva'),
      datosSeguimiento('comprador1', 'tiendaInactiva')
    )
  )
})

test('usuario puede dejar de seguir una tienda', async () => {
  const db = cliente('comprador1')

  await assertSucceeds(
    setDoc(
      seguimiento(db, 'comprador1'),
      datosSeguimiento('comprador1')
    )
  )

  await assertSucceeds(
    deleteDoc(seguimiento(db, 'comprador1'))
  )

  const resultado = await getDoc(seguimiento(db, 'comprador1'))

  assert.equal(resultado.exists(), false)
})

test('usuario no puede alterar datos del seguimiento', async () => {
  const db = cliente('comprador1')

  await assertSucceeds(
    setDoc(
      seguimiento(db, 'comprador1'),
      datosSeguimiento('comprador1')
    )
  )

  await assertFails(
    updateDoc(seguimiento(db, 'comprador1'), {
      usuarioId: 'otro'
    })
  )
})

test('sin sesión no se pueden seguir tiendas', async () => {
  const db = env.unauthenticatedContext().firestore()

  await assertFails(
    setDoc(
      seguimiento(db, 'comprador1'),
      datosSeguimiento('comprador1')
    )
  )
})
