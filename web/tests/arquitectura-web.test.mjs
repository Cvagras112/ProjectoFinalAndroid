import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { SourceTextModule, SyntheticModule } from 'node:vm'
import { createElement } from 'react'
import * as jsx from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import { transformWithOxc } from 'vite'
import { componentesCatalogo } from './soporte-catalogo.mjs'

async function cargar(archivo, dependencias) {
  let codigo = await readFile(new URL(archivo, import.meta.url), 'utf8')
  if (archivo.endsWith('.jsx')) codigo = (await transformWithOxc(codigo, archivo, { jsx: { runtime: 'automatic' } })).code
  const modulo = new SourceTextModule(codigo)
  await modulo.link(async nombre => {
    const datos = dependencias[nombre]
    assert.ok(datos, nombre)
    return new SyntheticModule(Object.keys(datos), function () {
      for (const [clave, valor] of Object.entries(datos)) this.setExport(clave, valor)
    })
  })
  await modulo.evaluate()
  return modulo.namespace
}

function cicloReact() {
  const estados = [], efectos = []
  let indice = 0, primera = true
  return {
    hooks: {
      useState: inicial => {
        const i = indice++
        if (!(i in estados)) estados[i] = typeof inicial === 'function' ? inicial() : inicial
        return [estados[i], valor => { estados[i] = typeof valor === 'function' ? valor(estados[i]) : valor }]
      },
      useEffect: efecto => { if (primera) efectos.push(efecto) },
      useRef: valor => ({ current: valor }),
      useCallback: fn => fn,
      useMemo: fn => fn(),
    },
    renderizar: componente => { indice = 0; return componente() },
    montar: async () => {
      primera = false
      efectos.forEach(efecto => efecto())
      await new Promise(resolve => setImmediate(resolve))
    },
  }
}

function elementos(nodo, tipo) {
  if (!nodo?.props) return []
  return [nodo.type === tipo ? [nodo] : [],
    [nodo.props.children].flat(Infinity).flatMap(hijo => elementos(hijo, tipo))].flat()
}

function texto(nodo) {
  if (typeof nodo === 'string' || typeof nodo === 'number') return String(nodo)
  return [nodo?.props?.children].flat(Infinity).map(hijo => hijo?.props ? texto(hijo) :
    typeof hijo === 'string' || typeof hijo === 'number' ? String(hijo) : '').join('')
}

test('categorías: repositorio consulta la colección existente y servicio conserva el filtro anterior', async () => {
  const documentos = [
    { nombre: ' Textil ', estado: 'Activa' }, { nombre: 'Artesanía', estado: 'Activa' },
    { nombre: 'Inactiva', estado: 'Inactiva' }, { nombre: ' ', estado: 'Activa' },
    { nombre: 123, estado: 'Activa' },
  ]
  const repositorio = await cargar('../src/repositories/categorias/categoriaRepository.js', {
    'firebase/firestore': {
      collection: (_db, nombre) => { assert.equal(nombre, 'categorias'); return nombre },
      getDocs: async () => ({ docs: documentos.map(d => ({ data: () => d })) }),
    },
    '../../firebase/config': { db: {} },
  })
  const servicio = await cargar('../src/services/categorias/categoriaService.js', {
    '../../repositories/categorias/categoriaRepository': repositorio,
  })
  assert.deepEqual([...await servicio.obtenerNombresCategoriasActivas()], ['Textil', 'Artesanía'])
})

