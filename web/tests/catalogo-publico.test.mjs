import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { componentesCatalogo, cargarComponentePublico } from './soporte-catalogo.mjs'
import { normalizarProducto } from '../src/services/productos/productoModelo.js'

function elementos(nodo, tipo) {
  if (!nodo?.props) return []
  return [nodo.type === tipo ? [nodo] : [], [nodo.props.children].flat(Infinity).flatMap(h => elementos(h, tipo))].flat()
}
function texto(nodo) {
  if (typeof nodo === 'string' || typeof nodo === 'number') return String(nodo)
  if (!nodo?.props) return ''
  return [nodo?.props?.children].flat(Infinity).map(texto).join('')
}
function ciclo() {
  const estados = []
  let indice = 0
  return {
    hooks: {
      useState: inicial => {
        const i = indice++
        if (!(i in estados)) estados[i] = typeof inicial === 'function' ? inicial() : inicial
        return [estados[i], valor => { estados[i] = valor }]
      },
      useMemo: fn => fn(),
    },
    renderizar: fn => { indice = 0; return fn() },
  }
}
const tienda = { id: 'sur', nombre: 'Taller del Sur', categoria: 'Artesanía y Manualidades', whatsapp: '912345678', emailContacto: 'sur@example.test' }
function producto(id, cambios = {}) {
  return { ...normalizarProducto({ ID_Tienda: 'sur', Nombre: id, Categoria: 'Cerámica', Precio: 12000, StockOriginal: 2, Disponible: true, ...cambios }, id), tienda: tienda.nombre, imagen: 'https://example.test/foto.png' }
}
const productos = [
  producto('Jarrón', { Descripcion: 'Pieza hecha a mano', Variantes: [{ id: 'azul', name: 'Azul', price: 18000, stock: 3, imageUrl: 'https://example.test/azul.png', active: true }] }),
  producto('Agotado', { StockOriginal: 0, Precio: 5000 }),
  producto('Pedido', { StockOriginal: 0, Categoria: 'Textiles', OfrecerPedido: true, Precio: 8000 }),
  producto('Ambas modalidades', { OfrecerPedido: true, Precio: 14000 }),
  producto('Sin control', { ManejaStock: false, StockOriginal: 0, Categoria: 'Textiles', Precio: 20000 }),
]

async function montar(props = {}) {
  const react = ciclo()
  const { catalogo, tarjeta } = await componentesCatalogo(react.hooks)
  const datos = { productos, tienda, ...props }
  const arbol = () => react.renderizar(() => catalogo.default(datos))
  const ids = () => elementos(arbol(), tarjeta.default).map(t => t.props.producto.id)
  const elegir = nombre => elementos(arbol(), 'button').find(b => texto(b).startsWith(nombre)).props.onClick()
  return { arbol, ids, elegir, tarjeta }
}

test('tarjeta muestra nombre de tienda, categoría del producto, fotografía, precio y enlaces independientes', async () => {
  const { tarjeta } = await montar()
  const html = renderToStaticMarkup(createElement(tarjeta.default, { producto: productos[0], tienda }))
  for (const valor of ['Cerámica', 'Taller del Sur', 'https://example.test/foto.png', '$12.000', 'Original + 1 variante', 'Pieza hecha a mano']) assert.ok(html.includes(valor), valor)
  assert.match(html, /href="\/productos\/Jarrón"/)
  assert.match(html, /href="\/tiendas\/sur"/)
  assert.match(html, /data-favorito="Jarrón"/)
  for (const enlace of html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)) assert.doesNotMatch(enlace[1], /<button/)
  const visibles = html.replace(/<[^>]*>/g, '')
  assert.ok(!visibles.includes(tienda.whatsapp)); assert.ok(!visibles.includes(tienda.emailContacto))
  const enlaces = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1].replaceAll('&amp;', '&'))
  for (const enlace of enlaces.filter(e => e.startsWith('https://wa.me/') || e.startsWith('mailto:'))) {
    const url = new URL(enlace)
    const mensaje = url.searchParams.get(url.protocol === 'mailto:' ? 'body' : 'text')
    assert.ok(mensaje.includes('opción "Original"')); assert.ok(mensaje.includes('$12.000')); assert.ok(mensaje.includes(tienda.nombre))
  }
})

test('categoría de emprendimiento ausente conserva nombre de tienda y contactos válidos', async () => {
  const { tarjeta } = await montar()
  for (const categoria of ['', 'Tipo de emprendimiento no informado']) {
    const html = renderToStaticMarkup(createElement(tarjeta.default, { producto: productos[0], tienda: { ...tienda, categoria, whatsapp: '123' } }))
    assert.match(html, /class="bora-publico-tipo">Taller del Sur<\/span>/); assert.doesNotMatch(html, /wa.me/); assert.match(html, /mailto:/)
  }
})

