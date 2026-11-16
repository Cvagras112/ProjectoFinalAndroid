import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { SourceTextModule, SyntheticModule } from 'node:vm'
import { createElement } from 'react'
import * as jsx from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import { transformWithOxc } from 'vite'
import * as modelo from '../src/services/productos/productoModelo.js'
import * as modeloTienda from '../src/services/tiendas/tiendaPublicaModelo.js'
import { componentesCatalogo } from './soporte-catalogo.mjs'

async function cargar(archivo, dependencias) {
  let fuente = await readFile(new URL(archivo, import.meta.url), 'utf8')
  if (archivo.endsWith('.jsx')) fuente = (await transformWithOxc(fuente, archivo, { jsx: { runtime: 'automatic' } })).code
  const modulo = new SourceTextModule(fuente)
  await modulo.link(async nombre => {
    const valores = dependencias[nombre]
    assert.ok(valores, `Dependencia inesperada: ${nombre}`)
    return new SyntheticModule(Object.keys(valores), function () {
      for (const [clave, valor] of Object.entries(valores)) this.setExport(clave, valor)
    })
  })
  await modulo.evaluate()
  return modulo.namespace
}

const tienda = {
  activo: true, nombre: 'Lanas del Sur', categoria: 'Textiles y tejidos',
  whatsapp: '912345678', emailContacto: 'consultas@example.test',
}
const producto = {
  ID_Tienda: 'sur', Nombre: 'Chal de lana', Descripcion: 'Tejido a mano en Calbuco.',
  Categoria: 'Textil', TipoProducto: 'Chal', Precio: 9000, Stock: 6,
  imagen: 'https://example.test/chal.png', Disponible: true,
  Variantes: [
    { id: 'roja', name: 'Roja', price: 12000, stock: 2, imageUrl: 'https://example.test/roja.png', active: true },
    { id: 'azul', name: 'Azul', price: 25000, stock: 2, imageUrl: 'https://example.test/azul.png', active: true },
    { id: 'natural', name: 'Natural', price: 15000, stock: 2, imageUrl: '', active: true },
  ],
}
const datos = {
  tiendas: { sur: tienda, norte: { activo: true, nombre: 'Cerámica del Norte' } },
  productos: {
    chal: producto,
    manta: { ...producto, Nombre: 'Manta', Variantes: [], Precio: 18000 },
    taza: { ...producto, ID_Tienda: 'norte', Nombre: 'Taza', Variantes: [], Precio: 7000 },
    anterior: { ...producto, ID_Tienda: '', idTienda: 'norte', Nombre: 'Plato anterior', Variantes: [] },
  },
}

function firestoreSimulado() {
  const documento = (coleccion, id) => ({
    id, exists: () => Boolean(datos[coleccion]?.[id]), data: () => structuredClone(datos[coleccion]?.[id]),
  })
  return {
    collection: (_db, nombre) => nombre,
    doc: (_db, coleccion, id) => ({ coleccion, id }),
    getDoc: async ref => documento(ref.coleccion, ref.id),
    getDocs: async coleccion => ({ docs: Object.keys(datos[coleccion]).map(id => documento(coleccion, id)) }),
    deleteDoc: () => { throw new Error('No se permiten escrituras en estas pruebas públicas.') },
  }
}

async function servicioProductos(db = {}, firestore = firestoreSimulado()) {
  return cargar('../src/services/productos/productoService.js', {
    './inventarioTransacciones': { guardarProductoTransaccion: () => { throw new Error('No debe ejecutarse una transacción.') } },
    './productoModelo': modelo,
    'firebase/firestore': firestore,
    '../../firebase/config': { db, auth: {} },
  })
}

const contactos = await cargar('../src/components/ContactosPublicos.jsx', {
  'react/jsx-runtime': jsx, '../services/tiendas/tiendaPublicaModelo': modeloTienda,
  './ContactosPublicos.css': {},
})

