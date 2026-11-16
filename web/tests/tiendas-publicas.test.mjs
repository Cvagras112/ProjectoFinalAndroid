import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { SourceTextModule, SyntheticModule } from 'node:vm'
import { createElement } from 'react'
import * as jsx from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import { transformWithOxc } from 'vite'
import * as modelo from '../src/services/tiendas/tiendaPublicaModelo.js'
import { componentesCatalogo } from './soporte-catalogo.mjs'

async function cargar(archivo, dependencias) {
  let codigo = await readFile(new URL(archivo, import.meta.url), 'utf8')
  if (archivo.endsWith('.jsx')) {
    codigo = (await transformWithOxc(codigo, archivo, { jsx: { runtime: 'automatic' } })).code
  }
  const modulo = new SourceTextModule(codigo)
  await modulo.link(async (nombre) => {
    const datos = dependencias[nombre]
    assert.ok(datos, `Dependencia inesperada: ${nombre}`)
    return new SyntheticModule(Object.keys(datos), function () {
      for (const [clave, valor] of Object.entries(datos)) this.setExport(clave, valor)
    })
  })
  await modulo.evaluate()
  return modulo.namespace
}

const guardada = {
  id: 'tienda-prueba', activo: true, nombre: 'Tejidos del Sur',
  imagen: 'https://example.test/logo.png', descripcion: 'Tejidos hechos a mano.',
  categoria: 'Textiles y tejidos', sector: 'Calbuco',
  telefono: '+56 9 1234 5678', whatsapp: '987654321', emailContacto: 'contacto@example.test',
}

const contactos = await cargar('../src/components/ContactosPublicos.jsx', {
  'react/jsx-runtime': jsx,
  '../services/tiendas/tiendaPublicaModelo': modelo,
  './ContactosPublicos.css': {},
})

function enlacesContacto(html) {
  return [...html.matchAll(/href="([^"]+)"/g)]
    .map(coincidencia => coincidencia[1].replaceAll('&amp;', '&'))
    .filter(href => href.startsWith('https://wa.me/') || href.startsWith('mailto:'))
}

function textoVisible(html) {
  return html.replace(/<[^>]*>/g, '')
}

test('campos guardados, opcionales, datos inesperados y contactos chilenos', () => {
  const tienda = modelo.normalizarTiendaPublica(guardada)
  for (const campo of ['nombre', 'imagen', 'descripcion', 'categoria', 'sector', 'telefono', 'whatsapp', 'emailContacto']) {
    assert.equal(tienda[campo], guardada[campo])
  }
  const incompleta = modelo.normalizarTiendaPublica({ activo: true, nombre: '  ', imagen: {}, sector: null })
  assert.equal(incompleta.nombre, 'Emprendimiento BORA')
  assert.equal(incompleta.imagen, '')
  assert.equal(incompleta.sector, 'Sector no informado')
  assert.equal(incompleta.categoria, 'Tipo de emprendimiento no informado')
  assert.equal(modelo.normalizarTiendaPublica({ activo: false }), null)
  assert.equal(modelo.normalizarTiendaPublica(null), null)
  assert.equal(modelo.numeroContacto(guardada.telefono), '56912345678')
  assert.equal(modelo.numeroContacto(guardada.whatsapp), '56987654321')
  assert.equal(modelo.numeroContacto('123'), '')
  assert.equal(modelo.correoContacto('no-es-correo'), '')
})

