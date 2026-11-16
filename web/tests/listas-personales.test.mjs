import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import * as jsx from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import { cargarComponentePublico } from './soporte-catalogo.mjs'

async function montarServicio({ guardar } = {}) {
  const auth = { currentUser: null }, perfiles = [], consultas = [], auths = [], escrituras = []
  let cancelaciones = 0
  const api = await cargarComponentePublico('../src/services/perfil/listaPersonalService.js', {
    'firebase/auth': { onAuthStateChanged: (_a, cb) => { auths.push(cb); return () => { cancelaciones++ } } },
    '../../firebase/config': { auth },
    '../../repositories/auth/usuarioRepository': { observarDocumentoCuenta: (_coleccion, uid, cb, error) => { perfiles.push({ uid, cb, error }); return () => { cancelaciones++ } } },
    '../../repositories/perfil/listasPersonalesRepository': {
      observarLista: (uid, tipo, cb, error) => { consultas.push({ uid, tipo, cb, error }); return () => { cancelaciones++ } },
      consultarLista: async () => [], contieneReferencia: async () => false,
      guardarReferencia: async (...args) => { escrituras.push(args); return guardar?.(...args) }, eliminarReferencia: async (...args) => { escrituras.push(args) },
    },
  })
  const lista = api.crearListaPersonal('favoritos', 'productoId')
  const cambiarSesion = uid => { auth.currentUser = uid ? { uid, email: `${uid}@example.test`, emailVerified: true } : null; auths.at(-1)(auth.currentUser) }
  const perfil = (cambios = {}) => perfiles.at(-1).cb({ activo: true, rol: 'comprador', email: `${auth.currentUser.uid}@example.test`, ...cambios })
  return { lista, auth, consultas, perfiles, auths, escrituras, cambiarSesion, perfil, cancelaciones: () => cancelaciones }
}

test('un observador por lista sincroniza todos los botones y se cancela al desmontar el último', async () => {
  const s = await montarServicio(), cambios = []
  const a = s.lista.suscribir(() => cambios.push('a')), b = s.lista.suscribir(() => cambios.push('b'))
  assert.equal(s.auths.length, 1)
  s.cambiarSesion('ana'); s.perfil(); assert.equal(s.consultas.length, 1)
  s.consultas[0].cb([{ id: 'producto' }]); assert.equal(s.lista.leerEstado().registros[0].id, 'producto')
  assert.ok(cambios.includes('a')); assert.ok(cambios.includes('b'))
  a(); const antes = s.cancelaciones(); b(); assert.ok(s.cancelaciones() > antes)
})

test('cambiar de cuenta y cerrar sesión limpia la lista e ignora respuestas atrasadas', async () => {
  const s = await montarServicio(), cancelar = s.lista.suscribir(() => {})
  s.cambiarSesion('ana'); s.perfil(); const anterior = s.consultas[0]
  anterior.cb([{ id: 'privado-ana' }]); s.cambiarSesion('bea')
  assert.equal(s.lista.leerEstado().registros.length, 0)
  s.perfil(); s.consultas.at(-1).cb([{ id: 'privado-bea' }]); anterior.cb([{ id: 'filtracion' }]); anterior.error(Error('atrasado'))
  assert.equal(s.lista.leerEstado().uid, 'bea'); assert.equal(s.lista.leerEstado().registros[0].id, 'privado-bea')
  s.cambiarSesion(null); assert.equal(s.lista.leerEstado().estado, 'sin-sesion'); assert.equal(s.lista.leerEstado().registros.length, 0)
  cancelar()
})

