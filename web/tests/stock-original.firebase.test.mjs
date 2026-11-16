import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, setDoc, getDoc, getDocs, query, where, collection, writeBatch, serverTimestamp, deleteField } from 'firebase/firestore'
import { guardarProductoTransaccion, registrarVentaTransaccion } from '../src/services/productos/inventarioTransacciones.js'
import { prepararProducto, prepararVenta } from '../src/services/productos/inventarioModelo.js'
import { normalizarProducto } from '../src/services/productos/productoModelo.js'

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Usa exclusivamente Firestore Emulator.')
let env
const base = () => ({Nombre:'Taza',Categoria:'Cerámica',Precio:4000,StockOriginal:8,imagen:'https://example.test/blanca.png',Variantes:[
  {id:'roja',name:'Roja',price:3000,stock:10,imageUrl:'https://example.test/roja.png'},
  {id:'azul',name:'Azul',price:5000,stock:5,imageUrl:'https://example.test/azul.png'},
]})
const clientes = new Map()
const db = (uid='duena') => {
  if (!clientes.has(uid)) clientes.set(uid,env.authenticatedContext(uid).firestore())
  return clientes.get(uid)
}
const ref = () => doc(db(),'productos/p')
const leer = async () => (await getDoc(ref())).data()
const crear = (datos=base(), revision=null) => guardarProductoTransaccion(db(),'duena',{tiendaId:'t',productoId:'p',datos,revision})
const vender = (varianteId='', extra={}) => registrarVentaTransaccion(db(),'duena',{tiendaId:'t',productoId:'p',varianteId,cantidad:1,operacionId:'op',...extra})
const directo = datos => setDoc(ref(),{...datos,ActualizadoEn:serverTimestamp()})
const crudo = datos => ({...prepararProducto(datos),ID_Tienda:'t',ID_Producto:'p'})
const sembrar = datos => env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),'productos/p'),datos))
const ventas = () => getDocs(query(collection(db(),'ventas'),where('usuarioId','==','duena'),where('tiendaId','==','t')))

before(async()=>{ env=await initializeTestEnvironment({projectId:'demo-bora-stock-original',firestore:{rules:readFileSync(new URL('../../firestore.rules',import.meta.url),'utf8')}}) })
after(async()=>{ await env?.cleanup() })
beforeEach(async()=>{
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async ctx=>{
    const batch=writeBatch(ctx.firestore())
    for(const [path,data] of Object.entries({
      'usuarios/duena':{rol:'emprendedor',activo:true},'emprendedores/duena':{ID_Tienda:'t',activo:true},'tiendas/t':{ID_Dueno:'duena',activo:true},
    })) batch.set(doc(ctx.firestore(),path),data)
    await batch.commit()
  })
})

// Omite el modelo JS al escribir: comprueba la autoridad de las reglas.
async function ataque({varianteId='',producto={},venta={},cantidad=1,sinVenta=false,sinRecibo=false}={}) {
  const antes=await leer(), {cambios,venta:linea}=prepararVenta(antes,{varianteId,cantidad:1})
  const batch=writeBatch(db()), ventaId='duena_ataque'
  const v={...linea,productoId:'p',tiendaId:'t',usuarioId:'duena',operacionId:'ataque',indiceVariante:antes.Variantes.findIndex(v=>v.id===varianteId),cantidad,total:linea.precioUnitario*cantidad,fecha:serverTimestamp(),...venta}
  batch.update(ref(),{...cambios,UltimaVenta:ventaId,ActualizadoEn:serverTimestamp(),...producto})
  if(!sinVenta) batch.set(doc(db(),'ventas',ventaId),v)
  if(!sinRecibo) batch.set(doc(db(),'movimientosInventario/duena/operaciones/ataque'),{productoId:'p',tiendaId:'t',varianteId:v.varianteId,cantidad:v.cantidad,ventaId,fecha:serverTimestamp()})
  return batch.commit()
}

for(const [id,original,stocks,precio] of [['',7,[10,5],4000],['roja',8,[9,5],3000],['azul',8,[10,4],5000]]) {
  test(`venta independiente de ${id||'original'} persiste 22 unidades y precio histórico`,async()=>{
    await crear(); assert.equal((await leer()).Stock,23)
    await vender(id)
    const p=await leer(), v=(await getDoc(doc(db(),'ventas/duena_op'))).data()
    assert.equal(p.StockOriginal,original); assert.deepEqual(p.Variantes.map(v=>v.stock),stocks); assert.equal(p.Stock,22)
    assert.equal(v.precioUnitario,precio); assert.equal(v.varianteId,id); assert.equal(v.indiceVariante,id===''?-1:id==='roja'?0:1)
    assert.equal((await getDoc(doc(env.unauthenticatedContext().firestore(),'productos/p'))).data().Stock,22)
    assert.equal((await vender(id)).repetida,true); assert.equal((await leer()).Stock,22)
    await assert.rejects(vender(id,{cantidad:2}),/otra operación/)
    await assert.rejects(vender(id,{cantidad:100,operacionId:'exceso'}),/stock suficiente/)
  })
}

