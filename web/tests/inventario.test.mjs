import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizarProducto, disponibilidadProducto } from '../src/services/productos/productoModelo.js'
import { prepararProducto, prepararVenta } from '../src/services/productos/inventarioModelo.js'
const datos = () => ({Nombre:'Polera',Categoria:'Textil',Descripcion:'Algodón',Precio:12000,Stock:5,imagen:'',Disponible:true})
const opciones = () => [{id:'s',name:'S roja',price:12000,stock:3,imageUrl:'',active:true},{id:'l',name:'L azul',price:14000,stock:2,imageUrl:'',active:true}]
test('conserva producto anterior sin variantes', () => {
  const p = prepararProducto(datos()); assert.equal(p.Stock,5); assert.deepEqual(p.Variantes,[])
  assert.equal(normalizarProducto(p,'p').visible,true)
})
test('cada variante conserva precio e inventario independientes', () => {
  const p = prepararProducto({...datos(),Variantes:opciones()})
  const {cambios,venta} = prepararVenta(p,{cantidad:2,varianteId:'l'})
  assert.equal(cambios.Variantes[0].stock,3); assert.equal(cambios.Variantes[1].stock,0)
  assert.equal(cambios.Stock,3); assert.equal(venta.total,28000); assert.equal(venta.precioUnitario,14000)
  assert.equal(p.Variantes[1].stock,2)
})
test('rechaza stock insuficiente y cantidades negativas, cero o fraccionarias', () => {
  const p = prepararProducto({...datos(),Variantes:opciones()})
  for(const cantidad of [-1,0,1.5,4]) assert.throws(() => prepararVenta(p,{cantidad,varianteId:'s'}))
})
test('variantes conservan control de stock aunque el documento diga que no', () => {
  const p = {...prepararProducto({...datos(),Variantes:opciones()}),ManejaStock:false}
  assert.throws(() => prepararVenta(p,{cantidad:5,varianteId:'s'}))
})
test('rechaza variantes inexistentes, inactivas e identidades duplicadas', () => {
  const v = opciones(); v[0].active=false
  const p = prepararProducto({...datos(),Variantes:v})
  assert.throws(() => prepararVenta(p,{cantidad:1,varianteId:'s'}))
  assert.throws(() => prepararVenta(p,{cantidad:1,varianteId:'x'}))
  assert.throws(() => prepararProducto({...datos(),Variantes:[v[0],v[0]]}))
})
test('desactivar variante no elimina identidad ni modifica la venta histórica', () => {
  const p = prepararProducto({...datos(),Variantes:opciones()})
  const {venta} = prepararVenta(p,{cantidad:1,varianteId:'l'})
  const actualizado = prepararProducto({...datos(),Variantes:[{...opciones()[0],price:15000}]},p)
  assert.equal(actualizado.Variantes.find(v => v.id==='l').active,false)
  assert.equal(venta.precioUnitario,14000); assert.equal(venta.varianteNombre,'L azul')
})
test('editar una pieza única vendida no vuelve a publicarla', () => {
  const p = prepararProducto({...datos(),PiezaUnica:true})
  const {cambios} = prepararVenta(p,{cantidad:1})
  const editado = prepararProducto({...datos(),Disponible:true},{...p,...cambios})
  assert.equal(editado.Vendido,true); assert.equal(normalizarProducto(editado,'p').visible,false)
})
test('agotados: mostrar, ocultar y a pedido conservan las modalidades', () => {
  for(const [accion,visible,etiqueta] of [['mostrar',true,'Agotado'],['ocultar',false,'Agotado'],['pedido',true,'A pedido']]) {
    const p=normalizarProducto({...datos(),Stock:0,AccionAgotado:accion},'p')
    assert.equal(p.visible,visible); assert.equal(disponibilidadProducto(p),etiqueta)
  }
  assert.equal(normalizarProducto({...datos(),Disponible:false},'p').visible,false)
})
test('cada variante muestra su stock; no se vende en negativo por ser a pedido', () => {
  const p=prepararProducto({...datos(),AccionAgotado:'pedido',Variantes:opciones()})
  assert.throws(() => prepararVenta(p,{cantidad:4,varianteId:'s'}))
  assert.equal(disponibilidadProducto(normalizarProducto(p,'p'),{stock:0,active:true}),'A pedido')
})

test('máximo cinco variantes: acepta de cero a cinco y rechaza seis o más', () => {
  const variantes = cantidad => Array.from({length:cantidad}, (_,i) => ({id:'v'+i,name:'Variante '+i,price:1000+i,stock:i+1,imageUrl:'https://example.test/'+i+'.png',active:true}))
  for (let cantidad = 0; cantidad <= 5; cantidad++) {
    const producto = prepararProducto({...datos(),Variantes:variantes(cantidad)})
    assert.equal(producto.Variantes.length,cantidad)
    for (const [i,variante] of producto.Variantes.entries()) {
      assert.equal(variante.price,1000+i)
      assert.equal(variante.stock,i+1)
      assert.equal(variante.imageUrl,'https://example.test/'+i+'.png')
    }
  }
  for (const cantidad of [6,7,10,11]) {
    assert.throws(() => prepararProducto({...datos(),Variantes:variantes(cantidad)}), /cinco variantes/)
  }
  const completo = prepararProducto({...datos(),Variantes:variantes(5)})
  assert.throws(() => prepararProducto({...datos(),Variantes:[...variantes(4),{...variantes(1)[0],id:'nueva'}]},completo), /cinco variantes/)
  assert.equal(completo.Variantes.length,5)
  assert.throws(() => prepararVenta({...completo,Variantes:variantes(6)},{cantidad:1,varianteId:'v0'}), /cinco variantes/)
})

