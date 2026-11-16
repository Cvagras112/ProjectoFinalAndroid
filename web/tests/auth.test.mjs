import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { SourceTextModule, SyntheticModule } from 'node:vm'

async function cargar(archivo, dependencias) {
  const modulo = new SourceTextModule(await readFile(new URL(archivo, import.meta.url), 'utf8'))
  await modulo.link(async (nombre) => {
    const datos = dependencias[nombre]
    assert.ok(datos, nombre)
    const stub = new SyntheticModule(Object.keys(datos), function () {
      for (const [clave, valor] of Object.entries(datos)) this.setExport(clave, valor)
    })
    return stub
  })
  await modulo.evaluate()
  return modulo.namespace
}

test('alta por Google y correo: solo comprador verificado, conserva cuentas existentes', async () => {
  let proveedor = 'google.com'
  let existente = null
  const creados = []
  const servicio = await cargar('../src/services/auth/authService.js', {
    'firebase/auth': { reload: async () => {}, getIdTokenResult: async () => ({ signInProvider: proveedor }) },
    '../../repositories/auth/usuarioRepository': {
      obtenerUsuario: async () => existente,
      obtenerEmprendedor: async () => ({ activo: false }),
      crearCompradorSiNoExiste: async (uid, perfil) => { creados.push(perfil); return { ...perfil, id: uid } },
    },
  })
  const usuario = { uid: 'u', email: 'u@example.test', displayName: 'Compradora', emailVerified: true, getIdToken: async () => {} }
  for (proveedor of ['google.com', 'password']) {
    const perfil = await servicio.completarPerfilComprador(usuario)
    assert.equal(perfil.rol, 'comprador')
    assert.equal(perfil.activo, true)
  }
  existente = { rol: 'emprendedor', activo: false }
  assert.equal(await servicio.completarPerfilComprador(usuario), existente)
  assert.equal(creados.length, 2)
  usuario.emailVerified = false
  await assert.rejects(servicio.completarPerfilComprador(usuario))
  usuario.emailVerified = true
  proveedor = 'anonymous'
  await assert.rejects(servicio.completarPerfilComprador(usuario))
  assert.equal(await servicio.emprendedorActivo('u'), false)
})

test('rutas: sin sesion, roles, desactivacion en vivo, errores y cambio de usuario', async () => {
  let cambiarSesion
  const observadores = []
  const servicio = await cargar('../src/services/auth/observarAcceso.js', {
    'firebase/auth': { onAuthStateChanged: (_auth, callback) => { cambiarSesion = callback; return () => {} } },
    '../../firebase/config': { auth: {} },
    '../../repositories/auth/usuarioRepository': {
      observarDocumentoCuenta: (coleccion, uid, recibir, error) => {
        const observador = { coleccion, uid, recibir, error, cancelado: false }
        observadores.push(observador)
        return () => { observador.cancelado = true }
      },
    },
  })
  const estados = []
  let cancelar = servicio.observarAcceso(e => estados.push(e), { comprador: true })
  cambiarSesion(null)
  assert.equal(estados.at(-1), 'sin-sesion')
  const usuario = { uid: 'u', email: 'u@example.test', emailVerified: true }
  cambiarSesion(usuario)
  const perfil = { rol: 'comprador', activo: true, email: usuario.email }
  observadores[0].recibir(perfil)
  assert.equal(estados.at(-1), 'autorizado')
  observadores[0].recibir({ ...perfil, activo: false })
  assert.equal(estados.at(-1), 'sin-permiso')
  observadores[0].recibir({ ...perfil, rol: 'emprendedor' })
  assert.equal(estados.at(-1), 'sin-permiso')
  cambiarSesion(null)
  observadores[0].recibir(perfil)
  assert.equal(estados.at(-1), 'sin-sesion')
  assert.equal(observadores[0].cancelado, true)
  cancelar()
  cancelar = servicio.observarAcceso(e => estados.push(e), { emprendedor: true })
  cambiarSesion(usuario)
  observadores[1].recibir({ ...perfil, rol: 'emprendedor' })
  assert.equal(estados.at(-1), 'cargando')
  observadores[2].recibir({ activo: true })
  assert.equal(estados.at(-1), 'autorizado')
  observadores[2].recibir({ activo: false })
  assert.equal(estados.at(-1), 'sin-permiso')
  observadores[1].error(new Error('sin conexion'))
  observadores[2].recibir({ activo: true })
  assert.equal(estados.at(-1), 'error')
  cancelar()
  assert.ok(observadores.every(o => o.cancelado))
})
