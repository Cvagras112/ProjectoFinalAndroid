import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { transformWithOxc } from 'vite'

// JSX real con React y repositorio simulados. No importar configuración Firebase.
const source = readFileSync(new URL('../src/pages/admin/AsignacionesAdmin.jsx', import.meta.url), 'utf8')
const compiled = await transformWithOxc(source, 'AsignacionesAdmin.jsx', { jsx: { runtime: 'classic' } })
const code = compiled.code.replace(/^import .*$/gm, '')
  .replace('export default function AsignacionesAdmin', 'function AsignacionesAdmin')
const factory = new Function('React', 'useState', 'useRef', 'guardarAsignacion', 'quitarAsignacion', 'window', 'console', `${code};return AsignacionesAdmin;`)
const vinculo = { id: 'emp1', emprendedoraId: 'emp1', asociacionId: 'a' }

function montar({ asignaciones = [vinculo], confirmar = true, servicio = async () => {} } = {}) {
  const states = [], refs = [], calls = [], confirmations = []
  let cursor = 0, refCursor = 0, tree
  const props = {
    emprendedoras: [{ id: 'emp1', nombre: 'Ficticia 1', estado: 'Activa' }, { id: 'emp2', nombre: 'Ficticia 2', estado: 'Activa' }, { id: 'inactiva', nombre: 'Inactiva', estado: 'Inactiva' }],
    asociaciones: [{ id: 'a', nombre: 'Asociación A', estado: 'Activa' }, { id: 'b', nombre: 'Asociación B', estado: 'Activa' }, { id: 'inactiva', nombre: 'Asociación inactiva', estado: 'Inactiva' }],
    asignaciones: asignaciones.map(a => ({ ...a })),
    setAsignaciones: value => { props.asignaciones = typeof value === 'function' ? value(props.asignaciones) : value },
  }
  const React = { Fragment: Symbol('fragment'), createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.flat(Infinity) } }) }
  const C = factory(React, initial => {
    const i = cursor++
    if (!(i in states)) states[i] = initial
    return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value }]
  }, initial => { const i = refCursor++; return refs[i] ||= { current: initial } },
  async (...args) => { calls.push(['guardar', ...args]); return servicio(...args) },
  async id => { calls.push(['quitar', id]) },
  { confirm: text => { confirmations.push(text); return confirmar }, alert: () => {} }, { error: () => {} })
  const render = () => { cursor = 0; refCursor = 0; tree = C(props) }
  function nodes(...args) { const n = args.length ? args[0] : tree; return n && typeof n === 'object' ? [n, ...(n.props?.children || []).flatMap(c => nodes(c))] : [] }
  function text(...args) { const n = args.length ? args[0] : tree; return typeof n === 'string' ? n : n?.props?.children?.map(c => text(c)).join('') || '' }
  const buttons = label => nodes().filter(n => n.type === 'button' && text(n) === label)
  const select = id => nodes().find(n => n.type === 'select' && n.props.id === id)
  const choose = (id, value) => { select(id).props.onChange({ target: { value } }); render() }
  const open = () => { buttons('Cambiar asociación').at(-1).props.onClick(); render() }
  const submit = () => nodes().find(n => n.type === 'form').props.onSubmit({ preventDefault() {} })
  render()
  return { props, calls, confirmations, render, nodes, text, buttons, select, choose, open, submit }
}

test('conserva la creacion y ofrece cambio solo cuando existe una asignacion activa', async () => {
  const p = montar({ asignaciones: [] })
  assert.equal(p.buttons('Cambiar asociación')[0].props.disabled, true)
  p.choose('asig-emprendedora', 'emp1'); p.choose('asig-asociacion', 'a')
  await p.submit(); p.render()
  assert.deepEqual(p.calls, [['guardar', 'emp1', 'a']])
  assert.deepEqual(p.props.asignaciones, [vinculo])
  assert.equal(p.buttons('Cambiar asociación')[0].props.disabled, false)
})