async function montarDetalle(datos, productos = async () => []) {
  // Simula el ciclo de carga y estado sin Firebase ni una sesión iniciada.
  const estados = []
  const efectos = []
  let indice = 0
  let primera = true
  const hooks = {
    useState: (inicial) => {
      const i = indice++
      if (!(i in estados)) estados[i] = typeof inicial === 'function' ? inicial() : inicial
      return [estados[i], valor => { estados[i] = valor }]
    },
    useEffect: (efecto) => { if (primera) efectos.push(efecto) },
    useMemo: fn => fn(),
  }
  const pagina = await cargar('../src/pages/public/TiendaDetalle.jsx', {
    react: hooks,
    'react/jsx-runtime': jsx,
    'react-router-dom': {
      useParams: () => ({ slug: 'tienda-prueba' }),
      Link: ({ to, children, ...props }) => createElement('a', { ...props, href: to }, children),
    },
    '../../services/tiendas/tiendaService': { obtenerTiendaPublica: async () => datos },
    '../../services/productos/productoService': { obtenerProductosPorTienda: productos },
    '../../services/productos/productoModelo': { disponibilidadProducto: () => '' },
    '../../components/ImagenPublica': { default: ({ respaldo, ...props }) => createElement('img', { ...props, src: props.src || respaldo }) },
    '../../components/ContactosPublicos': contactos,
    '../../components/BotonSeguirTienda': { default: ({ tiendaId }) => createElement('button', { 'data-seguir': tiendaId }, 'Seguir tienda') },
    '../../components/public/CatalogoPublico': (await componentesCatalogo(hooks)).catalogo,
    './TiendaDetalle.css': {},
  })
  const renderizar = () => {
    indice = 0
    return renderToStaticMarkup(createElement(pagina.default))
  }
  assert.match(renderizar(), /Cargando emprendimiento/)
  primera = false
  efectos.forEach(efecto => efecto())
  await new Promise(resolve => setImmediate(resolve))
  return renderizar()
}

test('detalle público muestra los seis datos y conserva los datos al volver a cargar', async () => {
  const tienda = modelo.normalizarTiendaPublica(guardada)
  for (let carga = 0; carga < 2; carga++) {
    const html = await montarDetalle(tienda)
    for (const campo of ['nombre', 'imagen', 'descripcion', 'categoria', 'sector']) {
      assert.ok(html.includes(tienda[campo]), campo)
    }
    assert.doesNotMatch(html, /tel:/)
    assert.match(html, /https:\/\/wa.me\/56987654321/)
    assert.match(html, /mailto:contacto%40example.test/)
    assert.match(html, /href="\/tiendas"/)
    const visibles = textoVisible(html)
    for (const dato of [tienda.telefono, tienda.whatsapp, tienda.emailContacto]) {
      assert.ok(!visibles.includes(dato))
    }
    const [whatsapp, correo] = enlacesContacto(html)
    const cuerpo = `¡Hola! Encontré tu emprendimiento "${tienda.nombre}" en BORA y me gustaría obtener más información sobre tus productos.`
    assert.equal(new URL(whatsapp).searchParams.get('text'), `${cuerpo} ¡Muchas gracias!`)
    assert.equal(new URL(correo).searchParams.get('subject'), `Consulta desde BORA — ${tienda.nombre}`)
    assert.equal(new URL(correo).searchParams.get('body'), cuerpo)
    assert.match(html, /aria-label="Consultar por WhatsApp" title="Consultar por WhatsApp"/)
    assert.match(html, /aria-label="Consultar por correo electrónico" title="Consultar por correo electrónico"/)
    assert.match(html, /data-seguir="tienda-prueba"/)
    assert.doesNotMatch(visibles, /Tienda verificada/)
    assert.match(visibles, /Compartir tienda/)
  }
})

