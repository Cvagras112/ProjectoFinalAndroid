import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, query, collection, where, writeBatch, runTransaction, serverTimestamp } from 'firebase/firestore'
import { guardarProductoTransaccion, registrarVentaTransaccion } from '../src/services/productos/inventarioTransacciones.js'
import { prepararProducto, prepararVenta } from '../src/services/productos/inventarioModelo.js'

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Ejecuta esta suite exclusivamente con Firestore Emulator.')
let env
const base = {Nombre:'Polera',Categoria:'Textil',Descripcion:'Algodón',Precio:12000,Stock:3,imagen:'',Disponible:true}
const variantes = () => [{id:'s',name:'S',price:10000,stock:2},{id:'l',name:'L',price:14000,stock:1}]
const cliente = (uid = 'duena') => env.authenticatedContext(uid).firestore()
const crear = (datos = base, revision = null, productoId = 'p', uid = 'duena') => guardarProductoTransaccion(cliente(uid),uid,{tiendaId:'t',productoId,revision,datos})
const vender = (extra = {}, uid = 'duena') => registrarVentaTransaccion(cliente(uid),uid,{tiendaId:'t',productoId:'p',cantidad:1,operacionId:'op1',...extra})
const leer = async path => { let dato; await env.withSecurityRulesDisabled(async ctx => { dato = (await getDoc(doc(ctx.firestore(),path))).data() }); return dato }
const listar = async path => { let datos; await env.withSecurityRulesDisabled(async ctx => { datos = (await getDocs(collection(ctx.firestore(),path))).docs.map(d=>d.data()) }); return datos }