test('categorías y conteos se calculan solo con los productos de la tienda', async () => {
  const { arbol, elegir, ids } = await montar()
  const opciones = elementos(arbol(), 'button')
  assert.equal(texto(opciones.find(b => texto(b).startsWith('Cerámica'))), 'Cerámica3')
  assert.equal(texto(opciones.find(b => texto(b).startsWith('Textiles'))), 'Textiles2')
  assert.ok(!opciones.some(b => texto(b) === 'Artesanía y Manualidades'))
  elegir('Textiles'); assert.deepEqual(ids(), ['Pedido', 'Sin control'])
})

test('búsqueda sin tildes, precio y ordenamiento se combinan sin mutar productos ni inventario', async () => {
  const antes = structuredClone(productos)
  const { arbol, ids, elegir } = await montar()
  elementos(arbol(), 'input').find(i => i.props.type === 'search').props.onChange({ target: { value: 'jarron' } })
  assert.deepEqual(ids(), ['Jarrón'])
  elegir('Limpiar')
  const numeros = elementos(arbol(), 'input').filter(i => i.props.type === 'number')
  numeros[0].props.onChange({ target: { value: '8000' } }); numeros[1].props.onChange({ target: { value: '14000' } })
  elementos(arbol(), 'select')[0].props.onChange({ target: { value: 'precio-desc' } })
  assert.deepEqual(ids(), ['Ambas modalidades', 'Jarrón', 'Pedido'])
  numeros[0].props.onChange({ target: { value: '15000' } })
  assert.match(renderToStaticMarkup(arbol()), /El mínimo debe ser menor o igual al máximo/)
  elegir('Limpiar'); assert.equal(ids().length, productos.length)
  assert.deepEqual(productos, antes)
})

test('disponibilidad respeta el modelo: sin control, agotado y a pedido, incluso cuando hay existencias', async () => {
  const { arbol, ids } = await montar()
  const filtrar = valor => elementos(arbol(), 'input').find(i => i.props.type === 'radio' && i.props.value === valor).props.onChange()
  filtrar('disponible'); assert.deepEqual(ids(), ['Jarrón', 'Ambas modalidades', 'Sin control'])
  filtrar('Agotado'); assert.deepEqual(ids(), ['Agotado'])
  filtrar('A pedido'); assert.deepEqual(ids(), ['Pedido', 'Ambas modalidades'])
  filtrar(''); assert.equal(ids().length, productos.length)
})

test('filtros plegables conservan selección y exponen estado accesible', async () => {
  const { arbol, elegir, ids } = await montar()
  const plegar = () => elementos(arbol(), 'button').find(b => b.props['aria-controls'] === 'catalogo-filtros')
  assert.equal(plegar().props['aria-expanded'], false)
  plegar().props.onClick(); assert.equal(plegar().props['aria-expanded'], true)
  elegir('Textiles'); plegar().props.onClick(); assert.equal(plegar().props['aria-expanded'], false)
  assert.deepEqual(ids(), ['Pedido', 'Sin control'])
})

test('carga, error y tienda sin productos muestran mensajes distintos', async () => {
  for (const [props, mensaje] of [
    [{ productos: [] }, 'Esta tienda todavía no tiene productos publicados.'],
    [{ cargando: true }, 'Preparando el catálogo'],
    [{ error: 'Falla de conexión' }, 'Falla de conexión'],
  ]) {
    const { arbol } = await montar(props)
    assert.ok(renderToStaticMarkup(arbol()).includes(mensaje))
  }
})

test('catálogo general carga cada servicio una vez y conserva productos si faltan metadatos', async () => {
  const estados = [], efectos = [], llamadas = []
  let indice = 0
  const { catalogo } = await componentesCatalogo({ useState: v => [v, () => {}], useMemo: f => f() })
  const pagina = await cargarComponentePublico('../src/pages/public/Productos.jsx', {
    react: { useState: valor => { const i = indice++; if (!(i in estados)) estados[i] = valor; return [estados[i], nuevo => { estados[i] = nuevo }] }, useEffect: fn => efectos.push(fn) },
    'react/jsx-runtime': await import('react/jsx-runtime'),
    '../../services/productos/productoService': { obtenerProductos: async () => { llamadas.push('productos'); return productos } },
    '../../services/tiendas/tiendaService': { obtenerTiendasPublicas: async () => { llamadas.push('tiendas'); throw Error('sin conexión') } },
    '../../services/categorias/categoriaService': { obtenerNombresCategoriasActivas: async () => { llamadas.push('categorias'); return [] } },
    '../../components/public/CatalogoPublico': catalogo, './Productos.css': {},
  })
  pagina.default(); efectos.forEach(fn => fn()); await new Promise(resolve => setImmediate(resolve))
  indice = 0
  const arbol = pagina.default(), props = elementos(arbol, catalogo.default)[0].props
  assert.deepEqual(llamadas, ['productos', 'tiendas', 'categorias'])
  assert.equal(props.productos, productos); assert.equal(props.error, ''); assert.equal(props.cargando, false)
  assert.match(texto(arbol), /No pudimos cargar los tipos de emprendimiento/)
})
