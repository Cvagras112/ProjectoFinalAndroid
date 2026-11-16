import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const source = readFileSync(new URL('../src/pages/admin/AdminDashboard.jsx', import.meta.url), 'utf8')
const block = source.slice(source.indexOf('  const [cargandoEmprendedoras'), source.indexOf('  const opciones ='))
const run = new Function('useState', 'useEffect', 'listarEmprendedoras', 'setEmprendedoras', 'console', 'seccion', block)
test('entrar en emprendedoras recarga datos externos y descarta respuestas obsoletas', async () => {
  let previous, cleanup, filas = [], calls = 0
  const pending = []
  const effect = (fn, deps) => {
    if (!previous || deps.some((x, i) => x !== previous[i])) { cleanup?.(); previous = deps; cleanup = fn() }
  }
  const render = section => run(v => [v, () => {}], effect, () => { calls++; return new Promise(resolve => pending.push(resolve)) }, value => { filas = value }, { error: () => {} }, section)
  render('dashboard')
  render('emprendedoras')
  assert.equal(calls, 2)
  pending[1]([{ id: 'fixture-actual' }]); await new Promise(resolve => setTimeout(resolve, 0))
  pending[0]([]); await new Promise(resolve => setTimeout(resolve, 0))
  assert.deepEqual(filas, [{ id: 'fixture-actual' }])
  render('emprendedoras'); assert.equal(calls, 2)
  cleanup()
})