before(async () => { env = await initializeTestEnvironment({projectId:'demo-bora-inventario',firestore:{rules:readFileSync(new URL('../../firestore.rules',import.meta.url),'utf8')}}) })
after(async () => {
  if (process.env.BORA_RULE_COVERAGE) {
    const respuesta = await fetch('http://' + process.env.FIRESTORE_EMULATOR_HOST + '/emulator/v1/projects/demo-bora-inventario:ruleCoverage')
    const { writeFileSync } = await import('node:fs')
    writeFileSync(process.env.BORA_RULE_COVERAGE, await respuesta.text())
  }
  await env?.cleanup()
})
beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async ctx => {
    const db=ctx.firestore(), batch=writeBatch(db)
    batch.set(doc(db,'usuarios/duena'),{rol:'emprendedor',activo:true})
    batch.set(doc(db,'emprendedores/duena'),{ID_Tienda:'t',activo:true})
    batch.set(doc(db,'tiendas/t'),{ID_Dueno:'duena',activo:true})
    await batch.commit()
  })
})
// Un cliente manipulado escribe con el mismo SDK; las reglas deben rechazarlo.
async function manipulada({venta = {}, producto = {}, varianteId = '', sinRecibo = false, sinVenta = false} = {}) {
  const db = cliente()
  return runTransaction(db,async tx => {
    const ref=doc(db,'productos/p'), antes=(await tx.get(ref)).data()
    const {cambios,venta:linea}=prepararVenta(antes,{cantidad:1,varianteId})
    const datos={...linea,productoId:'p',tiendaId:'t',usuarioId:'duena',operacionId:'ataque',indiceVariante:(antes.Variantes||[]).findIndex(v=>v.id===varianteId),fecha:serverTimestamp(),...venta}
    tx.update(ref,{...cambios,UltimaVenta:'duena_ataque',ActualizadoEn:serverTimestamp(),...producto})
    if(!sinVenta)tx.set(doc(db,'ventas/duena_ataque'),datos)
    if(!sinRecibo)tx.set(doc(db,'movimientosInventario/duena/operaciones/ataque'),{productoId:'p',tiendaId:'t',varianteId:datos.varianteId,cantidad:datos.cantidad,ventaId:'duena_ataque',fecha:serverTimestamp()})
  })
}
test('producto y venta persisten; precio enviado por cliente se ignora', async () => {
  await crear(); await vender({precioUnitario:1,stock:999})
  const p=await leer('productos/p'),v=await leer('ventas/duena_op1')
  assert.equal(p.Stock,2); assert.equal(v.precioUnitario,12000); assert.equal(v.total,12000)
  assert.equal(v.productoNombre,'Polera'); assert.equal(v.tiendaId,'t'); assert.equal(v.usuarioId,'duena'); assert.ok(v.fecha)
})
test('variante vendida descuenta solo su stock', async () => {
  await crear({...base,Variantes:variantes()}); await vender({varianteId:'l'})
  const p=await leer('productos/p')
  assert.equal(p.Variantes[0].stock,2); assert.equal(p.Variantes[1].stock,0); assert.equal(p.Stock,2)
  assert.equal((await leer('ventas/duena_op1')).precioUnitario,14000)
})
test('dos ventas simultáneas por el último stock: solo una confirma', async () => {
  await crear({...base,Stock:1})
  const resultados=await Promise.allSettled([vender({operacionId:'opA'}),vender({operacionId:'opB'})])
  assert.equal(resultados.filter(r=>r.status==='fulfilled').length,1)
  assert.equal((await leer('productos/p')).Stock,0); assert.equal((await listar('ventas')).length,1)
})
test('reintentar la misma operación no duplica venta ni descuento', async () => {
  await crear()
  const intentos = await Promise.allSettled([vender(),vender(),vender()])
  assert.ok(intentos.some(r => r.status === 'fulfilled'))
  assert.equal((await vender()).repetida, true)
  assert.equal((await leer('productos/p')).Stock,2); assert.equal((await listar('ventas')).length,1)
  await assert.rejects(vender({cantidad:2}),/otra operación/)
})
test('stock insuficiente no deja ventas ni descuentos parciales', async () => {
  await crear({...base,Stock:1}); await assert.rejects(vender({cantidad:2}),/stock suficiente/)
  assert.equal((await leer('productos/p')).Stock,1); assert.equal((await listar('ventas')).length,0)
  assert.equal((await listar('movimientosInventario/duena/operaciones')).length,0)
})
test('edición desactualizada no repone stock vendido', async () => {
  await crear(); await vender(); await assert.rejects(crear({...base,Nombre:'Nuevo'},1),/inventario cambió/)
  assert.equal((await leer('productos/p')).Stock,2)
})
test('una venta conserva precio y nombre tras editar o eliminar el producto', async () => {
  await crear(); await vender(); await crear({...base,Nombre:'Otra polera',Precio:15000,Stock:2},2)
  await assertSucceeds(deleteDoc(doc(cliente(),'productos/p')))
  assert.equal((await leer('ventas/duena_op1')).precioUnitario,12000); assert.equal((await leer('ventas/duena_op1')).productoNombre,'Polera')
})
test('cuenta ajena o desactivada no registra ventas ni modifica productos', async () => {
  await crear(); await assert.rejects(vender({},'otra'))
  await assertFails(updateDoc(doc(cliente('otra'),'productos/p'),{Stock:999,Revision:2,ActualizadoEn:serverTimestamp()}))
  await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'emprendedores/duena'),{activo:false}))
  await assert.rejects(vender(),/administrar esta tienda/)
  await assertFails(updateDoc(doc(cliente(),'productos/p'),{Stock:999,Revision:2,ActualizadoEn:serverTimestamp()}))
  assert.equal((await leer('productos/p')).Stock,3)
})
test('sin sesión no se escribe inventario ni ventas', async () => {
  const db=env.unauthenticatedContext().firestore()
  await assert.rejects(registrarVentaTransaccion(db,null,{}),/Inicia sesión/)
  await assert.rejects(guardarProductoTransaccion(db,null,{}),/Inicia sesión/)
  await assertFails(setDoc(doc(db,'ventas/falsa'),{cantidad:1,total:1}))
})
test('historial y recibos son inmutables; no se crea una venta aislada', async () => {
  await crear(); await vender(); const db=cliente()
  await assertFails(setDoc(doc(db,'ventas/falsa'),{usuarioId:'duena',tiendaId:'t',cantidad:1,total:1}))
  await assertFails(updateDoc(doc(db,'ventas/duena_op1'),{total:1}))
  await assertFails(deleteDoc(doc(db,'ventas/duena_op1')))
  await assertFails(deleteDoc(doc(db,'movimientosInventario/duena/operaciones/op1')))
})
test('historial privado: dueña consulta; otra cuenta y visitante no leen', async () => {
  await crear(); await vender(); const owner=cliente()
  await assertSucceeds(getDocs(query(collection(owner,'ventas'),where('usuarioId','==','duena'),where('tiendaId','==','t'))))
  await assertFails(getDoc(doc(cliente('otra'),'ventas/duena_op1')))
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'ventas/duena_op1')))
  await assertFails(getDoc(doc(cliente('otra'),'movimientosInventario/duena/operaciones/op1')))
  await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(),'productos/p')))
})
test('reglas rechazan precio, total y nombre falsificados aunque el cliente omita validaciones', async () => {
  await crear()
  await assertFails(manipulada({venta:{precioUnitario:1,total:1}}))
  await assertFails(manipulada({venta:{total:1}}))
  await assertFails(manipulada({venta:{productoNombre:'Inventado'}}))
  assert.equal((await leer('productos/p')).Stock,3)
})
test('reglas rechazan venta sin descuento o con cambio de precio simultáneo', async () => {
  await crear()
  await assertFails(manipulada({producto:{Stock:3}}))
  await assertFails(manipulada({producto:{Precio:1},venta:{precioUnitario:1,total:1}}))
})
test('reglas exigen venta, descuento y recibo juntos', async () => {
  await crear()
  await assertFails(manipulada({sinRecibo:true}))
  await assertFails(manipulada({sinVenta:true}))
  assert.equal((await listar('ventas')).length,0)
  assert.equal((await leer('productos/p')).Stock,3)
})
test('reglas rechazan modificar otra variante y vender una variante inactiva', async () => {
  await crear({...base,Variantes:variantes()})
  const p=await leer('productos/p')
  await assertFails(manipulada({varianteId:'l',producto:{Variantes:p.Variantes.map(v=>({...v,stock:0})),Stock:0}}))
  await crear({...base,Variantes:p.Variantes.map(v=>({...v,active:v.id!=='l'}))},1)
  await assertFails(manipulada({varianteId:'s',venta:{varianteId:'l',varianteNombre:'L',indiceVariante:1,precioUnitario:14000,total:14000}}))
})
test('reglas impiden stock negativo y reutilizar o borrar identidades de variantes', async () => {
  await crear({...base,Variantes:variantes()}); const p=await leer('productos/p'),db=cliente()
  await assertFails(updateDoc(doc(db,'productos/p'),{Stock:-1,Revision:2,ActualizadoEn:serverTimestamp()}))
  await assertFails(updateDoc(doc(db,'productos/p'),{Variantes:[p.Variantes[1]],Stock:1,Revision:2,ActualizadoEn:serverTimestamp()}))
})
test('diez variantes cumplen límites de reglas y se vende la última correctamente', async () => {
  const diez=Array.from({length:10},(_,i)=>({id:'v'+i,name:'Variante '+i,price:1000+i,stock:2}))
  await crear({...base,Variantes:diez}); await vender({varianteId:'v9'})
  assert.equal((await leer('productos/p')).Stock,19)
})
test('pieza única vendida no vuelve a publicarse por edición', async () => {
  await crear({...base,PiezaUnica:true}); await vender()
  await crear({...base,PiezaUnica:false,Disponible:true},2)
  assert.equal((await leer('productos/p')).Disponible,false)
  await assertFails(updateDoc(doc(cliente(),'productos/p'),{Vendido:false,Disponible:true,Revision:4,ActualizadoEn:serverTimestamp()}))
})