test('original no altera variantes y variante no altera original ni otra variante',async()=>{
  await crear(); const p=await leer()
  await assertFails(ataque({producto:{Variantes:p.Variantes.map(v=>({...v,stock:v.stock-1}))}}))
  await assertFails(ataque({varianteId:'roja',producto:{StockOriginal:7}}))
  await assertFails(ataque({varianteId:'roja',producto:{Variantes:p.Variantes.map(v=>({...v,stock:v.stock-1}))}}))
  await assertFails(ataque({producto:{StockOriginal:8}}))
  await assertFails(ataque({producto:{Stock:23}}))
  assert.equal((await leer()).Stock,23)
})

test('reglas rechazan precio de otra opción, cantidades falsas y ventas sin atomicidad',async()=>{
  await crear()
  await assertFails(ataque({venta:{precioUnitario:3000,total:3000}}))
  await assertFails(ataque({varianteId:'roja',venta:{precioUnitario:4000,total:4000}}))
  await assertFails(ataque({venta:{varianteNombre:'Otra opción'}}))
  for(const cantidad of [0,-1,0.5,'1',9]) await assertFails(ataque({cantidad,producto:{StockOriginal:8-Number(cantidad),Stock:23-Number(cantidad)}}))
  await assertFails(ataque({sinVenta:true})); await assertFails(ataque({sinRecibo:true}))
  assert.equal((await ventas()).size,0)
})

test('StockOriginal exige entero no negativo y total coherente dentro del máximo',async()=>{
  for(const StockOriginal of [-1,0.5,'8',null,1000001]) {
    const p=crudo(base());p.StockOriginal=StockOriginal;await assertFails(directo(p))
  }
  const p=crudo(base());await assertFails(directo({...p,Stock:24}))
  await assertFails(directo({...p,StockOriginal:1000000,Stock:1000015}))
  await assertSucceeds(directo({...p,StockOriginal:999985,Stock:1000000}))
})

test('stock original alto nunca compensa una variante inválida, activa o inactiva',async()=>{
  for(let indice=0;indice<5;indice++) {
    for(const active of [true,false]) {
      const p=crudo({...base(),StockOriginal:500000,Variantes:Array.from({length:5},(_,i)=>({id:'v'+i,name:'V'+i,price:1000,stock:100000}))})
      p.StockOriginal=600000
      p.Variantes[indice].price=0;p.Variantes[indice].active=active
      // Cuatro válidas (400000) más el centinela (-500001), más original.
      p.Stock=499999
      await assertFails(directo(p))
    }
  }
})

for(const conVariantes of [false,true]) {
  test(`documento antiguo ${conVariantes?'con':'sin'} variantes: conversión y recibo histórico seguros`,async()=>{
    const antiguo=crudo({...base(),StockOriginal:conVariantes?0:8,Variantes:conVariantes?base().Variantes:[]})
    delete antiguo.StockOriginal; await sembrar(antiguo)
    const original=normalizarProducto(await leer(),'p').stockOriginal
    assert.equal(original,conVariantes?0:8)
    if(conVariantes) await assert.rejects(vender(),/stock suficiente/)
    await vender(conVariantes?'roja':'')
    assert.equal((await leer()).StockOriginal,conVariantes?0:7)
    await crear({StockOriginal:8},2)
    assert.equal((await leer()).Stock,conVariantes?22:8)
    // El recibo sigue identificando la operación previa a la edición.
    assert.equal((await vender(conVariantes?'roja':'')).repetida,true)
    await assert.rejects(crear({StockOriginal:999},1),/inventario cambió/)
    const p=await leer();delete p.StockOriginal
    await assertFails(directo({...p,Revision:p.Revision+1}))
    await assertFails(ataque({varianteId:conVariantes?'azul':'',producto:{StockOriginal:deleteField()}}))
  })
}

test('edición convierte stock antiguo sin duplicarlo; revisiones protegen ventas simultáneas',async()=>{
  const p=crudo({...base(),StockOriginal:0});delete p.StockOriginal;await sembrar(p)
  await crear({},1)
  assert.equal((await leer()).StockOriginal,0);assert.equal((await leer()).Stock,15)
  await crear({StockOriginal:8},2);assert.equal((await leer()).Stock,23)
  await vender();await assert.rejects(crear({StockOriginal:8},3),/inventario cambió/)
})