test('desactivar o cambiar rol revoca acceso y no permite reactivar datos con un callback viejo', async () => {
  const s = await montarServicio(), cancelar = s.lista.suscribir(() => {})
  s.cambiarSesion('ana'); s.perfil(); const anterior = s.consultas[0]
  anterior.cb([{ id: 'producto' }]); s.perfil({ activo: false }); anterior.cb([{ id: 'privado' }])
  assert.equal(s.lista.leerEstado().estado, 'sin-permiso'); assert.equal(s.lista.leerEstado().registros.length, 0)
  await assert.rejects(s.lista.agregar('producto'))
  s.perfil({ rol: 'administrador' }); assert.equal(s.lista.leerEstado().estado, 'sin-permiso')
  s.perfil({ rol: 'emprendedora' }); s.consultas.at(-1).cb([]); assert.equal(s.lista.leerEstado().estado, 'autorizado')
  cancelar()
})

test('reintentar vuelve a consultar cuenta y lista; correo y verificación conservan restricciones', async () => {
  const s = await montarServicio(), cancelar = s.lista.suscribir(() => {})
  s.cambiarSesion('ana'); s.perfil(); s.consultas[0].error(Error('sin red'))
  assert.equal(s.lista.leerEstado().estado, 'error')
  s.lista.reintentar(); assert.equal(s.auths.length, 2)
  s.cambiarSesion('ana'); s.perfil(); s.consultas.at(-1).cb([])
  assert.equal(s.lista.leerEstado().estado, 'autorizado')
  s.perfil({ email: 'otra@example.test' }); assert.equal(s.lista.leerEstado().estado, 'sin-permiso')
  s.auth.currentUser.emailVerified = false; s.perfil(); assert.equal(s.lista.leerEstado().estado, 'sin-permiso')
  cancelar()
})

test('la API rechaza IDs inválidos y usuarios sin sesión, y no consulta localStorage', async () => {
  const s = await montarServicio()
  await assert.rejects(s.lista.agregar('p'))
  s.auth.currentUser = { uid: 'ana' }
  for (const id of ['', 'a/b', '..', 1, null]) await assert.rejects(s.lista.agregar(id))
  await s.lista.agregar('p'); assert.equal(s.escrituras.length, 1)
})

test('navegar no cancela una escritura confirmable, pero cambiar de cuenta invalida su sesión', async () => {
  let confirmar, comprobarSesion
  const s = await montarServicio({ guardar: (...args) => new Promise(resolve => { confirmar = resolve; comprobarSesion = args.at(-1) }) })
  const cancelar = s.lista.suscribir(() => {})
  s.cambiarSesion('ana'); s.perfil(); s.consultas[0].cb([])
  const escritura = s.lista.agregar('p')
  await new Promise(resolve => setImmediate(resolve)); cancelar()
  assert.equal(comprobarSesion(), true)
  s.auth.currentUser = { uid: 'bea' }; assert.equal(comprobarSesion(), false)
  confirmar(); await escritura
  assert.equal(s.lista.leerEstado().registros.length, 0)
})

test('una acción en espera de otra cuenta no puede quitar favoritos de la sesión nueva', async () => {
  let confirmar
  const s = await montarServicio({ guardar: () => new Promise(resolve => { confirmar = resolve }) })
  s.auth.currentUser = { uid: 'ana' }
  const guardado = s.lista.agregar('p')
  const retirada = s.lista.quitar('p')
  const rechazo = assert.rejects(retirada, /sesión cambió/)
  await new Promise(resolve => setImmediate(resolve))
  // La escritura inicial puede haberse confirmado justo antes del cambio de cuenta.
  s.auth.currentUser = { uid: 'bea' }
  confirmar()
  await guardado
  await rechazo
  assert.equal(s.escrituras.length, 1)
  assert.equal(s.escrituras[0][0], 'ana')
})

function elementos(nodo, tipo) {
  if (!nodo?.props) return []
  return [nodo.type === tipo ? [nodo] : [], [nodo.props.children].flat(Infinity).flatMap(n => elementos(n, tipo))].flat()
}

