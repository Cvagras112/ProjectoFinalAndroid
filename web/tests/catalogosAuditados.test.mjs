import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const source = read('../src/services/admin/catalogosService.js').replace(/^import .*$/gm, '')
  .replaceAll('import.meta.env', 'env').replaceAll('export ', '')
const factory = new Function('httpsCallable', 'auth', 'functions', 'env', 'crypto', `${source};return ejecutarOperacionCatalogo;`)
function preparar({env = {}, uid = 'admin', remote = async () => ({ data: { resultado: 'exito', elementoId: 'registro', operacionId: 'operacion', registro: { nombre: 'Nombre', estado: 'Activa' } } })} = {}) {
  const app = { options: { projectId: 'demo-bora-admin' } }
  const calls = []
  const ejecutar = factory((functions, nombre) => async datos => { calls.push({ nombre, datos }); return remote(datos) },
    { app, currentUser: uid ? { uid } : null }, { app, region: 'us-central1' },
    { DEV: true, MODE: 'admin-emulator', VITE_ADMIN_EMULATOR: 'true', ...env }, { randomUUID })
  return { ejecutar, calls }
}

test('servicio exige modo aislado, sesion y operacion en lista cerrada', async () => {
  for (const options of [{ env: { DEV: false } }, { env: { MODE: 'production' } }, { env: { VITE_ADMIN_EMULATOR: 'false' } }, { uid: null }]) {
    const p = preparar(options)
    await assert.rejects(p.ejecutar('crearCategoria', { nombre: 'Nombre' }))
    assert.equal(p.calls.length, 0)
  }
  const p = preparar()
  await assert.rejects(p.ejecutar('eliminarUsuario', {}))
  assert.equal(p.calls.length, 0)
})

test('doble envio concurrente usa una llamada y solicitudId', async () => {
  let terminar
  const p = preparar({ remote: () => new Promise(resolve => { terminar = resolve }) })
  const una = p.ejecutar('crearCategoria', { nombre: 'Nombre' })
  const dos = p.ejecutar('crearCategoria', { nombre: 'Nombre' })
  await Promise.resolve()
  assert.equal(p.calls.length, 1)
  assert.match(p.calls[0].datos.solicitudId, /^[a-z0-9-]+$/)
  terminar({ data: { resultado: 'exito', elementoId: 'registro', operacionId: 'operacion' } })
  assert.deepEqual(await una, await dos)
})

test('resultado incierto no reintenta y conserva la clave para repeticion manual', async () => {
  let intento = 0
  const p = preparar({ remote: async () => {
    intento++
    if (intento === 1) throw { code: 'functions/unavailable', message: 'PRIVADO', details: { operacionId: 'op-1' } }
    return { data: { resultado: 'exito', elementoId: 'registro', operacionId: 'op-1' } }
  } })
  await assert.rejects(p.ejecutar('crearCategoria', { nombre: 'Nombre' }), error => {
    assert.match(error.message, /op-1/)
    assert.ok(!error.message.includes('PRIVADO'))
    assert.equal(error.cause, undefined)
    return true
  })
  assert.equal(p.calls.length, 1)
  await p.ejecutar('crearCategoria', { nombre: 'Nombre' })
  assert.equal(p.calls[0].datos.solicitudId, p.calls[1].datos.solicitudId)
})

test('errores conocidos se sanitizan y respuesta no confirmada no produce exito', async () => {
  for (const code of ['permission-denied', 'invalid-argument', 'unauthenticated', 'not-found', 'already-exists', 'failed-precondition']) {
    const p = preparar({ remote: async () => { throw { code: `functions/${code}`, message: 'PRIVADO' } } })
    await assert.rejects(p.ejecutar('crearCategoria', { nombre: 'Nombre' }), error => !error.message.includes('PRIVADO'))
    assert.equal(p.calls.length, 1)
  }
  const p = preparar({ remote: async () => ({ data: { resultado: 'incierto' } }) })
  await assert.rejects(p.ejecutar('crearCategoria', { nombre: 'Nombre' }), /no confirmada/)
})

test('repositorio de catalogos conserva contrato y envia doce mutaciones a backend', async () => {
  const exports = ['crearCategoria', 'editarNombreCategoria', 'cambiarEstadoCategoria', 'crearTipoProducto', 'editarNombreTipoProducto', 'cambiarEstadoTipoProducto', 'crearTipoEmprendimiento', 'editarNombreTipoEmprendimiento', 'cambiarEstadoTipoEmprendimiento']
  const calls = []
  const codigo = read('../src/repositories/admin/catalogosRepository.js').replace(/^import .*$/gm, '').replaceAll('export ', '')
  const repo = new Function('ejecutarOperacionCatalogo', `${codigo};return {${exports.join(',')}};`)(async (nombre, datos) => { calls.push({ nombre, datos }); return { elementoId: 'nuevo', registro: { nombre: 'Nombre', estado: 'Activa' } } })
  for (const tipo of ['Categoria', 'TipoProducto', 'TipoEmprendimiento']) {
    assert.deepEqual(await repo[`crear${tipo}`]('Nombre'), { id: 'nuevo', nombre: 'Nombre', estado: 'Activa' })
    await repo[`editarNombre${tipo}`]('id', 'Nombre')
    await repo[`cambiarEstado${tipo}`]('id', 'Inactiva')
    assert.deepEqual(calls.slice(-3), [
      { nombre: `crear${tipo}`, datos: { nombre: 'Nombre' } },
      { nombre: `editar${tipo}`, datos: { id: 'id', nombre: 'Nombre' } },
      { nombre: `cambiarEstado${tipo}`, datos: { id: 'id', estado: 'Inactiva' } },
    ])
  }
  const asociacion = read('../src/repositories/admin/asociacionesRepository.js').replace(/^import .*$/gm, '').replaceAll('export ', '')
  const repoA = new Function('ejecutarOperacionCatalogo', `${asociacion};return {crearAsociacion,editarAsociacion,cambiarEstadoAsociacion};`)(async (nombre, datos) => { calls.push({ nombre, datos }); return { elementoId: 'a', registro: { nombre: 'Asociacion', estado: 'Activa' } } })
  const datos = { nombre: 'Asociacion', descripcion: '', sector: '', contacto: '', logo: '' }
  assert.equal((await repoA.crearAsociacion(datos)).id, 'a')
  await repoA.editarAsociacion('a', datos)
  await repoA.cambiarEstadoAsociacion('a', 'Inactiva')
  assert.deepEqual(calls.slice(-3).map(c => c.nombre), ['crearAsociacion', 'editarAsociacion', 'cambiarEstadoAsociacion'])
  assert.ok(!/addDoc|setDoc|updateDoc|deleteDoc/.test(codigo + asociacion))
})
