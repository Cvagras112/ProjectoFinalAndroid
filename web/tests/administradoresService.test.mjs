import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Evaluar el servicio real con imports sustituidos por mocks: nunca cargar
// firebase/config ni los SDK, ni requerir credenciales o emuladores.
const original = readFileSync(new URL('../src/services/admin/administradoresService.js', import.meta.url), 'utf8')
assert.match(original, /import \{ httpsCallable \} from 'firebase\/functions'/)
const source = original.replace(/^import .*$/gm, '')
  .replaceAll('import.meta.env', 'env').replace('export async function', 'async function')
const factory = new Function('httpsCallable', 'auth', 'functions', 'env', `${source}; return cambiarPasswordDeAdministrador`)

function preparar({ env = {}, usuario = { uid: 'principal' }, proyecto = 'demo-bora-admin', region = 'us-central1', respuesta = { data: { resultado: 'exito', operacionId: 'operacion-1' } }, fallo, lanzarFallo = fallo !== undefined, otraApp = false } = {}) {
  const app = { options: { projectId: proyecto } }
  const auth = { app: otraApp ? { ...app } : app, currentUser: usuario }
  const functions = { app, region }
  const llamadas = []
  let construcciones = 0
  const servicio = factory((instancia, nombre) => {
    construcciones++
    assert.equal(instancia, functions)
    assert.equal(nombre, 'cambiarPasswordAdministrador')
    return async (datos) => {
      llamadas.push(datos)
      if (lanzarFallo) throw fallo
      return respuesta
    }
  }, auth, functions, { DEV: true, MODE: 'admin-emulator', VITE_ADMIN_EMULATOR: 'true', ...env })
  return { servicio, llamadas, construcciones: () => construcciones }
}

test('invoca el callable con el contrato exacto y devuelve solo resultado e identificador', async () => {
  const p = preparar({ respuesta: { data: { resultado: 'exito', operacionId: 'op_123', password: 'no devolver', token: 'no devolver' } } })
  assert.deepEqual(await p.servicio('otro', '  Clave ficticia  '), { resultado: 'exito', operacionId: 'op_123' })
  assert.deepEqual(p.llamadas, [{ uid: 'otro', password: '  Clave ficticia  ' }])
  assert.equal(p.construcciones(), 1)
})

test('bloquea produccion, modos incorrectos y activacion incompleta antes del SDK', async () => {
  for (const env of [{ DEV: false }, { MODE: 'production' }, { MODE: 'development' }, { VITE_ADMIN_EMULATOR: 'false' }]) {
    const p = preparar({ env })
    await assert.rejects(p.servicio('otro', 'Clave123'), { code: 'admin/emulator-required' })
    assert.equal(p.construcciones(), 0)
  }
})

test('rechaza proyecto, region o instancia de Auth distintos', async () => {
  for (const opciones of [{ proyecto: 'produccion' }, { region: 'otra' }, { otraApp: true }]) {
    const p = preparar(opciones)
    await assert.rejects(p.servicio('otro', 'Clave123'), { code: 'admin/emulator-required' })
    assert.equal(p.construcciones(), 0)
  }
})

test('requiere sesion y bloquea la propia cuenta', async () => {
  for (const [opciones, uid, code] of [[{ usuario: null }, 'otro', 'functions/unauthenticated'], [{}, 'principal', 'functions/permission-denied']]) {
    const p = preparar(opciones)
    await assert.rejects(p.servicio(uid, 'Clave123'), { code })
    assert.equal(p.construcciones(), 0)
  }
})

test('valida UID con los limites del backend', async () => {
  const p = preparar()
  for (const uid of [null, undefined, 3, '', 'a/b', 'u'.repeat(129)]) {
    await assert.rejects(p.servicio(uid, 'Clave123'), { code: 'functions/invalid-argument' })
  }
  assert.equal(p.construcciones(), 0)
  await p.servicio('u'.repeat(128), 'Clave123')
})

test('valida tipo, contenido y limites de password sin recortarla', async () => {
  const p = preparar()
  for (const password of [null, undefined, 12345678, '', 'a'.repeat(7), 'a'.repeat(129), ' '.repeat(8), '\t'.repeat(8)]) {
    await assert.rejects(p.servicio('otro', password), { code: 'functions/invalid-argument' })
  }
  assert.equal(p.construcciones(), 0)
  await p.servicio('otro', 'a'.repeat(8))
  await p.servicio('otro', 'a'.repeat(128))
  assert.equal(p.llamadas.length, 2)
})

test('sanitiza errores conocidos conservando el identificador de operacion', async () => {
  for (const code of ['unauthenticated', 'permission-denied', 'invalid-argument', 'failed-precondition']) {
    const p = preparar({ fallo: { code: `functions/${code}`, message: 'SECRETO', details: { operacionId: 'op-1', password: 'SECRETO' } } })
    await assert.rejects(p.servicio('otro', 'Clave123'), (error) => {
      assert.equal(error.code, `functions/${code}`)
      assert.equal(error.operacionId, 'op-1')
      assert.equal(error.resultadoIncierto, false)
      assert.ok(!JSON.stringify(error).includes('SECRETO'))
      assert.ok(!error.message.includes('SECRETO'))
      assert.equal(error.cause, undefined)
      return true
    })
    assert.equal(p.llamadas.length, 1)
  }
})

test('red, timeout y fallo parcial se consideran inciertos y no se reintentan', async () => {
  for (const code of ['functions/unavailable', 'functions/deadline-exceeded', 'functions/internal', 'desconocido']) {
    const p = preparar({ fallo: { code, message: 'SECRETO', details: { operacionId: 'op-parcial' } } })
    await assert.rejects(p.servicio('otro', 'Clave123'), { code: 'functions/unavailable', operacionId: 'op-parcial', resultadoIncierto: true })
    assert.equal(p.llamadas.length, 1)
    assert.equal(p.construcciones(), 1)
  }
})

test('respuesta incompleta o resultado incierto nunca se presentan como exito', async () => {
  for (const data of [null, {}, { resultado: 'exito' }, { resultado: 'incierto', operacionId: 'op-1' }, { resultado: 'password_cambiada_revocacion_pendiente', operacionId: 'op-2' }]) {
    const p = preparar({ respuesta: { data } })
    await assert.rejects(p.servicio('otro', 'Clave123'), { code: 'functions/unknown', operacionId: data?.operacionId || null, resultadoIncierto: true })
    assert.equal(p.llamadas.length, 1)
  }
})

test('descarta identificadores invalidos y errores nulos sin filtrar detalles', async () => {
  for (const id of ['<script>', 'x'.repeat(129), 17]) {
    const p = preparar({ fallo: { code: 'functions/unavailable', details: { operacionId: id } } })
    await assert.rejects(p.servicio('otro', 'Clave123'), { operacionId: null, resultadoIncierto: true })
  }
  const p = preparar({ fallo: new Error('SECRETO') })
  await assert.rejects(p.servicio('otro', 'Clave123'), { operacionId: null, resultadoIncierto: true })
  const nulo = preparar({ fallo: null })
  await assert.rejects(nulo.servicio('otro', 'Clave123'), { operacionId: null, resultadoIncierto: true })
})