async function montarPagina(nombre, servicio, tiendaPublica = modeloTienda.normalizarTiendaPublica({ ...tienda, id: 'sur' })) {
  const estados = [], efectos = []
  const pendientes = new Set()
  const servicioObservable = Object.fromEntries(Object.entries(servicio).map(([clave, valor]) => [clave,
    typeof valor !== 'function' ? valor : (...argumentos) => {
      const resultado = Promise.resolve(valor(...argumentos))
      pendientes.add(resultado)
      resultado.then(() => pendientes.delete(resultado), () => pendientes.delete(resultado))
      return resultado
    },
  ]))
  let indice = 0, primera = true
  const hooks = {
    useState: inicial => {
      const i = indice++
      if (!(i in estados)) estados[i] = typeof inicial === 'function' ? inicial() : inicial
      return [estados[i], valor => { estados[i] = valor }]
    },
    useEffect: efecto => { if (primera) efectos.push(efecto) },
    useMemo: fn => fn(),
  }
  const pagina = await cargar(`../src/pages/public/${nombre}.jsx`, {
    react: hooks, 'react/jsx-runtime': jsx,
    'react-router-dom': {
      useParams: () => ({ id: 'chal', slug: 'sur' }), useNavigate: () => () => {},
      Link: ({ to, children, ...props }) => createElement('a', { ...props, href: to }, children),
    },
    '../../services/productos/productoService': servicioObservable,
    '../../services/productos/productoModelo': modelo,
    '../../services/tiendas/tiendaService': {
      obtenerTiendaPublica: async () => tiendaPublica,
      obtenerTiendasPublicas: async () => Object.entries(datos.tiendas).map(([id, t]) => modeloTienda.normalizarTiendaPublica({ ...t, id })),
    },
    '../../services/categorias/categoriaService': { obtenerNombresCategoriasActivas: async () => ['Textil'] },
    '../../components/ContactosPublicos': contactos,
    '../../components/BotonSeguirTienda': { default: () => null },
    '../../components/public/CatalogoPublico': (await componentesCatalogo(hooks)).catalogo,
    '../../components/BotonFavorito': { default: () => null },
    '../../components/ImagenPublica': {
      default: ({ respaldo, ...props }) => createElement('img', { ...props, src: props.src || respaldo }),
    },
    [`./${nombre}.css`]: {},
  })
  const arbol = () => { indice = 0; return pagina.default() }
  const html = () => { indice = 0; return renderToStaticMarkup(createElement(pagina.default)) }
  html()
  primera = false
  efectos.forEach(efecto => efecto())
  do {
    await Promise.allSettled([...pendientes])
    await new Promise(resolve => setImmediate(resolve))
  } while (pendientes.size)
  return { arbol, html }
}

function elementos(nodo, tipo) {
  if (!nodo?.props) return []
  return [nodo.type === tipo ? [nodo] : [], [nodo.props.children].flat(Infinity)
    .flatMap(hijo => elementos(hijo, tipo))].flat()
}

test('W01: consulta por tienda conserva solo sus productos, incluidos documentos anteriores', async () => {
  const servicio = await servicioProductos()
  assert.deepEqual([...await servicio.obtenerProductosPorTienda('sur')].map(p => p.id), ['chal', 'manta'])
  assert.deepEqual([...await servicio.obtenerProductosPorTienda('norte')].map(p => p.id), ['taza', 'anterior'])
  const detalle = await montarPagina('TiendaDetalle', servicio)
  const html = detalle.html()
  assert.match(html, /href="\/productos\/chal"/)
  assert.match(html, /href="\/productos\/manta"/)
  assert.doesNotMatch(html, /href="\/productos\/(taza|anterior)"/)
})

test('W02–W05: tienda y catálogo muestran nombre, fotografía, descripción, precio CLP y categoría persistidos', async () => {
  const servicio = await servicioProductos()
  const antes = structuredClone(datos)
  for (const nombre of ['TiendaDetalle', 'Productos']) {
    const pagina = await montarPagina(nombre, servicio)
    const html = pagina.html()
    for (const texto of [producto.Nombre, producto.imagen, producto.Descripcion, producto.Categoria, '$9.000']) {
      assert.ok(html.includes(texto), `${nombre}: ${texto}`)
    }
  }
  const detalle = await servicio.obtenerProductoPorId('chal')
  assert.equal(detalle.tiendaId, 'sur')
  assert.equal(detalle.tienda, tienda.nombre)
  assert.equal(detalle.tipoProducto, 'Chal')
  assert.equal(await servicio.obtenerProductoPorId('inexistente'), null)
  assert.deepEqual(datos, antes)
})