test('compatibilidad de clientes antiguos sin StockOriginal mientras el documento no esté convertido',async()=>{
  const p=crudo({...base(),StockOriginal:0});delete p.StockOriginal
  await assertSucceeds(directo(p));await assertSucceeds(directo({...p,Revision:2}))
  const antes=await leer(), {cambios,venta}=prepararVenta(antes,{cantidad:1,varianteId:'roja'})
  delete cambios.StockOriginal
  const b=writeBatch(db()),fecha=serverTimestamp()
  b.update(ref(),{...cambios,UltimaVenta:'duena_antigua',ActualizadoEn:fecha})
  b.set(doc(db(),'ventas/duena_antigua'),{...venta,productoId:'p',tiendaId:'t',usuarioId:'duena',operacionId:'antigua',indiceVariante:0,fecha})
  b.set(doc(db(),'movimientosInventario/duena/operaciones/antigua'),{productoId:'p',tiendaId:'t',varianteId:'roja',cantidad:1,ventaId:'duena_antigua',fecha})
  await assertSucceeds(b.commit());assert.equal((await leer()).Stock,14)
  assert.equal((await vender('roja',{operacionId:'antigua'})).repetida,true)
})

for(const id of ['', 'roja','azul']) {
  test(`pieza única vendida como ${id||'original'} oculta todo permanentemente`,async()=>{
    await crear({...base(),PiezaUnica:true});await vender(id)
    assert.equal(normalizarProducto(await leer(),'p').visible,false)
    for(const otra of ['', 'roja','azul']) await assert.rejects(vender(otra,{operacionId:'otra'}),/no está disponible/)
    await crear({Disponible:true,PiezaUnica:false},2)
    assert.equal(normalizarProducto(await leer(),'p').visible,false)
  })
}