test('catálogo: selección de categoría, búsqueda con tildes, limpiar y precios CLP', async () => {
  const ciclo = cicloReact()
  const productos = [
    { id: '1', nombre: 'Chal', categoria: 'Textil', tienda: 'Sur', precio: 12500 },
    { id: '2', nombre: 'Jarrón', categoria: 'Artesanía', tienda: 'Norte', precio: 8000 },
    { id: '3', nombre: 'Canasto', categoria: 'Legado', tienda: 'Sur', precio: 6000 },
  ]
  const { catalogo, tarjeta } = await componentesCatalogo(ciclo.hooks)
  const arbol = () => ciclo.renderizar(() => catalogo.default({ productos, categoriasAdicionales: ['Textil', 'Artesanía', 'Sin productos'] }))
  arbol()
  await ciclo.montar()
  const tarjetas = () => elementos(arbol(), tarjeta.default).map(t => `Ver detalles de ${t.props.producto.nombre}`)
  assert.equal(tarjetas().length, 3)
  assert.ok(elementos(arbol(), 'button').some(b => texto(b).startsWith('Legado')))
  const elegir = nombre => elementos(arbol(), 'button').find(b => texto(b).startsWith(nombre)).props.onClick()
  elegir('Textil')
  assert.deepEqual(tarjetas(), ['Ver detalles de Chal'])
  assert.match(renderToStaticMarkup(arbol()), /\$12\.500/)
  elegir('Sin productos')
  assert.equal(tarjetas().length, 0)
  elegir('Limpiar')
  assert.equal(tarjetas().length, 3)
  const buscador = elementos(arbol(), 'input').find(i => i.props.type === 'search')
  buscador.props.onChange({ target: { value: 'jarron' } })
  assert.deepEqual(tarjetas(), ['Ver detalles de Jarrón'])
  assert.deepEqual(productos.map(p => p.precio), [12500, 8000, 6000])
})

test('lecturas compartidas autorizadas: Navbar y MiPerfil conservan el perfil entregado por el servicio', async () => {
  for (const nombre of ['Navbar', 'MiPerfil']) {
    const ciclo = cicloReact()
    let cambiarSesion
    const consultas = []
    const base = nombre === 'Navbar' ? '../' : '../../'
    const pagina = await cargar(nombre === 'Navbar' ? '../src/components/Navbar.jsx' : '../src/pages/perfil/MiPerfil.jsx', {
      react: ciclo.hooks, 'react/jsx-runtime': jsx,
      'react-router-dom': {
        Link: ({ to, children, ...props }) => createElement('a', { ...props, href: to }, children),
        useNavigate: () => () => {}, useLocation: () => ({ pathname: '/' }),
      },
      'firebase/auth': {
        onAuthStateChanged: (_auth, callback) => { cambiarSesion = callback; return () => {} },
        signOut: async () => {}, EmailAuthProvider: {}, reauthenticateWithCredential: async () => {}, updatePassword: async () => {},
      },
      [base + 'firebase/config']: { auth: {} },
      [base + 'services/auth/authService']: {
        obtenerPerfilUsuario: async uid => {
          consultas.push(uid)
          return { nombre: 'Javiera de prueba', rol: 'emprendedor', activo: true, email: 'prueba@example.test' }
        },
      },
      ['./' + nombre + '.css']: {},
    })
    const arbol = () => ciclo.renderizar(pagina.default)
    arbol()
    await ciclo.montar()
    await cambiarSesion({ uid: 'u', email: 'prueba@example.test', providerData: [] })
    assert.deepEqual(consultas, ['u'])
    assert.match(renderToStaticMarkup(arbol()), /Javiera de prueba/)
    await cambiarSesion(null)
    assert.doesNotMatch(renderToStaticMarkup(arbol()), /Javiera de prueba/)
  }
})