const taza = () => ({...datos(),Nombre:'Taza',Precio:4000,StockOriginal:8,Variantes:[
  {id:'roja',name:'Roja',price:3000,stock:10,imageUrl:'https://example.test/roja.png',active:true},
  {id:'azul',name:'Azul',price:5000,stock:5,imageUrl:'https://example.test/azul.png',active:true},
]})

test('original 8 más roja 10 y azul 5 suman 23 sin duplicar el total', () => {
  const p=prepararProducto({...taza(),Stock:999})
  assert.equal(p.StockOriginal,8); assert.equal(p.Stock,23)
  const publico=normalizarProducto(p,'taza')
  assert.equal(publico.precio,4000); assert.equal(publico.stockOriginal,8)
  assert.equal(publico.stockVariantes,15); assert.equal(publico.stock,23)
  assert.equal(disponibilidadProducto(publico),'Disponible · 23 unidades')
  assert.equal(disponibilidadProducto(publico,{stock:publico.stockOriginal}),'Disponible · 8 unidades')
})

for (const [id,original,stocks,precio] of [['',7,[10,5],4000],['roja',8,[9,5],3000],['azul',8,[10,4],5000]]) {
  test(`venta de ${id || 'original'} descuenta solo esa opción`, () => {
    const p=prepararProducto(taza()), {cambios,venta}=prepararVenta(p,{cantidad:1,varianteId:id})
    const despues={...p,...cambios}
    assert.equal(despues.StockOriginal,original)
    assert.deepEqual(despues.Variantes.map(v=>v.stock),stocks)
    assert.equal(despues.Stock,22); assert.equal(venta.precioUnitario,precio)
    assert.throws(()=>prepararVenta(p,{cantidad:(id==='roja'?10:id==='azul'?5:8)+1,varianteId:id}),/stock suficiente/)
  })
}

test('conversión de antiguos conserva existencias y no vuelve al esquema anterior', () => {
  const antiguo=datos(), conVariantes={...antiguo,Variantes:opciones()}
  assert.equal(normalizarProducto(antiguo,'p').stockOriginal,5)
  assert.equal(normalizarProducto(conVariantes,'p').stockOriginal,0)
  assert.equal(normalizarProducto(conVariantes,'p').requiereConfirmarStockOriginal,true)
  const convertido=prepararProducto({},conVariantes)
  assert.equal(convertido.StockOriginal,0); assert.equal(convertido.Stock,5)
  const editado=prepararProducto({StockOriginal:8},convertido)
  assert.equal(editado.Stock,13)
  assert.equal(prepararProducto({Stock:13},editado).StockOriginal,8)
  assert.equal(prepararProducto({Variantes:opciones()},antiguo).Stock,10)
  const venta=prepararVenta(antiguo,{cantidad:1})
  assert.equal(venta.cambios.StockOriginal,4); assert.equal(venta.cambios.Stock,4)
  assert.throws(()=>prepararVenta(conVariantes,{cantidad:1}),/stock suficiente/)
})

test('stock original y total respetan tipos, máximos y variantes inactivas', () => {
  for (const StockOriginal of [-1,0.5,'8',1000001]) assert.throws(()=>prepararProducto({...taza(),StockOriginal}))
  assert.throws(()=>prepararProducto({...taza(),StockOriginal:1000000}))
  const p=prepararProducto({...taza(),Variantes:taza().Variantes.map(v=>({...v,active:false}))})
  assert.equal(p.Stock,8); assert.equal(normalizarProducto({...p,AccionAgotado:'ocultar'},'p').visible,true)
  assert.throws(()=>prepararVenta(p,{cantidad:1,varianteId:'roja'}))
})

test('pieza única completa queda vendida por cualquier opción; sin control conserva stock', () => {
  for (const varianteId of ['', 'roja', 'azul']) {
    const p=prepararProducto({...taza(),PiezaUnica:true})
    const vendido={...p,...prepararVenta(p,{cantidad:1,varianteId}).cambios}
    assert.equal(normalizarProducto(vendido,'p').visible,false)
    for (const id of ['', 'roja', 'azul']) assert.throws(()=>prepararVenta(vendido,{cantidad:1,varianteId:id}))
    assert.equal(normalizarProducto(prepararProducto({Disponible:true},vendido),'p').visible,false)
  }
  const p=prepararProducto({...datos(),ManejaStock:false,OfrecerPedido:true,StockOriginal:0})
  assert.equal(prepararVenta(p,{cantidad:10}).cambios.StockOriginal,0)
  assert.equal(disponibilidadProducto(normalizarProducto(p,'p')),'A pedido')
})