test('muestra asociacion actual y reemplaza en una sola llamada sin eliminar', async () => {
  const p = montar(); p.open()
  assert.match(p.text(), /Asociación actual: Asociación A/)
  const opciones = p.select('asig-asociacion').props.children.filter(c => c?.type === 'option').map(c => c.props.value)
  assert.ok(opciones.includes('b')); assert.ok(!opciones.includes('a')); assert.ok(!opciones.includes('inactiva'))
  p.choose('asig-asociacion', 'b'); await p.submit(); p.render()
  assert.equal(p.confirmations.length, 1)
  assert.match(p.confirmations[0], /Asociación A a Asociación B/)
  assert.deepEqual(p.calls, [['guardar', 'emp1', 'b']])
  assert.equal(p.props.asignaciones.length, 1)
  assert.equal(p.props.asignaciones[0].asociacionId, 'b')
})

test('rechaza la misma asociacion aunque se fuerce el valor del formulario', async () => {
  const p = montar(); p.open(); p.choose('asig-asociacion', 'a')
  await p.submit(); p.render()
  assert.match(p.text(), /diferente de la actual/)
  assert.equal(p.calls.length, 0); assert.equal(p.confirmations.length, 0)
})

test('cancelar la confirmacion no modifica ni elimina el vinculo', async () => {
  const p = montar({ confirmar: false }); p.open(); p.choose('asig-asociacion', 'b')
  await p.submit(); p.render()
  assert.deepEqual(p.props.asignaciones, [vinculo]); assert.equal(p.calls.length, 0)
})

test('bloquea acciones y doble envio mientras se procesa el reemplazo', async () => {
  let terminar
  const p = montar({ servicio: () => new Promise(resolve => { terminar = resolve }) })
  p.open(); p.choose('asig-asociacion', 'b')
  const submit = p.nodes().find(n => n.type === 'form').props.onSubmit
  const pendiente = submit({ preventDefault() {} }); p.render()
  assert.ok(p.buttons('Cambiar asociación').every(b => b.props.disabled))
  assert.equal(p.buttons('Desvincular')[0].props.disabled, true)
  assert.equal(p.buttons('Cancelar cambio')[0].props.disabled, true)
  assert.equal(p.select('asig-emprendedora').props.disabled, true)
  await submit({ preventDefault() {} })
  assert.equal(p.calls.length, 1); assert.equal(p.confirmations.length, 1)
  terminar(); await pendiente
})

test('cancelar cambio restaura el formulario de creacion; desvincular sigue funcionando', async () => {
  const p = montar(); p.open(); p.choose('asig-asociacion', 'b')
  p.buttons('Cancelar cambio')[0].props.onClick(); p.render()
  assert.equal(p.select('asig-emprendedora').props.value, '')
  assert.equal(p.select('asig-asociacion').props.value, '')
  assert.equal(p.buttons('Guardar asignación').length, 1)
  await p.buttons('Desvincular')[0].props.onClick(); p.render()
  assert.deepEqual(p.calls, [['quitar', 'emp1']]); assert.equal(p.props.asignaciones.length, 0)
})

test('permite elegir otra emprendedora asignada y actualiza su asociacion actual', () => {
  const p = montar({ asignaciones: [vinculo, { id: 'emp2', emprendedoraId: 'emp2', asociacionId: 'b' }] })
  p.buttons('Cambiar asociación')[0].props.onClick(); p.render()
  p.choose('asig-emprendedora', 'emp1'); p.choose('asig-asociacion', 'b')
  p.choose('asig-emprendedora', 'emp2')
  assert.match(p.text(), /Asociación actual: Asociación B/)
  assert.equal(p.select('asig-asociacion').props.value, '')
})

test('no permite cambiar la asociacion de una emprendedora inactiva', () => {
  const p = montar({ asignaciones: [{ id: 'inactiva', emprendedoraId: 'inactiva', asociacionId: 'a' }] })
  assert.ok(p.buttons('Cambiar asociación').every(b => b.props.disabled))
  assert.equal(p.buttons('Desvincular')[0].props.disabled, false)
})

test('fallo del servicio mantiene la asignacion anterior y no reintenta', async () => {
  const p = montar({ servicio: async () => { throw new Error('Resultado no confirmado') } })
  p.open(); p.choose('asig-asociacion', 'b'); await p.submit(); p.render()
  assert.deepEqual(p.props.asignaciones, [vinculo]); assert.equal(p.calls.length, 1)
  assert.match(p.text(), /Resultado no confirmado/)
  assert.equal(p.buttons('Confirmar cambio')[0].props.disabled, false)
})
