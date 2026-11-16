import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { transformWithOxc } from 'vite'

// Compilar el JSX real. Sustituir React y todas las dependencias externas por
// mocks; no importar configuración Firebase ni efectuar conexiones de red.
const original = readFileSync(new URL('../src/pages/admin/AdministradoresAdmin.jsx', import.meta.url), 'utf8')
const compiled = await transformWithOxc(original, 'AdministradoresAdmin.jsx', { jsx: { runtime: 'classic' } })
const code = compiled.code.replace(/^import .*$/gm, '').replaceAll('import.meta.env', 'env')
  .replace('export default AdministradoresAdmin;', 'return AdministradoresAdmin;')
const factory = new Function('deps', `const {React,useState,useCallback,useEffect,useRef,auth,secondaryAuth,env,cambiarPasswordDeAdministrador,listarAdministradores,cambiarEstadoAdministrador,editarNombreAdministrador,crearAdministradorAuditado,crearPerfilAdministrador,createUserWithEmailAndPassword,updateProfile,signOut,deleteUser,window}=deps;${code}`)
const filas = [{ uid: 'principal', nombre: 'Principal', email: 'principal@example.test', activo: true }, { uid: 'otro', nombre: 'Otro', email: 'otro@example.test', activo: true }]

function montar({ env = {}, servicio = async () => ({ resultado: 'exito', operacionId: 'op-1' }) } = {}) {
  const estados = [], refs = [], llamadas = [], existentes = []
  let cursor = 0, refCursor = 0, tree
  const auth = { currentUser: { uid: 'principal' } }, secondaryAuth = { currentUser: null }
  const deps = {
    React: { Fragment: Symbol('fragment'), createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.flat(Infinity) } }) },
    useState: (initial) => {
      const index = cursor++
      if (!(index in estados)) estados[index] = index === 7 ? filas : index === 8 ? false : initial
      return [estados[index], value => { estados[index] = typeof value === 'function' ? value(estados[index]) : value }]
    },
    useRef: (initial) => { const index = refCursor++; return refs[index] ||= { current: initial } },
    useCallback: fn => fn,
    useEffect: () => {}, // El listado inicial se simula con las filas anteriores.
    auth, secondaryAuth,
    env: { DEV: true, MODE: 'admin-emulator', VITE_ADMIN_EMULATOR: 'true', ...env },
    cambiarPasswordDeAdministrador: async (...args) => { llamadas.push(args); return servicio(...args) },
    listarAdministradores: async () => filas,
    cambiarEstadoAdministrador: async (...args) => existentes.push(['estado', ...args]),
    editarNombreAdministrador: async (...args) => existentes.push(['nombre', ...args]),
    crearAdministradorAuditado: async (...args) => { existentes.push(['crearAuditado', ...args]); return {resultado: 'exito', uid: 'nuevo', operacionId: 'op-creacion'} },
    crearPerfilAdministrador: async (...args) => existentes.push(['perfil', ...args]),
    createUserWithEmailAndPassword: async (...args) => { existentes.push(['crear', ...args]); return { user: { uid: 'nuevo' } } },
    updateProfile: async (...args) => existentes.push(['perfilAuth', ...args]),
    signOut: async (...args) => existentes.push(['salir', ...args]),
    deleteUser: async () => assert.fail('No debe eliminar cuentas durante cambio de contraseña'),
    window: { confirm: () => true },
  }
  const Component = factory(deps)
  const render = () => { cursor = 0; refCursor = 0; tree = Component(); return tree }
  function nodes(node = tree) {
    if (!node || typeof node !== 'object') return []
    return [node, ...(node.props?.children || []).flatMap(child => nodes(child))]
  }
  const text = node => typeof node === 'string' ? node : node?.props?.children?.map(text).join('') || ''
  const buttons = label => nodes().filter(n => n.type === 'button' && text(n) === label)
  const input = id => nodes().find(n => n.props?.id === id)
  const form = () => nodes().find(n => n.type === 'form' && n.props['aria-labelledby'] === 'titulo-cambio-password')
  const open = () => { buttons('Cambiar contraseña')[1].props.onClick(); render() }
  const fill = (password = 'Clave123', confirm = password) => {
    input('nueva-password-admin').props.onChange({ target: { value: password } })
    input('confirmacion-password-admin').props.onChange({ target: { value: confirm } })
    render()
  }
  const submit = () => form().props.onSubmit({ preventDefault() {} })
  render()
  return { render, nodes, text: () => text(tree), buttons, input, form, open, fill, submit, llamadas, existentes, auth, secondaryAuth }
}