test('concurrencia de última unidad original y variantes conserva total e idempotencia',async()=>{
  await crear({...base(),StockOriginal:1,Variantes:base().Variantes.map(v=>({...v,stock:1}))})
  const inicial=await leer(), confirmadas=new Map()
  const operaciones=[
    {operacionId:'a',varianteId:''},{operacionId:'b',varianteId:''},
    {operacionId:'c',varianteId:'roja'},{operacionId:'d',varianteId:'azul'},
  ]
  function confirmar(operacion,resultado) {
    assert.equal(resultado.ventaId,'duena_'+operacion.operacionId)
    if(confirmadas.has(operacion.operacionId)) assert.equal(resultado.repetida,true)
    confirmadas.set(operacion.operacionId,operacion)
  }
  async function comprobarInventario() {
    const p=await leer(), historial=(await ventas()).docs.map(d=>({id:d.id,...d.data()}))
    let recibos
    await env.withSecurityRulesDisabled(async ctx=>{
      recibos=(await getDocs(collection(ctx.firestore(),'movimientosInventario/duena/operaciones'))).docs.map(d=>({id:d.id,...d.data()}))
    })
    const ids=[...confirmadas.keys()].sort()
    assert.deepEqual(historial.map(v=>v.id).sort(),ids.map(id=>'duena_'+id))
    assert.deepEqual(recibos.map(r=>r.id).sort(),ids)
    assert.equal(new Set(historial.map(v=>v.operacionId)).size,historial.length)
    for(const v of historial) {
      const operacion=confirmadas.get(v.operacionId), r=recibos.find(r=>r.id===v.operacionId)
      const variante=inicial.Variantes.find(x=>x.id===operacion.varianteId)
      assert.equal(v.productoId,'p');assert.equal(v.tiendaId,'t');assert.equal(v.usuarioId,'duena')
      assert.equal(v.varianteId,operacion.varianteId);assert.equal(v.cantidad,1)
      assert.equal(v.precioUnitario,variante?.price??inicial.Precio);assert.equal(v.total,v.precioUnitario)
      assert.equal(r.ventaId,v.id);assert.equal(r.productoId,'p');assert.equal(r.tiendaId,'t')
      assert.equal(r.varianteId,v.varianteId);assert.equal(r.cantidad,v.cantidad)
    }
    const vendidas=id=>historial.filter(v=>v.varianteId===id).reduce((n,v)=>n+v.cantidad,0)
    assert.equal(p.StockOriginal,1-vendidas(''))
    assert.ok(p.StockOriginal>=0)
    assert.deepEqual(p.Variantes,inicial.Variantes.map(v=>({...v,stock:1-vendidas(v.id)})))
    assert.ok(p.Variantes.every(v=>v.stock>=0))
    assert.equal(p.Stock,p.StockOriginal+p.Variantes.filter(v=>v.active).reduce((n,v)=>n+v.stock,0))
    assert.equal(p.Stock,3-historial.reduce((n,v)=>n+v.cantidad,0))
    assert.ok(p.Stock>=0)
    assert.equal(p.Revision,inicial.Revision+historial.length)
    return p
  }
  await comprobarInventario()
  for(let tanda=0;tanda<2;tanda++) {
    const resultados=await Promise.allSettled(operaciones.map(op=>vender(op.varianteId,{operacionId:op.operacionId})))
    for(const [i,resultado] of resultados.entries()) {
      if(resultado.status==='fulfilled') confirmar(operaciones[i],resultado.value)
      else {
        // Cada rechazo se inspecciona; no equivale a una venta confirmada.
        assert.ok(['permission-denied','inventario/validacion'].includes(resultado.reason.code),String(resultado.reason))
        if(resultado.reason.code==='inventario/validacion') assert.match(resultado.reason.message,/stock suficiente/)
        assert.equal(confirmadas.has(operaciones[i].operacionId),false)
      }
    }
    if(tanda===0) assert.ok(resultados.some(r=>r.status==='fulfilled'))
    await comprobarInventario()
  }
  // Solo exigimos agotamiento después de confirmar la venta de cada saldo restante.
  for(const varianteId of ['', 'roja','azul']) {
    const p=await comprobarInventario(), stock=varianteId?p.Variantes.find(v=>v.id===varianteId).stock:p.StockOriginal
    if(stock>0) {
      const operacion={operacionId:'completar_'+(varianteId||'original'),varianteId}
      const resultado=await vender(varianteId,{operacionId:operacion.operacionId})
      assert.notEqual(resultado.repetida,true)
      confirmar(operacion,resultado)
    }
    await comprobarInventario()
  }
  const agotado=await comprobarInventario()
  assert.equal(agotado.Stock,0);assert.equal(agotado.StockOriginal,0)
  assert.deepEqual(agotado.Variantes.map(v=>v.stock),[0,0])
  assert.equal(confirmadas.size,3)
  for(const operacion of confirmadas.values()) {
    const repetida=await vender(operacion.varianteId,{operacionId:operacion.operacionId})
    assert.equal(repetida.repetida,true);assert.equal(repetida.ventaId,'duena_'+operacion.operacionId)
    await comprobarInventario()
  }
  for(const varianteId of ['', 'roja','azul']) {
    await assert.rejects(vender(varianteId,{operacionId:'sin_stock_'+(varianteId||'original')}),e=>e.code==='inventario/validacion'&&/stock suficiente/.test(e.message))
    await comprobarInventario()
  }
})

test('cinco variantes adicionales e inactivas: original no ocupa un cupo',async()=>{
  const datos={...base(),Variantes:Array.from({length:5},(_,i)=>({id:'v'+i,name:'V'+i,price:1000+i,stock:2,active:i!==4}))}
  await crear(datos);assert.equal((await leer()).Stock,16)
  await vender();assert.equal((await leer()).Stock,15)
  await assert.rejects(vender('v4',{operacionId:'inactiva'}))
  const p=await leer();p.Variantes.push({...p.Variantes[0],id:'v5'});p.Revision++
  await assertFails(directo(p))
  await vender('v3',{operacionId:'activa'});assert.equal((await leer()).StockOriginal,7)
})

test('original con cinco variantes válidas en los límites conserva evaluación y restricciones',async()=>{
  await crear({...base(),StockOriginal:500000,Variantes:Array.from({length:5},(_,i)=>({id:String(i)+'i'.repeat(63),name:'n'.repeat(150),price:999999999,stock:100000,imageUrl:'https://'+'a'.repeat(1992),imagePath:'r'.repeat(512)}))})
  assert.equal((await leer()).Stock,1000000)
  await vender();await vender('4'+'i'.repeat(63),{operacionId:'ultima'})
  assert.equal((await leer()).Stock,999998)
})

test('sin control sin variantes conserva stock, mientras a pedido con control rechaza sobregiro',async()=>{
  await crear({...base(),Variantes:[],StockOriginal:0,ManejaStock:false,OfrecerPedido:true})
  await vender('',{cantidad:10});assert.equal((await leer()).Stock,0)
  await crear({ManejaStock:true},2)
  await assert.rejects(vender('',{operacionId:'sin-stock'}),/stock suficiente/)
})