test('diez variantes por escritura directa también deben validar el esquema completo', async () => {
  const diez=Array.from({length:10},(_,i)=>({id:'v'+i,name:'Variante '+i,price:1000+i,stock:2}))
  const p=prepararProducto({...base,Variantes:diez})
  await assertSucceeds(setDoc(doc(cliente(),'productos/p'),{...p,ID_Producto:'p',ID_Tienda:'t',ActualizadoEn:serverTimestamp()}))
  await vender({varianteId:'v9'})
  assert.equal((await leer('productos/p')).Stock,19)
})

// Intentos que no utilizan las validaciones del formulario ni del modelo JS.
test('reglas rechazan cantidades cero, negativas, fraccionarias y de tipo incorrecto', async () => {
  await crear()
  for (const cantidad of [0,-1,0.5,'1',null]) {
    const numero=Number(cantidad)
    await assertFails(manipulada({venta:{cantidad,total:numero*12000},producto:{Stock:3-numero}}))
  }
  assert.equal((await leer('productos/p')).Stock,3)
  assert.equal((await listar('ventas')).length,0)
})
test('reglas rechazan propietario y tienda falsificados en una venta completa', async () => {
  await crear()
  await assertFails(manipulada({venta:{usuarioId:'otra'}}))
  await assertFails(manipulada({venta:{tiendaId:'otra'}}))
  await assertFails(manipulada({producto:{ID_Tienda:'otra'}}))
  await assertFails(manipulada({producto:{ID_Producto:'otro'}}))
})
test('estado y rol de usuario, perfil y tienda se exigen también contra cliente manipulado', async () => {
  await crear()
  const cambios=[['usuarios/duena',{activo:false}],['usuarios/duena',{rol:'comprador'}],['emprendedores/duena',{activo:false}],['emprendedores/duena',{ID_Tienda:'otra'}],['tiendas/t',{activo:false}],['tiendas/t',{ID_Dueno:'otra'}]]
  for(const [path,campos] of cambios) {
    const anterior=await leer(path)
    await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),path),campos))
    await assertFails(manipulada())
    await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),path),anterior))
  }
})
const documentoCrudo = () => ({...prepararProducto({...base,Variantes:[{id:'s',name:'S',price:12000,stock:3}]}),ID_Producto:'crudo',ID_Tienda:'t'})
const escribirCrudo = p => setDoc(doc(cliente(),'productos/crudo'),{...p,ActualizadoEn:serverTimestamp()})
test('cada campo de variante es obligatorio aun si una clave extra mantiene el tamaño del mapa', async () => {
  for(const campo of ['id','name','price','stock','imageUrl','imagePath','active']) {
    const p=documentoCrudo(); delete p.Variantes[0][campo]; p.Variantes[0].intruso='x'
    await assertFails(escribirCrudo(p))
  }
  const p=documentoCrudo();p.Variantes[0].intruso='x';await assertFails(escribirCrudo(p))
})
test('tipos y rangos de variantes se validan sin confiar en el modelo JS', async () => {
  const intentos=[['id',7],['id',''],['id','a/b'],['id','a'.repeat(65)],['name',false],['name',''],['name','n'.repeat(151)],['price','12000'],['price',0],['price',1.5],['price',1000000000],['stock',-1],['stock',0.5],['stock',100001],['stock','3'],['imageUrl',17],['imageUrl','javascript:alert(1)'],['imageUrl','https://'+'a'.repeat(1993)],['imagePath',false],['imagePath','a'.repeat(513)],['active',1]]
  for(const [campo,valor] of intentos) {
    const p=documentoCrudo();p.Variantes[0][campo]=valor
    await assertFails(escribirCrudo(p))
  }
  for(const valor of [null,7,'texto']) {
    const p=documentoCrudo();p.Variantes[0]=valor;await assertFails(escribirCrudo(p))
  }
})
test('campos obligatorios de producto no se pueden omitir ni sustituir por tipos distintos', async () => {
  for(const campo of ['ID_Producto','ID_Tienda','Nombre','Categoria','Precio','Stock','Disponible','imagen']) {
    const p=documentoCrudo();delete p[campo];await assertFails(escribirCrudo(p))
  }
  for(const [campo,valor] of [['Nombre',1],['Categoria',[]],['Precio',0.5],['Stock','3'],['Disponible',1],['imagen',17]]) {
    const p=documentoCrudo();p[campo]=valor;await assertFails(escribirCrudo(p))
  }
})
test('variantes válidas admiten los límites exactos de texto y valores numéricos', async () => {
  const p=documentoCrudo()
  Object.assign(p.Variantes[0],{id:'i'.repeat(64),name:'n'.repeat(150),price:999999999,stock:100000,imageUrl:'https://'+'a'.repeat(1992),imagePath:'r'.repeat(512)})
  p.Stock=100000
  await assertSucceeds(escribirCrudo(p))
  await assertSucceeds(deleteDoc(doc(cliente(),'productos/crudo')))
  p.Variantes[0].imageUrl='http://'+'a'.repeat(1993)
  await assertSucceeds(escribirCrudo(p))
})
test('el total de stock, IDs únicos y límite de diez variantes se verifican en reglas', async () => {
  let p=documentoCrudo();p.Stock=99;await assertFails(escribirCrudo(p))
  p=documentoCrudo();p.Variantes.push({...p.Variantes[0],name:'Duplicada'});p.Stock=6;await assertFails(escribirCrudo(p))
  p=documentoCrudo();p.ManejaStock=false;await assertFails(escribirCrudo(p))
  p=documentoCrudo();p.Variantes=Array.from({length:11},(_,i)=>({...p.Variantes[0],id:'v'+i}));p.Stock=33;await assertFails(escribirCrudo(p))
})

test('el SDK rechaza arrays anidados antes de enviar datos a Firestore', async () => {
  const p=documentoCrudo();p.Variantes[0]=['a','b','c','d','e','f','g']
  await assert.rejects(async () => escribirCrudo(p), /Nested arrays are not supported/)
})