test('páginas y componentes de Javiera no importan Firestore ni repositorios directamente', async () => {
  const revisar = async directorio => {
    for (const entrada of await readdir(new URL(directorio, import.meta.url), { withFileTypes: true })) {
      if (entrada.name === 'admin' || entrada.name === 'RutaAdmin.jsx' || entrada.name.includes('.backup.')) continue
      const ruta = directorio + '/' + entrada.name
      if (entrada.isDirectory()) await revisar(ruta)
      else if (entrada.name.endsWith('.jsx')) {
        const fuente = await readFile(new URL(ruta, import.meta.url), 'utf8')
        assert.doesNotMatch(fuente, /from\s+['"][^'"]*(?:firebase\/firestore|repositories\/)/, ruta)
      }
    }
  }
  await revisar('../src/pages')
  await revisar('../src/components')
})

test('formulario de emprendedora permite cinco variantes y bloquea la sexta incluso por el controlador', async () => {
  const ciclo = cicloReact()
  let cambiarSesion
  const pagina = await cargar('../src/pages/emprendedor/PanelEmprendedor.jsx', {
    react: ciclo.hooks, 'react/jsx-runtime': jsx,
    'react-router-dom': { Link: ({ to, children, ...props }) => createElement('a', { ...props, href: to }, children) },
    'firebase/auth': { onAuthStateChanged: (_auth, callback) => { cambiarSesion = callback; return () => {} } },
    '../../firebase/config': { auth: {} },
    '../../services/tiendas/tiendaService': { obtenerTiendaEmprendedor: async () => ({ id:'t', nombre:'Tienda de prueba', activo:true }) },
    '../../services/productos/productoService': {
      obtenerProductosPorTienda: async () => [], crearProducto: async () => {}, editarProducto: async () => {}, eliminarProducto: async () => {},
    },
    '../../components/emprendedor/VentasPanel': { default: () => null },
    '../../components/ImagenPublica': { default: props => createElement('img',props) },
    './PanelEmprendedor.css': {},
  })
  const arbol = () => ciclo.renderizar(pagina.default)
  arbol()
  await ciclo.montar()
  await cambiarSesion({ uid:'u' })
  elementos(elementos(arbol(),'nav')[0],'button').find(b => texto(b)==='Mis productos').props.onClick()
  elementos(arbol(),'button').find(b => texto(b).includes('Agregar producto')).props.onClick()
  for (let cantidad = 0; cantidad < 5; cantidad++) {
    const boton = elementos(arbol(),'button').find(b => texto(b).includes('Agregar variante'))
    assert.equal(boton.props.disabled,false)
    boton.props.onClick()
  }
  const boton = elementos(arbol(),'button').find(b => texto(b).includes('Agregar variante'))
  assert.equal(boton.props.disabled,true)
  assert.equal(elementos(arbol(),'h4').filter(e => texto(e).startsWith('Variante ')).length,5)
  boton.props.onClick()
  assert.equal(elementos(arbol(),'h4').filter(e => texto(e).startsWith('Variante ')).length,5)
  assert.match(renderToStaticMarkup(arbol()),/Máximo 5 variantes/)
})

test('categorías públicas en Firestore Emulator mediante servicio y repositorio', {
  skip: !process.env.FIRESTORE_EMULATOR_HOST && 'Requiere Firestore Emulator; no utiliza producción.',
}, async () => {
  const { initializeTestEnvironment } = await import('@firebase/rules-unit-testing')
  const firestore = await import('firebase/firestore')
  const env = await initializeTestEnvironment({
    projectId: 'demo-bora-categorias',
    firestore: { rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  })
  try {
    await env.withSecurityRulesDisabled(async contexto => {
      await firestore.setDoc(firestore.doc(contexto.firestore(), 'categorias', 'activa'), { nombre: ' Artesanía ', estado: 'Activa' })
      await firestore.setDoc(firestore.doc(contexto.firestore(), 'categorias', 'inactiva'), { nombre: 'Textil', estado: 'Inactiva' })
    })
    const db = env.unauthenticatedContext().firestore()
    const repositorio = await cargar('../src/repositories/categorias/categoriaRepository.js', {
      'firebase/firestore': firestore, '../../firebase/config': { db },
    })
    const servicio = await cargar('../src/services/categorias/categoriaService.js', {
      '../../repositories/categorias/categoriaRepository': repositorio,
    })
    assert.deepEqual([...await servicio.obtenerNombresCategoriasActivas()], ['Artesanía'])
  } finally {
    await env.cleanup()
  }
})

test('editar producto antiguo confirma stock original y muestra totales sin controles por variante', async () => {
  const {normalizarProducto}=await import('../src/services/productos/productoModelo.js')
  const p=normalizarProducto({Nombre:'Taza',Precio:4000,Stock:15,Categoria:'Otros',imagen:'https://example.test/taza.png',Variantes:[
    {id:'r',name:'Roja',price:3000,stock:10,active:true},{id:'a',name:'Azul',price:5000,stock:5,active:true},
  ]},'p')
  const ciclo=cicloReact(), guardados=[]
  let cambiarSesion
  const pagina=await cargar('../src/pages/emprendedor/PanelEmprendedor.jsx',{
    react:ciclo.hooks,'react/jsx-runtime':jsx,
    'react-router-dom':{Link:({to,children,...props})=>createElement('a',{...props,href:to},children)},
    'firebase/auth':{onAuthStateChanged:(_auth,cb)=>{cambiarSesion=cb;return()=>{}}},
    '../../firebase/config':{auth:{}},
    '../../services/tiendas/tiendaService':{obtenerTiendaEmprendedor:async()=>({id:'t',nombre:'Tienda',activo:true})},
    '../../services/productos/productoService':{obtenerProductosPorTienda:async()=>[p],crearProducto:async()=>{},eliminarProducto:async()=>{},editarProducto:async(...args)=>guardados.push(args)},
    '../../components/emprendedor/VentasPanel':{default:()=>null},'./PanelEmprendedor.css':{},
    '../../components/ImagenPublica':{default:props=>createElement('img',props)},
  })
  const arbol=()=>ciclo.renderizar(pagina.default)
  arbol();await ciclo.montar();await cambiarSesion({uid:'u'})
  elementos(elementos(arbol(),'nav')[0],'button').find(b=>texto(b)==='Mis productos').props.onClick()
  elementos(arbol(),'button').find(b=>texto(b)==='Editar').props.onClick()
  const campo=nombre=>elementos(arbol(),'input').find(i=>i.props.name===nombre)
  assert.equal(campo('stockOriginal').props.value,'0');assert.equal(campo('stockOriginal').props.readOnly,undefined)
  assert.match(renderToStaticMarkup(arbol()),/stock original parte de 0/)
  await elementos(arbol(),'form')[0].props.onSubmit({preventDefault(){}})
  assert.equal(guardados.length,0)
  campo('stockOriginal').props.onChange({target:{name:'stockOriginal',type:'number',value:'8'}})
  const resumen=elementos(arbol(),'label').find(l=>texto(l).startsWith('Stock total disponible'))
  assert.equal(elementos(resumen,'input')[0].props.value,23)
  for(const nombre of ['disponible','ofrecerPedido','piezaUnica']) assert.equal(elementos(arbol(),'input').filter(i=>i.props.name===nombre).length,1)
  const variantes=elementos(arbol(),'fieldset').find(f=>f.props.className==='panel-emprendedor__variantes')
  assert.equal(elementos(variantes,'input').filter(i=>['disponible','ofrecerPedido','piezaUnica'].includes(i.props.name)).length,0)
  campo('stockOriginalConfirmado').props.onChange({target:{name:'stockOriginalConfirmado',type:'checkbox',checked:true}})
  await elementos(arbol(),'form')[0].props.onSubmit({preventDefault(){}})
  assert.equal(guardados.length,1);assert.equal(guardados[0][2].stockOriginal,'8')
  assert.deepEqual([...guardados[0][2].variantes].map(v=>v.stock),['10','5'])
})

test('panel de ventas permite original con variantes, aplica stock de la opción y envía su identidad', async () => {
  const {normalizarProducto}=await import('../src/services/productos/productoModelo.js')
  const p=normalizarProducto({Nombre:'Taza',Precio:4000,StockOriginal:8,Stock:23,Variantes:[{id:'r',name:'Roja',price:3000,stock:10,active:true},{id:'a',name:'Azul',price:5000,stock:5,active:true}]},'p')
  const ciclo=cicloReact(), operaciones=[]
  const previa=globalThis.sessionStorage, almacen=new Map()
  globalThis.sessionStorage={getItem:k=>almacen.get(k)||null,setItem:(k,v)=>almacen.set(k,v),removeItem:k=>almacen.delete(k)}
  try {
    const pagina=await cargar('../src/components/emprendedor/VentasPanel.jsx',{
      react:ciclo.hooks,'react/jsx-runtime':jsx,'../../firebase/config':{auth:{currentUser:{uid:'duena'}}},
      '../../services/ventas/ventaService':{observarVentas:(_id,cb)=>{cb([]);return()=>{}},registrarVenta:async(...args)=>operaciones.push(args)},
    })
    const arbol=()=>ciclo.renderizar(()=>pagina.default({tiendaId:'t',productos:[p],actualizarProductos:async()=>{}}))
    arbol();await ciclo.montar()
    elementos(arbol(),'select')[0].props.onChange({target:{value:'p'}})
    assert.equal(elementos(arbol(),'select')[1].props.value,'')
    assert.match(renderToStaticMarkup(arbol()),/Existencias disponibles: 8/)
    assert.match(renderToStaticMarkup(arbol()),/\$4\.000/)
    elementos(arbol(),'select')[1].props.onChange({target:{value:'r'}})
    assert.match(renderToStaticMarkup(arbol()),/Existencias disponibles: 10/)
    assert.match(renderToStaticMarkup(arbol()),/\$3\.000/)
    const cantidad=()=>elementos(arbol(),'input').find(i=>i.props.type==='number')
    cantidad().props.onChange({target:{value:'11'}})
    assert.equal(elementos(arbol(),'button').find(b=>b.props.type==='submit').props.disabled,true)
    elementos(arbol(),'select')[1].props.onChange({target:{value:''}})
    cantidad().props.onChange({target:{value:'1'}})
    assert.equal(cantidad().props.max,8)
    assert.equal(elementos(arbol(),'button').find(b=>b.props.type==='submit').props.disabled,false)
    await elementos(arbol(),'form')[0].props.onSubmit({preventDefault(){}})
    assert.equal(operaciones.length,1);assert.equal(operaciones[0][0].varianteId,'');assert.equal(operaciones[0][0].cantidad,1)
    assert.match(renderToStaticMarkup(arbol()),/Venta registrada/)
  } finally {
    if(previa===undefined) delete globalThis.sessionStorage
    else globalThis.sessionStorage=previa
  }
})

async function montarPanelNavegable(opciones={}) {
  const ciclo=cicloReact(), consultas=[], guardados=[], ediciones=[]
  const tienda={id:'t',nombre:'Taller del Sur',activo:true,categoria:'Artesanía',sector:'Calbuco',descripcion:'Creaciones hechas a mano.'}
  const productos=[{id:'p',nombre:'Taza',categoria:'Otros',precio:4000,precioBase:4000,stock:23,stockOriginal:8,stockVariantes:15,imagen:'https://example.test/taza.png',disponible:true,revision:1,variantes:[{id:'r',name:'Roja',price:3000,stock:10,active:true},{id:'a',name:'Azul',price:5000,stock:5,active:true}]}]
  const ventas=props=>createElement('section',{'data-ventas-tienda':props.tiendaId},'Registro e historial existentes')
  let cambiarSesion
  const pagina=await cargar('../src/pages/emprendedor/PanelEmprendedor.jsx',{
    react:ciclo.hooks,'react/jsx-runtime':jsx,
    'react-router-dom':{Link:({to,children,...props})=>createElement('a',{...props,href:to},children)},
    'firebase/auth':{onAuthStateChanged:(_auth,cb)=>{cambiarSesion=cb;return()=>{}}},
    '../../firebase/config':{auth:{currentUser:{uid:'u',displayName:'Javiera'}}},
    '../../services/tiendas/tiendaService':{obtenerTiendaEmprendedor:async()=>{consultas.push('tienda');return tienda}},
    '../../services/productos/productoService':{
      obtenerProductosPorTienda:async()=>{consultas.push('productos');return opciones.obtener ? opciones.obtener(productos,consultas.filter(c=>c==='productos').length) : productos},
      crearProducto:async(...args)=>{guardados.push(args);return opciones.crear?.(...args)},
      editarProducto:async(...args)=>{ediciones.push(args);return opciones.editar?.(...args)},eliminarProducto:async()=>{},
    },
    '../../components/emprendedor/VentasPanel':{default:ventas},'./PanelEmprendedor.css':{},
    '../../components/ImagenPublica':{default:props=>createElement('img',props)},
  })
  const arbol=()=>ciclo.renderizar(pagina.default)
  arbol();await ciclo.montar();await cambiarSesion({uid:'u'})
  const navegar=nombre=>elementos(elementos(arbol(),'nav')[0],'button').find(b=>texto(b)===nombre).props.onClick()
  return {arbol,navegar,consultas,guardados,ediciones,productos,ventas}
}

test('dashboard: cuatro secciones, resumen real, rutas conservadas y ventas reutilizadas sin nuevas consultas',async()=>{
  const {arbol,navegar,consultas,productos,ventas}=await montarPanelNavegable()
  for(const nombre of ['Inicio','Mis productos','Ventas','Mi tienda']) {
    navegar(nombre)
    const nav=elementos(arbol(),'nav')[0], botones=elementos(nav,'button')
    assert.deepEqual(botones.map(texto),['Inicio','Mis productos','Ventas','Mi tienda'])
    assert.deepEqual(botones.filter(b=>b.props['aria-current']==='page').map(texto),[nombre])
    assert.equal(texto(elementos(arbol(),'h1')[0]),nombre)
    if(nombre==='Ventas') {
      const componente=elementos(arbol(),ventas)[0]
      assert.equal(componente.props.tiendaId,'t');assert.equal(componente.props.productos,productos)
      assert.equal(typeof componente.props.actualizarProductos,'function')
    }
  }
  assert.deepEqual(consultas,['tienda','productos'])
  const html=renderToStaticMarkup(arbol())
  for(const valor of ['Taller del Sur','Calbuco','Artesanía','Creaciones hechas a mano.']) assert.ok(html.includes(valor))
  assert.match(html,/href="\/emprendedor\/editar-tienda"/)
  assert.match(html,/href="\/tiendas\/t"/)
  assert.match(html,/href="\/productos\/p"/)
  navegar('Inicio')
  const resumen=elementos(arbol(),'section').find(s=>s.props['aria-label']==='Resumen de productos')
  assert.deepEqual(elementos(resumen,'strong').map(texto),['Activa','1','1'])
})

test('dashboard: menú plegable abre, cierra con Escape y protege los cambios al navegar',async()=>{
  const {arbol,navegar,guardados}=await montarPanelNavegable()
  const toggle=()=>elementos(arbol(),'button').find(b=>b.props['aria-controls']==='panel-menu-contenido')
  assert.equal(toggle().props['aria-expanded'],false)
  toggle().props.onClick();assert.equal(toggle().props['aria-expanded'],true)
  elementos(arbol(),'aside')[0].props.onKeyDown({key:'Escape'})
  assert.equal(toggle().props['aria-expanded'],false)
  toggle().props.onClick();navegar('Mis productos')
  assert.equal(toggle().props['aria-expanded'],false)
  elementos(arbol(),'button').find(b=>texto(b).includes('Agregar producto')).props.onClick()
  const campo=()=>elementos(arbol(),'input').find(i=>i.props.name==='nombre')
  campo().props.onChange({target:{name:'nombre',type:'text',value:'Borrador conservado'}})
  const anterior=globalThis.window
  try {
    globalThis.window={confirm:()=>false}
    navegar('Mi tienda')
    assert.equal(texto(elementos(arbol(),'h1')[0]),'Agregar producto')
    assert.equal(campo().props.value,'Borrador conservado')
    assert.equal(elementos(arbol(),'form').length,1)
    globalThis.window.confirm=()=>true
    navegar('Mi tienda');navegar('Mis productos')
    assert.equal(elementos(arbol(),'form').length,0)
  } finally {
    if(anterior===undefined) delete globalThis.window
    else globalThis.window=anterior
  }
  assert.equal(guardados.length,0)
  const acciones=elementos(arbol(),'button').map(texto)
  assert.ok(acciones.includes('Editar'));assert.ok(acciones.includes('Eliminar'))
})

function completarCampo(arbol,nombre,valor) {
  const campo=elementos(arbol(),'input').find(i=>i.props.name===nombre) || elementos(arbol(),'select').find(i=>i.props.name===nombre)
  campo.props.onChange({target:{name:nombre,type:campo.props.type||'text',value:valor}})
}
const botonPanel=(arbol,nombre)=>elementos(arbol(),'button').find(b=>texto(b)===nombre)
const enviarFormulario=arbol=>elementos(arbol(),'form')[0].props.onSubmit({preventDefault(){}})

test('formulario independiente: crear, resumir opciones, previsualizar imagen y volver al listado actualizado',async()=>{
  const {arbol,navegar,guardados}=await montarPanelNavegable({obtener:(productos,numero)=>numero===1?productos:[...productos,{...productos[0],id:'n',nombre:'Producto nuevo'}]})
  navegar('Mis productos');assert.equal(elementos(arbol(),'form').length,0)
  elementos(arbol(),'button').find(b=>texto(b).includes('Agregar producto')).props.onClick()
  assert.equal(texto(elementos(arbol(),'h1')[0]),'Agregar producto')
  assert.equal(elementos(arbol(),'section').find(s=>s.props.className==='panel-emprendedor__tarjeta').props.hidden,true)
  assert.deepEqual(elementos(elementos(arbol(),'nav')[0],'button').filter(b=>b.props['aria-current']==='page').map(texto),['Mis productos'])
  assert.deepEqual(elementos(arbol(),'legend').map(texto),['Información general','Producto original','Variantes del producto','Resumen de inventario','Disponibilidad'])
  for(const [nombre,valor] of [['nombre','Producto nuevo'],['categoria','Otros'],['precio','4000'],['stockOriginal','8']]) completarCampo(arbol,nombre,valor)
  for(const [i,nombre,precio,stock] of [[0,'Roja','3000','10'],[1,'Azul','5000','5']]) {
    botonPanel(arbol,'+ Agregar variante').props.onClick()
    const variante=()=>elementos(arbol(),'div').filter(d=>d.props.className==='panel-emprendedor__variante')[i]
    for(const [indice,valor] of [[0,nombre],[1,precio],[2,stock]]) elementos(variante(),'input')[indice].props.onChange({target:{value:valor}})
  }
  const resumen=elementos(arbol(),'label').find(l=>texto(l).startsWith('Stock total disponible'))
  assert.equal(elementos(resumen,'input')[0].props.value,23)
  completarCampo(arbol,'imagen','javascript:alert(1)');assert.equal(elementos(arbol(),'figure').length,0)
  completarCampo(arbol,'imagen','https://example.test/original.png')
  assert.match(renderToStaticMarkup(elementos(arbol(),'figure')[0]),/https:\/\/example.test\/original.png/)
  await enviarFormulario(arbol)
  assert.equal(guardados.length,1);assert.equal(guardados[0][1].stockOriginal,'8')
  assert.deepEqual([...guardados[0][1].variantes].map(v=>v.stock),['10','5'])
  assert.equal(texto(elementos(arbol(),'h1')[0]),'Mis productos');assert.equal(elementos(arbol(),'form').length,0)
  assert.match(renderToStaticMarkup(arbol()),/Producto registrado correctamente/)
  assert.ok(elementos(arbol(),'h3').some(h=>texto(h)==='Producto nuevo'))
})

test('cancelar formulario vacío o descartar cambios vuelve al listado sin guardar',async()=>{
  const {arbol,navegar,guardados}=await montarPanelNavegable()
  navegar('Mis productos')
  const abrir=()=>elementos(arbol(),'button').find(b=>texto(b).includes('Agregar producto')).props.onClick()
  abrir();botonPanel(arbol,'Cancelar').props.onClick()
  assert.equal(elementos(arbol(),'form').length,0)
  abrir();completarCampo(arbol,'nombre','Borrador')
  const anterior=globalThis.window
  try {
    globalThis.window={confirm:()=>false}
    botonPanel(arbol,'Cancelar').props.onClick()
    assert.equal(elementos(arbol(),'form').length,1)
    globalThis.window.confirm=()=>true
    botonPanel(arbol,'Cancelar').props.onClick()
    assert.equal(elementos(arbol(),'form').length,0)
    assert.equal(texto(elementos(arbol(),'h1')[0]),'Mis productos')
    abrir();assert.equal(elementos(arbol(),'input').find(i=>i.props.name==='nombre').props.value,'')
  } finally {
    if(anterior===undefined) delete globalThis.window
    else globalThis.window=anterior
  }
  assert.equal(guardados.length,0)
})

test('error de permisos mantiene formulario, datos e identificador para reintentar',async()=>{
  let intentos=0
  const {arbol,navegar,guardados}=await montarPanelNavegable({crear:()=>{if(++intentos===1)throw Object.assign(new Error('denegado'),{code:'permission-denied'})}})
  navegar('Mis productos');elementos(arbol(),'button').find(b=>texto(b).includes('Agregar producto')).props.onClick()
  completarCampo(arbol,'nombre','Sin perder datos');completarCampo(arbol,'stockOriginal','8')
  const original=globalThis.console.error, errores=[]
  try {globalThis.console.error=(...args)=>errores.push(args);await enviarFormulario(arbol)} finally {globalThis.console.error=original}
  assert.equal(errores.length,1)
  assert.equal(texto(elementos(arbol(),'h1')[0]),'Agregar producto')
  assert.equal(elementos(arbol(),'input').find(i=>i.props.name==='nombre').props.value,'Sin perder datos')
  assert.match(renderToStaticMarkup(arbol()),/falta de permisos/)
  await enviarFormulario(arbol)
  assert.equal(guardados.length,2)
  assert.equal(guardados[0][1].idCreacion,guardados[1][1].idCreacion)
  assert.equal(elementos(arbol(),'form').length,0)
})

test('edición independiente conserva original, stocks, IDs y revisión del producto',async()=>{
  const {arbol,navegar,ediciones}=await montarPanelNavegable()
  navegar('Mis productos');botonPanel(arbol,'Editar').props.onClick()
  assert.equal(texto(elementos(arbol(),'h1')[0]),'Editar producto')
  assert.equal(elementos(arbol(),'input').find(i=>i.props.name==='stockOriginal').props.value,'8')
  const resumen=elementos(arbol(),'label').find(l=>texto(l).startsWith('Stock total disponible'))
  assert.equal(elementos(resumen,'input')[0].props.value,23)
  completarCampo(arbol,'nombre','Taza actualizada');await enviarFormulario(arbol)
  assert.equal(ediciones.length,1);assert.equal(ediciones[0][0],'p')
  assert.equal(ediciones[0][2].revision,1);assert.equal(ediciones[0][2].stockOriginal,'8')
  assert.deepEqual([...ediciones[0][2].variantes].map(v=>[v.id,v.stock,v.price]),[['r','10','3000'],['a','5','5000']])
  assert.equal(texto(elementos(arbol(),'h1')[0]),'Mis productos')
})

test('guardado confirmado con falla del listado informa el problema y evita repetir creación',async()=>{
  const {arbol,navegar,guardados}=await montarPanelNavegable({obtener:(productos,numero)=>{if(numero>1)throw Error('sin conexión');return productos}})
  navegar('Mis productos');elementos(arbol(),'button').find(b=>texto(b).includes('Agregar producto')).props.onClick()
  await enviarFormulario(arbol)
  assert.equal(guardados.length,1);assert.equal(elementos(arbol(),'form').length,0)
  assert.match(renderToStaticMarkup(arbol()),/se guardó, pero no pudimos actualizar el listado/)
})

test('mientras se guarda, no permite descartar ni cambiar de sección',async()=>{
  let finalizar
  const {arbol,navegar}=await montarPanelNavegable({crear:()=>new Promise(resolve=>{finalizar=resolve})})
  navegar('Mis productos');elementos(arbol(),'button').find(b=>texto(b).includes('Agregar producto')).props.onClick()
  completarCampo(arbol,'nombre','En proceso')
  const guardado=enviarFormulario(arbol)
  assert.equal(botonPanel(arbol,'Cancelar').props.disabled,true)
  navegar('Ventas');assert.equal(texto(elementos(arbol(),'h1')[0]),'Agregar producto')
  finalizar();await guardado
  assert.equal(texto(elementos(arbol(),'h1')[0]),'Mis productos')
})