test('oculta la funcionalidad fuera del modo aislado y deshabilita la cuenta propia', () => {
  for (const env of [{ DEV: false }, { MODE: 'production' }, { VITE_ADMIN_EMULATOR: 'false' }]) {
    const p = montar({ env })
    assert.equal(p.buttons('Cambiar contraseña').length, 0)
    assert.equal(p.form(), undefined)
  }
  const p = montar()
  assert.equal(p.buttons('Cambiar contraseña')[0].props.disabled, true)
  p.buttons('Cambiar contraseña')[0].props.onClick()
  p.render()
  assert.equal(p.form(), undefined)
})

test('campos accesibles y validaciones impiden llamadas con contraseñas incorrectas', async () => {
  const p = montar(); p.open()
  for (const id of ['nueva-password-admin', 'confirmacion-password-admin']) {
    assert.ok(p.nodes().some(n => n.type === 'label' && n.props.htmlFor === id))
    assert.equal(p.input(id).props.type, 'password')
    assert.equal(p.input(id).props.minLength, 8)
    assert.equal(p.input(id).props.maxLength, 128)
  }
  for (const [password, confirm] of [['corta', 'corta'], ['a'.repeat(129), 'a'.repeat(129)], [' '.repeat(8), ' '.repeat(8)], ['Clave123', 'Distinta']]) {
    p.fill(password, confirm); await p.submit(); p.render()
  }
  assert.equal(p.llamadas.length, 0)
})

test('solo servicio autorizado; exito confirmado limpia y cierra ambos campos', async () => {
  const p = montar(); p.open(); p.fill('  Clave123  ')
  await p.submit(); p.render()
  assert.deepEqual(p.llamadas, [['otro', '  Clave123  ']])
  assert.match(p.text(), /Contraseña actualizada correctamente/)
  assert.equal(p.form(), undefined)
  assert.equal(p.existentes.length, 0)
  p.open()
  assert.equal(p.input('nueva-password-admin').props.value, '')
  assert.equal(p.input('confirmacion-password-admin').props.value, '')
})

test('cancelar o abrir edicion de nombre borra las contraseñas', () => {
  const p = montar(); p.open(); p.fill()
  p.buttons('Cancelar')[0].props.onClick(); p.render()
  assert.equal(p.form(), undefined)
  p.open(); assert.equal(p.input('nueva-password-admin').props.value, '')
  p.fill(); p.buttons('Editar nombre')[1].props.onClick(); p.render()
  assert.equal(p.form(), undefined)
  p.open(); assert.equal(p.input('confirmacion-password-admin').props.value, '')
})

test('rechaza propia cuenta o sesion perdida aunque el formulario ya estuviera abierto', async () => {
  for (const currentUser of [null, { uid: 'otro' }]) {
    const p = montar(); p.open(); p.fill(); p.auth.currentUser = currentUser
    await p.submit(); p.render()
    assert.equal(p.llamadas.length, 0)
    assert.equal(p.form(), undefined)
  }
})

