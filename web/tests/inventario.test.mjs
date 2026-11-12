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
