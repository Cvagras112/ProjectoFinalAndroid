import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const source = readFileSync(new URL('../src/services/admin/administradoresAuditadosService.js', import.meta.url), 'utf8')
  .replace(/^import .*$/gm, '').replaceAll('import.meta.env', 'env').replaceAll('export ', '')
const factory = new Function('httpsCallable', 'auth', 'functions', 'env', `${source};return {editarNombreAdministrador,cambiarEstadoAdministrador,crearAdministradorAuditado};`)
const preparar = (options = {}) => {
  const app = { options: { projectId: options.projectId || 'demo-bora-admin' } }
  const calls = []
  const service = factory((functions, name) => async data => {
    calls.push({ name, data })
    if (options.error) throw options.error
    return options.response || { data: { resultado: 'exito', operacionId: 'op-1', uid: 'nuevo', password: 'NO_DEVOLVER' } }
  }, { app, currentUser: options.sinSesion ? null : { uid: 'actor' } }, { app, region: options.region || 'us-central1' },
  { DEV: true, MODE: 'admin-emulator', VITE_ADMIN_EMULATOR: 'true', ...options.env })
  return { ...service, calls }
}
test('solo modo aislado, proyecto, region y sesion correctos', async () => {
  for (const options of [{ env: { DEV: false } }, { env: { MODE: 'production' } }, { sinSesion: true }, { region: 'otra' }, { projectId: 'produccion' }]) {
    const p = preparar(options)
    await assert.rejects(p.crearAdministradorAuditado('Nombre', 'qa@example.test', 'Clave123'))
    assert.equal(p.calls.length, 0)
  }
})
test('contratos exactos para crear, editar, activar y desactivar', async () => {
  const p = preparar()
  assert.deepEqual(await p.crearAdministradorAuditado('Nombre', 'qa@example.test', 'Clave123'), { resultado: 'exito', uid: 'nuevo', operacionId: 'op-1' })
  await p.editarNombreAdministrador('otro', 'Nombre')
  await p.cambiarEstadoAdministrador('otro', false)
  await p.cambiarEstadoAdministrador('otro', true)
  assert.deepEqual(p.calls.map(c => c.name), ['crearAdministradorConAuditoria', 'operarAdministradorAuditado', 'operarAdministradorAuditado', 'operarAdministradorAuditado'])
  assert.deepEqual(p.calls[1].data, { accion: 'editar', uid: 'otro', nombre: 'Nombre' })
  assert.deepEqual(p.calls[2].data, { accion: 'desactivar', uid: 'otro' })
  assert.deepEqual(p.calls[3].data, { accion: 'activar', uid: 'otro' })
})
test('valida tipos, propia cuenta y contraseñas antes del callable', async () => {
  const p = preparar()
  await assert.rejects(p.editarNombreAdministrador('actor', 'Nombre'))
  await assert.rejects(p.editarNombreAdministrador('otro', 7))
  await assert.rejects(p.cambiarEstadoAdministrador('otro', 'false'))
  await assert.rejects(p.crearAdministradorAuditado(7, 'qa@example.test', 'Clave123'))
  await assert.rejects(p.crearAdministradorAuditado('Nombre', 7, 'Clave123'))
  await assert.rejects(p.crearAdministradorAuditado('Nombre', 'qa@example.test', ' '.repeat(8)))
  assert.equal(p.calls.length, 0)
})
test('errores no filtran datos remotos, conservan operacion y no se reintentan', async () => {
  const p = preparar({ error: { code: 'functions/unavailable', message: 'SECRETO', details: { operacionId: 'op-2', password: 'SECRETO' } } })
  await assert.rejects(p.cambiarEstadoAdministrador('otro', false), e => e.resultadoIncierto && e.operacionId === 'op-2' && !e.message.includes('SECRETO') && !e.cause)
  assert.equal(p.calls.length, 1)
})
test('respuesta incompleta no se considera exito', async () => {
  const p = preparar({ response: { data: { resultado: 'exito' } } })
  await assert.rejects(p.cambiarEstadoAdministrador('otro', false), { resultadoIncierto: true })
})