test('resultado incierto muestra advertencia e ID sin exito, secretos ni reintentos', async () => {
  const p = montar({ servicio: async () => { throw { resultadoIncierto: true, operacionId: 'op-parcial', message: 'SECRETO' } } })
  p.open(); p.fill(); await p.submit(); p.render()
  assert.match(p.text(), /Puede haberse aplicado/)
  assert.match(p.text(), /op-parcial/)
  assert.ok(!p.text().includes('actualizada correctamente'))
  assert.ok(!p.text().includes('SECRETO'))
  assert.equal(p.llamadas.length, 1)
  assert.equal(p.form(), undefined)
  p.open(); assert.equal(p.input('nueva-password-admin').props.value, '')
})

test('respuesta no confirmada y excepciones desconocidas son inciertas', async () => {
  for (const servicio of [async () => ({ resultado: 'incierto', operacionId: 'op-2' }), async () => { throw new Error('SECRETO') }]) {
    const p = montar({ servicio }); p.open(); p.fill(); await p.submit(); p.render()
    assert.match(p.text(), /No se pudo confirmar/)
    assert.ok(!p.text().includes('actualizada correctamente'))
    assert.ok(!p.text().includes('SECRETO'))
    assert.equal(p.llamadas.length, 1)
  }
})

test('autenticacion reciente requiere iniciar sesion de nuevo y limpia campos', async () => {
  const p = montar({ servicio: async () => { throw { code: 'functions/failed-precondition', operacionId: 'op-auth' } } })
  p.open(); p.fill(); await p.submit(); p.render()
  assert.match(p.text(), /volver a iniciar sesión/)
  assert.match(p.text(), /op-auth/)
  assert.equal(p.form(), undefined)
  p.open(); assert.equal(p.input('confirmacion-password-admin').props.value, '')
})

test('bloquea acciones incompatibles y doble envio mientras espera al backend', async () => {
  let terminar
  const p = montar({ servicio: () => new Promise(resolve => { terminar = resolve }) })
  p.open(); p.fill()
  const enviar = p.form().props.onSubmit
  const pendiente = enviar({ preventDefault() {} }); p.render()
  for (const label of ['Crear administrador', 'Actualizar listado', 'Editar nombre', 'Cambiar contraseña', 'Cancelar']) {
    assert.ok(p.buttons(label).every(n => n.props.disabled))
  }
  assert.equal(p.input('nueva-password-admin').props.disabled, true)
  await enviar({ preventDefault() {} })
  assert.equal(p.llamadas.length, 1)
  terminar({ resultado: 'exito', operacionId: 'op-1' }); await pendiente; p.render()
  assert.equal(p.buttons('Cambiar contraseña')[1].props.disabled, false)
})

test('conserva edicion de nombre, estados y creacion mediante backend auditado', async () => {
  const p = montar()
  p.buttons('Editar nombre')[1].props.onClick(); p.render()
  p.input('nombre-administrador').props.onChange({ target: { value: 'Nombre nuevo' } }); p.render()
  await p.nodes().find(n => n.type === 'form' && n.props.children.some?.(c => c?.props?.htmlFor === 'nombre-administrador')).props.onSubmit({ preventDefault() {} })
  p.render(); assert.deepEqual(p.existentes[0], ['nombre', 'otro', 'Nombre nuevo'])
  await p.buttons('Desactivar')[1].props.onClick(); p.render()
  assert.ok(p.existentes.some(c => c[0] === 'estado' && c[1] === 'otro' && c[2] === false))
  for (const [label, value] of [['Nombre completo', 'Nuevo'], ['Correo electrónico', 'nuevo@example.test'], ['Contraseña', 'Clave123'], ['Confirmar contraseña', 'Clave123']]) {
    p.nodes().find(n => n.type?.name === 'Campo' && n.props.label === label).props.change(value)
  }
  p.render()
  await p.nodes().find(n => n.type === 'form').props.onSubmit({ preventDefault() {} }); p.render()
  assert.ok(p.existentes.some(c => c[0] === 'crearAuditado' && c[1] === 'Nuevo' && c[2] === 'nuevo@example.test'))
  assert.ok(!p.existentes.some(c => ['crear', 'perfil', 'perfilAuth'].includes(c[0])))
  assert.equal(p.llamadas.length, 0)
})