test('W02–W07: detalle y selección de variantes actualizan precio, imagen y ambos mensajes de contacto', async () => {
  const servicio = await servicioProductos()
  const pagina = await montarPagina('ProductoDetalle', servicio)
  const inicial = pagina.html()
  for (const texto of [producto.Nombre, producto.Descripcion, producto.Categoria, '$9.000', producto.imagen]) {
    assert.ok(inicial.includes(texto), texto)
  }
  assert.match(inicial, /href="\/tiendas\/sur"/)
  assert.equal(elementos(pagina.arbol(),'button').filter(e=>e.props.className==='bora-producto-opcion' && e.props['aria-pressed']).length,1)
  assert.equal(elementos(pagina.arbol(),'img')[0].props.src,producto.imagen)
  for (const variante of producto.Variantes) {
    const selector = elementos(pagina.arbol(), 'button').find(e=>e.key==='variante:'+variante.id)
    selector.props.onClick()
    const arbol = pagina.arbol()
    const foto = elementos(arbol, 'img')[0]
    assert.equal(foto.props.src, variante.imageUrl || producto.imagen)
    const precio = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(variante.price)
    assert.equal(elementos(arbol, 'strong').find(e => e.props.className === 'bora-producto-precio').props.children, precio)
    const html = pagina.html()
    const enlaces = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1].replaceAll('&amp;', '&'))
    const mensaje = `¡Hola! Vi el producto "${producto.Nombre}" en BORA, publicado por "${tienda.nombre}", opción "${variante.name}", con un precio de ${precio}. Me gustaría obtener más información.`
    assert.equal(new URL(enlaces.find(url => url.startsWith('https://wa.me/'))).searchParams.get('text'), mensaje)
    assert.equal(new URL(enlaces.find(url => url.startsWith('mailto:'))).searchParams.get('body'), mensaje)
    assert.equal(selector.props.type,'button')
    assert.equal(elementos(pagina.arbol(),'button').find(e=>e.key==='variante:'+variante.id).props['aria-pressed'],true)
  }
  elementos(pagina.arbol(),'button').find(e=>e.key==='original').props.onClick()
  assert.equal(elementos(pagina.arbol(),'img')[0].props.src,producto.imagen)
  assert.match(pagina.html(),/Opción seleccionada: Original/)
})

test('producto sin variantes conserva fotografía y precio generales; sin fotografía usa el respaldo existente', async () => {
  const servicio = await servicioProductos()
  const sinVariantes = await servicio.obtenerProductoPorId('manta')
  const pagina = await montarPagina('ProductoDetalle', {
    ...servicio, obtenerProductoPorId: async () => sinVariantes,
  })
  assert.equal(elementos(pagina.arbol(), 'select').length, 0)
  assert.equal(elementos(pagina.arbol(), 'img')[0].props.src, producto.imagen)
  assert.match(pagina.html(), /\$18\.000/)
  const respaldo = await cargar('../src/services/productos/productoService.js', {
    './inventarioTransacciones': { guardarProductoTransaccion: () => {} }, './productoModelo': modelo,
    '../../firebase/config': { db: {}, auth: {} },
    'firebase/firestore': {
      ...firestoreSimulado(),
      getDoc: async () => ({ exists: () => true, data: () => ({ ...producto, Variantes: [], imagen: '' }), id: 'sin-foto' }),
    },
  })
  assert.equal((await respaldo.obtenerProductoPorId('sin-foto')).imagen, respaldo.IMAGEN_PRODUCTO_PREDETERMINADA)
})

test('original y miniaturas actualizan stock, precio, fotografía, selección y contactos sin publicar datos', async () => {
  const p={...modelo.normalizarProducto({...producto,StockOriginal:8,Stock:23,Variantes:[
    {...producto.Variantes[0],stock:10}, {...producto.Variantes[1],stock:5}, {...producto.Variantes[2],active:false},
  ]},'chal'),tienda:tienda.nombre,whatsapp:tienda.whatsapp,emailContacto:tienda.emailContacto}
  const pagina=await montarPagina('ProductoDetalle',{obtenerProductoPorId:async()=>p,obtenerProductos:async()=>[],IMAGEN_PRODUCTO_PREDETERMINADA:'/respaldo.png'})
  const opciones=()=>elementos(pagina.arbol(),'button').filter(b=>b.props.className==='bora-producto-opcion')
  assert.equal(opciones().length,3)
  for(const [id,nombre,stock,precio,imagen] of [
    ['', 'Original',8,9000,producto.imagen],
    ['roja','Roja',10,12000,producto.Variantes[0].imageUrl],
    ['azul','Azul',5,25000,producto.Variantes[1].imageUrl],
    ['', 'Original',8,9000,producto.imagen],
  ]) {
    opciones().find(b=>b.key===(id?'variante:'+id:'original')).props.onClick()
    const seleccion=elementos(pagina.arbol(),'p').find(e=>e.props['aria-live']==='polite')
    const texto=renderToStaticMarkup(seleccion)
    assert.ok(texto.includes(nombre));assert.ok(texto.includes('Disponible · '+stock+' unidades'))
    assert.equal(elementos(pagina.arbol(),'img')[0].props.src,imagen)
    assert.equal(opciones().filter(b=>b.props['aria-pressed']).length,1)
    const html=pagina.html(), enlaces=[...html.matchAll(/href="([^"]+)"/g)].map(m=>m[1].replaceAll('&amp;','&'))
    for(const enlace of enlaces.filter(u=>u.startsWith('mailto:')||u.startsWith('https://wa.me/'))) {
      const url=new URL(enlace), cuerpo=url.searchParams.get(url.protocol==='mailto:'?'body':'text')
      assert.ok(cuerpo.includes(`opción "${nombre}"`))
      assert.ok(cuerpo.includes(new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(precio)))
    }
  }
})

