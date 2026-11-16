import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing'
import { doc, Timestamp, writeBatch } from 'firebase/firestore'

const host = process.env.FIRESTORE_EMULATOR_HOST
if (host !== '127.0.0.1:8087') throw new Error('Se requiere Firestore Emulator local en 8087.')
const projectId = 'demo-bora-auditoria-validacion'
let env
let repositorio
let numero = 0
async function cargar(db) {
  const clave = `boraAuditTest${numero++}`
  globalThis[clave] = db
  const fuente = readFileSync(new URL('../src/repositories/admin/auditoriaRepository.js', import.meta.url), 'utf8')
    .replace("import { db } from '../../firebase/config'", `const db = globalThis['${clave}']`)
    .replace("from 'firebase/firestore'", `from '${import.meta.resolve('firebase/firestore')}'`)
  try {
    return await import(`data:text/javascript;base64,${Buffer.from(fuente).toString('base64')}`)
  } finally {
    delete globalThis[clave]
  }
}
before(async () => {
  env = await initializeTestEnvironment({ projectId, firestore: {
    host: '127.0.0.1', port: 8087,
    rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'),
  } })
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async ctx => {
    const batch = writeBatch(ctx.firestore())
    for (const [uid, rol, activo] of [['actor', 'administrador', true], ['inactivo', 'administrador', false], ['emprendedor', 'emprendedor', true]]) {
      batch.set(doc(ctx.firestore(), 'usuarios', uid), { rol, activo })
    }
    for (let i = 0; i < 7; i++) {
      batch.set(doc(ctx.firestore(), 'auditoria_administrativa', `evento-${i}`), {
        fecha: Timestamp.fromDate(new Date('2026-11-15T12:00:00Z')),
        actorUid: 'actor', accion: i < 2 ? 'administrador.cambiar_password' : 'categoria.editar',
        destinatarioUid: 'destino', resultado: 'exito',
        operacionId: i < 2 ? 'operacion-password' : `operacion-${i}`,
        fase: i === 0 ? 'intento' : 'resultado',
        password: 'NO-DEBE-SALIR', token: 'NO-DEBE-SALIR',
      })
    }
    await batch.commit()
  })
  repositorio = await cargar(env.authenticatedContext('actor').firestore())
})
after(async () => { await env?.cleanup() })

test('bitacora: paginacion real estable sin duplicados con fechas iguales', async () => {
  const ids = []
  let cursor = null
  let pagina
  do {
    pagina = await repositorio.consultarAuditoria({}, cursor, 2)
    ids.push(...pagina.eventos.map(e => e.id))
    cursor = pagina.siguienteCursor
  } while (pagina.hayMas)
  assert.deepEqual(ids, [6, 5, 4, 3, 2, 1, 0].map(i => `evento-${i}`))
  assert.equal(new Set(ids).size, 7)
})

test('bitacora: filtros reales y dos eventos historicos de una misma operacion', async () => {
  const pagina = await repositorio.consultarAuditoria({ accion: 'administrador.cambiar_password',
    resultado: 'exito', desde: '2026-11-14', hasta: '2026-11-16',
    campoIdentificador: 'operacionId', identificador: 'operacion-password' })
  assert.equal(pagina.eventos.length, 2)
  assert.deepEqual(pagina.eventos.map(e => e.fase).sort(), ['intento', 'resultado'])
  for (const evento of pagina.eventos) {
    assert.equal(evento.elementoTipo, 'administrador')
    assert.equal(evento.elementoId, 'destino')
    assert.ok(!JSON.stringify(evento).includes('NO-DEBE-SALIR'))
  }
  const vacio = await repositorio.consultarAuditoria({ resultado: 'rechazado' })
  assert.equal(vacio.eventos.length, 0)
  assert.equal(vacio.hayMas, false)
})

test('bitacora: normaliza eventos administrativos antiguos sin modificar documentos', () => {
  const evento = repositorio.normalizarEventoAuditoria({ id: 'antiguo', data: () => ({
    accion: 'administrador.crear', destinatarioUid: 'otro', password: 'secreto',
  }) })
  assert.equal(evento.elementoTipo, 'administrador')
  assert.equal(evento.elementoId, 'otro')
  assert.equal(evento.fecha, null)
  assert.ok(!('password' in evento))
})

test('bitacora: rechaza filtros y tamanos invalidos antes de consultar', async () => {
  for (const filtros of [{ desde: '2026-02-30' }, { desde: '2026-11-16', hasta: '2026-11-15' },
    { campoIdentificador: 'password', identificador: 'secreto' }]) {
    await assert.rejects(repositorio.consultarAuditoria(filtros))
  }
  await assert.rejects(repositorio.consultarAuditoria({}, null, 0))
  await assert.rejects(repositorio.consultarAuditoria({}, null, 101))
})

test('bitacora: consulta real denegada a visitante, inactivo y emprendedor', async () => {
  for (const uid of [null, 'inactivo', 'emprendedor']) {
    const db = uid === null ? env.unauthenticatedContext().firestore() : env.authenticatedContext(uid).firestore()
    const repo = await cargar(db)
    await assertFails(repo.consultarAuditoria())
  }
})