test('botón compartido: sesión, estado marcado, errores de escritura y reintento sin bloquear permanentemente', async () => {
  let estado = { estado: 'sin-sesion', registros: [], pendientes: [], sesion: 1 }, fallo = null, navegacion, reintentos = 0
  const lista = { leerEstado: () => estado, reintentar: () => { reintentos++ }, agregar: async () => { throw Error('permission-denied') }, quitar: async () => {} }
  const componente = await cargarComponentePublico('../src/components/perfil/BotonListaPersonal.jsx', {
    react: { useState: () => [fallo, v => { fallo = v }] }, 'react/jsx-runtime': jsx,
    'react-router-dom': { useNavigate: () => destino => { navegacion = destino } },
    '../../hooks/useListaPersonal': { useListaPersonal: () => estado }, './ListasPersonales.css': {},
  })
  const arbol = () => componente.default({ lista, id: 'p', tipo: 'favorito', className: 'favorito' })
  await elementos(arbol(), 'button')[0].props.onClick(); assert.equal(navegacion, '/login')
  estado = { ...estado, estado: 'autorizado' }
  await elementos(arbol(), 'button')[0].props.onClick(); assert.match(renderToStaticMarkup(arbol()), /No pudimos guardar el cambio/)
  elementos(arbol(), 'button')[1].props.onClick(); assert.equal(reintentos, 1); assert.equal(elementos(arbol(), 'button')[0].props.disabled, false)
  estado = { ...estado, registros: [{ id: 'p' }] }; assert.equal(elementos(arbol(), 'button')[0].props['aria-pressed'], true)
  estado = { ...estado, sesion: 2, registros: [] }; assert.doesNotMatch(renderToStaticMarkup(arbol()), /No pudimos guardar el cambio/)
})

for (const tipo of ['favoritos', 'tiendas']) test(`página de ${tipo}: estados vacíos, errores con reintento y referencias no disponibles sin enlaces rotos`, async () => {
  let estado = { estado: 'autorizado', uid: 'ana', sesion: 1, pendientes: [], detalles: [], cargando: false, error: '', reintentar: () => {} }
  const lista = { quitar: async () => {}, leerEstado: () => estado }
  const deps = {
    react: { useState: () => [null, () => {}] }, 'react/jsx-runtime': jsx,
    'react-router-dom': { Link: ({ to, children, ...p }) => createElement('a', { ...p, href: to }, children) },
    '../../hooks/useListaPersonal': { useDetallesLista: () => estado },
    '../../components/perfil/AccesoListaPersonal': { default: ({ estado }) => createElement('p', null, estado) },
    '../../components/ImagenPublica': { default: p => createElement('img', p) },
    '../../components/perfil/ListasPersonales.css': {}, './MisFavoritos.css': {},
  }
  deps[tipo === 'favoritos' ? '../../services/productos/favoritosService' : '../../services/tiendas/seguimientoService'] = tipo === 'favoritos' ? { listaFavoritos: lista, obtenerDetallesFavoritos: () => {} } : { listaSeguimientos: lista, obtenerDetallesTiendasSeguidas: () => {} }
  const pagina = await cargarComponentePublico(tipo === 'favoritos' ? '../src/pages/perfil/MisFavoritos.jsx' : '../src/pages/perfil/TiendasSeguidas.jsx', deps)
  const html = () => renderToStaticMarkup(pagina.default())
  assert.match(html(), tipo === 'favoritos' ? /Aún no tienes favoritos/ : /Aún no sigues ninguna tienda/)
  estado = { ...estado, detalles: [{ id: 'eliminado', nombre: 'Destino eliminado', estado: tipo === 'favoritos' ? 'eliminado' : 'no-disponible' }] }
  assert.match(html(), /Destino eliminado/); assert.doesNotMatch(html(), /href="\/(productos|tiendas)\/eliminado"/)
  estado = { ...estado, error: 'Falla de conexión' }; assert.match(html(), /Reintentar/)
  estado = { ...estado, estado: 'sin-permiso', detalles: [] }; assert.match(html(), /sin-permiso/)
})