test('servicio transmite StockOriginal al guardar sin convertir el total en existencias nuevas', async () => {
  const solicitudes=[]
  const servicio=await cargar('../src/services/productos/productoService.js',{
    './inventarioTransacciones':{guardarProductoTransaccion:async(...args)=>{solicitudes.push(args[2]);return {productoId:'p'}}},
    './productoModelo':modelo,
    '../../firebase/config':{db:{},auth:{currentUser:{uid:'duena'}}},
    'firebase/firestore':{
      ...firestoreSimulado(),
      getDoc:async()=>({exists:()=>true,data:()=>({activo:true,ID_Tienda:'t',ID_Dueno:'duena'})}),
      doc:()=>({id:'p'}),
    },
  })
  await servicio.crearProducto('t',{nombre:'Taza',categoria:'Cerámica',precio:'4000',stockOriginal:'8',stock:'23',variantes:[{id:'r',name:'Roja',price:'3000',stock:'10',active:true}]})
  assert.equal(solicitudes[0].datos.StockOriginal,8)
  assert.equal('Stock' in solicitudes[0].datos,false)
  assert.equal(solicitudes[0].datos.Variantes[0].stock,10)
  await assert.rejects(servicio.crearProducto('t',{nombre:'Taza',categoria:'Cerámica',precio:'4000',stockOriginal:'-1'}),/stock/)
})

test('Firebase Emulator: datos persistidos, pertenencia por tienda y detalle público con variantes', {
  skip: !process.env.FIRESTORE_EMULATOR_HOST && 'Requiere Firestore Emulator; no utiliza producción.',
}, async () => {
  const firestore = await import('firebase/firestore')
  const { initializeTestEnvironment } = await import('@firebase/rules-unit-testing')
  const env = await initializeTestEnvironment({
    projectId: 'demo-bora-productos-publicos',
    firestore: { rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  })
  try {
    await env.withSecurityRulesDisabled(async contexto => {
      const batch = firestore.writeBatch(contexto.firestore())
      for (const [coleccion, documentos] of Object.entries(datos)) {
        for (const [id, valores] of Object.entries(documentos)) batch.set(firestore.doc(contexto.firestore(), coleccion, id), valores)
      }
      await batch.commit()
    })
    const servicio = await servicioProductos(env.unauthenticatedContext().firestore(), firestore)
    const publicados = await servicio.obtenerProductosPorTienda('sur')
    assert.deepEqual([...publicados].map(p => p.id).sort(), ['chal', 'manta'])
    for (let carga = 0; carga < 2; carga++) {
      const detalle = await servicio.obtenerProductoPorId('chal')
      assert.equal(detalle.nombre, producto.Nombre)
      assert.equal(detalle.descripcion, producto.Descripcion)
      assert.equal(detalle.imagen, producto.imagen)
      assert.equal(detalle.categoria, producto.Categoria)
      assert.equal(detalle.precio, producto.Precio)
      assert.deepEqual(detalle.variantes, producto.Variantes)
      assert.equal(detalle.tiendaId, 'sur')
      assert.equal(detalle.tienda, tienda.nombre)
      const pagina = await montarPagina('ProductoDetalle', servicio)
      assert.ok(pagina.html().includes(producto.Nombre))
    }
    const paginaTienda = await montarPagina('TiendaDetalle', servicio)
    assert.match(paginaTienda.html(), /href="\/productos\/chal"/)
    assert.doesNotMatch(paginaTienda.html(), /href="\/productos\/taza"/)
  } finally {
    await env.cleanup()
  }
})
