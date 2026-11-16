import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const leer = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const source = leer('../src/services/admin/asignacionesEmprendedorasService.js')
  .replace(/^import .*$/gm, '').replaceAll('import.meta.env', 'env').replaceAll('export ', '')
const factory = new Function('httpsCallable', 'auth', 'functions', 'env', 'crypto', `${source};return ejecutarOperacionEmprendedoras;`)
function preparar({ env = {}, uid = 'admin', remote = async () => ({ data: { resultado: 'exito', elementoId: 'emp', operacionId: 'op' } }) } = {}) {
  const app = { options: { projectId: 'demo-bora-admin' } }
  const calls = []
  const ejecutar = factory((functions, nombre) => async datos => { calls.push({ nombre, datos }); return remote(datos) },
    { app, currentUser: uid ? { uid } : null }, { app, region: 'us-central1' },
    { DEV: true, MODE: 'admin-emulator', VITE_ADMIN_EMULATOR: 'true', ...env }, { randomUUID })
  return { ejecutar, calls }
}

test('bloquea produccion, modo incompleto, falta de sesion y operaciones ajenas', async () => {
  for (const options of [{ env: { DEV: false } }, { env: { MODE: 'production' } }, { env: { VITE_ADMIN_EMULATOR: 'false' } }, { uid: null }]) {
    const p = preparar(options)
    await assert.rejects(p.ejecutar('quitarAsignacionAdministrativa', { id: 'emp' }))
    assert.equal(p.calls.length, 0)
  }
  const p = preparar()
  await assert.rejects(p.ejecutar('crearEmprendedora', {}))
  assert.equal(p.calls.length, 0)
})

test('deduplica llamadas concurrentes sin reintentos automaticos', async () => {
  let terminar
  const p = preparar({ remote: () => new Promise(resolve => { terminar = resolve }) })
  const uno = p.ejecutar('quitarAsignacionAdministrativa', { id: 'emp' })
  const dos = p.ejecutar('quitarAsignacionAdministrativa', { id: 'emp' })
  await Promise.resolve()
  assert.equal(p.calls.length, 1)
  terminar({ data: { resultado: 'exito', elementoId: 'emp', operacionId: 'op' } })
  assert.deepEqual(await uno, await dos)
})

test('resultado incierto preserva clave para repeticion manual y sanitiza errores', async () => {
  let intento = 0
  const p = preparar({ remote: async () => {
    if (++intento === 1) throw { code: 'functions/unavailable', message: 'SECRETO', details: { operacionId: 'op-1' } }
    return { data: { resultado: 'exito', elementoId: 'emp', operacionId: 'op-1' } }
  } })
  await assert.rejects(p.ejecutar('quitarAsignacionAdministrativa', { id: 'emp' }), e => e.message.includes('op-1') && !e.message.includes('SECRETO') && !e.cause)
  assert.equal(p.calls.length, 1)
  await p.ejecutar('quitarAsignacionAdministrativa', { id: 'emp' })
  assert.equal(p.calls[0].datos.solicitudId, p.calls[1].datos.solicitudId)
  for (const code of ['unauthenticated', 'permission-denied', 'invalid-argument', 'failed-precondition', 'not-found', 'already-exists']) {
    const caso = preparar({ remote: async () => { throw { code: `functions/${code}`, message: 'SECRETO' } } })
    await assert.rejects(caso.ejecutar('quitarAsignacionAdministrativa', { id: 'emp' }), e => !e.message.includes('SECRETO'))
  }
})

test('respuesta no confirmada no se presenta como exito', async () => {
  const p = preparar({ remote: async () => ({ data: { resultado: 'incierto' } }) })
  await assert.rejects(p.ejecutar('quitarAsignacionAdministrativa', { id: 'emp' }), /no confirmado/)
  assert.equal(p.calls.length, 1)
})

test('repositorios conservan firmas y delegan las cuatro mutaciones al backend', async () => {
  const calls = []
  const mock = async (nombre, datos) => { calls.push({ nombre, datos }); return { resultado: 'exito' } }
  const asignaciones = leer('../src/repositories/admin/asignacionesRepository.js').replace(/^import .*$/gm, '').replaceAll('export ', '')
  const a = new Function('ejecutarOperacionEmprendedoras', `${asignaciones};return {guardarAsignacion,quitarAsignacion};`)(mock)
  await a.guardarAsignacion('emp', 'asoc')
  await a.quitarAsignacion('emp')
  const emprendedoras = leer('../src/repositories/admin/emprendedorasRepository.js').replace(/^import .*$/gm, '').replaceAll('export ', '')
  const e = new Function('ejecutarOperacionEmprendedoras', `${emprendedoras};return {editarPerfilEmprendedora,cambiarEstadoEmprendedora};`)(mock)
  await e.editarPerfilEmprendedora('emp', { nombre: 'Nombre', telefono: '' })
  await e.cambiarEstadoEmprendedora('emp', false)
  assert.deepEqual(calls, [
    { nombre: 'guardarAsignacionAdministrativa', datos: { id: 'emp', asociacionId: 'asoc' } },
    { nombre: 'quitarAsignacionAdministrativa', datos: { id: 'emp' } },
    { nombre: 'editarPerfilEmprendedoraAdministrativa', datos: { id: 'emp', nombre: 'Nombre', telefono: '' } },
    { nombre: 'cambiarEstadoEmprendedoraAdministrativa', datos: { id: 'emp', activo: false } },
  ])
  assert.ok(!/setDoc|updateDoc|deleteDoc/.test(asignaciones))
})

test('alta existente conserva lote de tres documentos y no llama al nuevo servicio', async () => {
  const codigo = leer('../src/repositories/admin/emprendedorasRepository.js').replace(/^import .*$/gm, '').replaceAll('export ', '')
  const writes = []
  let commits = 0
  const crear = new Function('db', 'doc', 'writeBatch', 'ejecutarOperacionEmprendedoras', `${codigo};return crearDocumentosEmprendedora;`)(
    {}, (_, coleccion, id) => `${coleccion}/${id}`, () => ({ set: (ref, data) => writes.push({ ref, data }), commit: async () => commits++ }),
    () => assert.fail('El alta no debe usar los nuevos callables'),
  )
  await crear('emp', { nombre: 'Nombre', email: 'emp@example.test', telefono: '', nombreTienda: 'Tienda', categoria: 'Artesania', descripcion: '' })
  assert.equal(commits, 1)
  assert.deepEqual(writes.map(w => w.ref), ['usuarios/emp', 'emprendedores/emp', 'tiendas/emp'])
})