test('detalle sin opcionales, inexistente y con falla del catálogo', async () => {
  const html = await montarDetalle(modelo.normalizarTiendaPublica({ activo: true }))
  for (const texto of ['Tipo no informado', 'Descripción no disponible.']) {
    assert.ok(html.includes(texto), texto)
  }
  assert.match(html, /bora-tienda-portada--sin-foto/)
  assert.doesNotMatch(html, /Sector no informado|alt="Portada de/)
  assert.deepEqual(enlacesContacto(html), [])
  assert.match(await montarDetalle(null), /No encontramos este emprendimiento/)
  const fallo = await montarDetalle(modelo.normalizarTiendaPublica(guardada), async () => { throw new Error('sin conexión') })
  assert.match(fallo, /Tejidos del Sur/)
  assert.match(fallo, /No pudimos cargar los productos/)
})

test('contactos inválidos o faltantes ocultan solamente el ícono correspondiente', () => {
  const props = { whatsapp: guardada.whatsapp, correo: guardada.emailContacto, asunto: 'Consulta & más', mensajeWhatsApp: '¡Hola! "¿Precio?" & envío' }
  const renderizar = cambios => renderToStaticMarkup(createElement(contactos.default, { ...props, ...cambios }))
  assert.equal(enlacesContacto(renderizar({})).length, 2)
  const [soloCorreo] = enlacesContacto(renderizar({ whatsapp: '123' }))
  assert.ok(soloCorreo.startsWith('mailto:'))
  assert.equal(new URL(soloCorreo).searchParams.get('body'), props.mensajeWhatsApp)
  const [soloWhatsApp] = enlacesContacto(renderizar({ correo: 'inválido' }))
  assert.ok(soloWhatsApp.startsWith('https://wa.me/'))
  assert.equal(new URL(soloWhatsApp).searchParams.get('text'), props.mensajeWhatsApp)
  assert.equal(renderizar({ whatsapp: '', correo: '' }), '')
})

test('productos no utilizan el teléfono convencional como reemplazo de WhatsApp', async () => {
  const tienda = { nombre: guardada.nombre, telefono: guardada.telefono, emailContacto: guardada.emailContacto }
  const producto = { ID_Tienda: 't', Nombre: 'Chal', Precio: 10000, Disponible: true, Stock: 1 }
  const servicio = await cargar('../src/services/productos/productoService.js', {
    './inventarioTransacciones': { guardarProductoTransaccion: () => {} },
    './productoModelo': await import('../src/services/productos/productoModelo.js'),
    '../../firebase/config': { auth: {}, db: {} },
    'firebase/firestore': {
      collection: (_db, nombre) => nombre,
      getDocs: async nombre => ({ docs: [{ id: nombre === 'tiendas' ? 't' : 'p', data: () => nombre === 'tiendas' ? tienda : producto }] }),
      doc: () => {}, getDoc: () => {}, deleteDoc: () => {},
    },
  })
  const [resultado] = await servicio.obtenerProductos()
  assert.equal(resultado.whatsapp, '')
  assert.equal(resultado.emailContacto, guardada.emailContacto)
  tienda.whatsapp = guardada.whatsapp
  assert.equal((await servicio.obtenerProductos())[0].whatsapp, guardada.whatsapp)
})

test('producto: consulta en ambos canales con el precio de la variante seleccionada', async () => {
  const estados = []
  const efectos = []
  let indice = 0
  let primera = true
  const producto = {
    id: 'p', nombre: 'Chal "Lana & Sur"', tienda: guardada.nombre,
    precio: 10000, categoria: 'Textil', imagen: 'https://example.test/chal.png',
    whatsapp: guardada.whatsapp, emailContacto: guardada.emailContacto,
    variantes: [
      { id: 'a', name: 'Pequeño', price: 12000, active: true },
      { id: 'b', name: 'Grande', price: 25000, active: true },
    ],
  }
  const pagina = await cargar('../src/pages/public/ProductoDetalle.jsx', {
    react: {
      useState: inicial => {
        const i = indice++
        if (!(i in estados)) estados[i] = inicial
        return [estados[i], valor => { estados[i] = valor }]
      },
      useEffect: efecto => { if (primera) efectos.push(efecto) },
    },
    'react/jsx-runtime': jsx,
    'react-router-dom': {
      useParams: () => ({ id: 'p' }),
      Link: ({ to, children, ...props }) => createElement('a', { ...props, href: to }, children),
    },
    '../../services/productos/productoService': {
      obtenerProductoPorId: async () => producto, obtenerProductos: async () => [],
      IMAGEN_PRODUCTO_PREDETERMINADA: '/imagenes/Icono_BORA.png',
    },
    '../../services/productos/productoModelo': { disponibilidadProducto: () => 'Disponible' },
    '../../components/ContactosPublicos': contactos,
    '../../components/BotonFavorito': { default: () => null },
    './ProductoDetalle.css': {},
  })
  const arbol = () => { indice = 0; return pagina.default() }
  arbol()
  primera = false
  efectos.forEach(efecto => efecto())
  await new Promise(resolve => setImmediate(resolve))
  const buscarOpcion = (elemento, id) => {
    if (!elemento?.props) return
    if (elemento?.type === 'button' && elemento.key === 'variante:' + id) return elemento
    const hijos = elemento?.props?.children
    for (const hijo of [hijos].flat(Infinity)) {
      const encontrado = buscarOpcion(hijo, id)
      if (encontrado) return encontrado
    }
  }
  for (const variante of producto.variantes) {
    buscarOpcion(arbol(), variante.id).props.onClick()
    const html = renderToStaticMarkup(arbol())
    const precio = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(variante.price)
    const mensaje = `¡Hola! Vi el producto "${producto.nombre}" en BORA, publicado por "${producto.tienda}", opción "${variante.name}", con un precio de ${precio}. Me gustaría obtener más información.`
    const [whatsapp, correo] = enlacesContacto(html)
    assert.equal(new URL(whatsapp).searchParams.get('text'), mensaje)
    assert.equal(new URL(correo).searchParams.get('body'), mensaje)
    assert.equal(new URL(correo).searchParams.get('subject'), `Consulta por ${producto.nombre} - BORA`)
    assert.ok(!textoVisible(html).includes(producto.whatsapp))
    assert.ok(!textoVisible(html).includes(producto.emailContacto))
  }
  producto.variantes = []
  const html = renderToStaticMarkup(arbol())
  assert.match(new URL(enlacesContacto(html)[0]).searchParams.get('text'), /\$10\.000/)
})

test('imagen rota usa respaldo local sin reintentos infinitos y acepta una nueva URL', async () => {
  let estado = null
  const imagen = await cargar('../src/components/ImagenPublica.jsx', {
    react: { useState: () => [estado, valor => { estado = valor }] },
    'react/jsx-runtime': jsx,
  })
  const props = { src: 'https://example.test/rota.png', alt: 'Logo' }
  imagen.default(props).props.onError()
  const respaldo = imagen.default(props)
  assert.equal(respaldo.props.src, '/imagenes/Icono_BORA.png')
  respaldo.props.onError()
  assert.equal(imagen.default(props).props.src, respaldo.props.src)
  assert.equal(imagen.default({ ...props, src: 'https://example.test/nueva.png' }).props.src, 'https://example.test/nueva.png')
})

test('lecturas anónimas con reglas locales: listado, detalle, recarga, inactivas e inexistentes', {
  skip: !process.env.FIRESTORE_EMULATOR_HOST && 'Requiere Firestore Emulator; no usa producción.',
}, async () => {
  const { initializeTestEnvironment } = await import('@firebase/rules-unit-testing')
  const firestore = await import('firebase/firestore')
  const env = await initializeTestEnvironment({
    projectId: 'demo-bora-tiendas',
    firestore: { rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  })
  try {
    await env.withSecurityRulesDisabled(async contexto => {
      await firestore.setDoc(firestore.doc(contexto.firestore(), 'tiendas', guardada.id), { ...guardada, id: 'no-usar-este-id' })
      await firestore.setDoc(firestore.doc(contexto.firestore(), 'tiendas', 'inactiva'), { ...guardada, activo: false })
    })
    const db = env.unauthenticatedContext().firestore()
    const repositorio = await cargar('../src/repositories/tiendas/tiendaPublicaRepository.js', {
      'firebase/firestore': firestore, '../../firebase/config': { db },
    })
    const servicio = await cargar('../src/services/tiendas/tiendaService.js', {
      'firebase/firestore': firestore, '../../firebase/config': { db },
      '../../repositories/tiendas/tiendaPublicaRepository': repositorio,
      './tiendaPublicaModelo': modelo,
    })
    assert.equal((await servicio.obtenerTiendasPublicas()).length, 1)
    const tienda = await servicio.obtenerTiendaPublica(guardada.id)
    assert.equal(tienda.id, guardada.id)
    assert.deepEqual(await servicio.obtenerTiendaPublica(guardada.id), tienda)
    assert.equal(await servicio.obtenerTiendaPublica('inactiva'), null)
    assert.equal(await servicio.obtenerTiendaPublica('inexistente'), null)
    assert.equal(await servicio.obtenerTiendaPublica(''), null)
    assert.equal(await servicio.obtenerTiendaPublica('ruta/invalida'), null)
  } finally {
    await env.cleanup()
  }
})
