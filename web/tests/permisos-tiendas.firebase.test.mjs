import { test, before, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, setDoc, getDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore'
import { prepararProducto, prepararVenta } from '../src/services/productos/inventarioModelo.js'

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Ejecuta exclusivamente con Firestore Emulator.')
let env
const tienda = uid => ({
  ID_Dueno: uid, activo: true, nombre: 'Tienda de prueba', categoria: 'Textil',
  descripcion: 'Tejidos', sector: 'Calbuco', telefono: '', whatsapp: '', emailContacto: '', imagen: '',
})
const datosProducto = {
  Nombre: 'Chal', Categoria: 'Textil', Descripcion: 'Lana', Precio: 12000, Stock: 15, imagen: '', Disponible: true,
  Variantes: Array.from({length:5}, (_,i) => ({id:'v'+i,name:'Variante '+i,price:12000+i,stock:3,imageUrl:'',imagePath:'',active:true})),
}
const producto = () => ({ ...prepararProducto(datosProducto), ID_Producto:'existente', ID_Tienda:'u' })
const cliente = uid => uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore()

before(async () => {
  env = await initializeTestEnvironment({ projectId:'demo-bora-permisos-tiendas', firestore:{
    rules:readFileSync(new URL('../../firestore.rules',import.meta.url),'utf8'),
  } })
})
beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async contexto => {
    const db = contexto.firestore(), batch = writeBatch(db)
    for (const uid of ['u','otra']) {
      batch.set(doc(db,'usuarios',uid),{rol:'emprendedor',activo:true})
      batch.set(doc(db,'emprendedores',uid),{ID_Tienda:uid,activo:true})
      batch.set(doc(db,'tiendas',uid),tienda(uid))
    }
    batch.set(doc(db,'usuarios/admin'),{rol:'administrador',activo:true})
    batch.set(doc(db,'productos/existente'),producto())
    await batch.commit()
  })
})
after(async () => { await env?.cleanup() })

function venderDirectamente(db, uid) {
  const antes = producto()
  const { cambios, venta } = prepararVenta(antes,{cantidad:1,varianteId:'v4'})
  const ventaId = uid+'_op'
  const batch = writeBatch(db)
  batch.update(doc(db,'productos/existente'),{...cambios,UltimaVenta:ventaId,ActualizadoEn:serverTimestamp()})
  batch.set(doc(db,'ventas',ventaId),{...venta,productoId:'existente',tiendaId:'u',usuarioId:uid,operacionId:'op',indiceVariante:4,fecha:serverTimestamp()})
  batch.set(doc(db,'movimientosInventario',uid,'operaciones/op'),{productoId:'existente',tiendaId:'u',varianteId:'v4',cantidad:1,ventaId,fecha:serverTimestamp()})
  return batch.commit()
}

const operaciones = {
  'editar tienda': db => updateDoc(doc(db,'tiendas/u'),{nombre:'Tienda actualizada',portada:'https://example.test/portada.jpg'}),
  'crear producto': db => setDoc(doc(db,'productos/nuevo'),{...producto(),ID_Producto:'nuevo',ActualizadoEn:serverTimestamp()}),
  'editar producto': db => updateDoc(doc(db,'productos/existente'),{Nombre:'Chal actualizado',Revision:2,ActualizadoEn:serverTimestamp()}),
  'eliminar producto': db => deleteDoc(doc(db,'productos/existente')),
  'registrar venta': (db,uid) => venderDirectamente(db,uid||'u'),
}
const casos = [
  {nombre:'emprendedora activa propietaria',uid:'u',permitido:true},
  {nombre:'cuenta desactivada',uid:'u',usuario:{rol:'emprendedor',activo:false}},
  {nombre:'rol cambiado a comprador',uid:'u',usuario:{rol:'comprador',activo:true}},
  {nombre:'rol cambiado a administrador',uid:'u',usuario:{rol:'administrador',activo:true}},
  {nombre:'cuenta sin rol',uid:'u',usuario:{activo:true}},
  {nombre:'cuenta sin estado activo',uid:'u',usuario:{rol:'emprendedor'}},
  {nombre:'cuenta sin documento de usuario',uid:'u',sinUsuario:true},
  {nombre:'emprendedora propietaria de otra tienda',uid:'otra'},
  {nombre:'visitante',uid:null},
  {nombre:'perfil de emprendedora desactivado',uid:'u',perfil:{activo:false}},
  {nombre:'tienda desactivada',uid:'u',tienda:{activo:false}},
  {nombre:'tienda con otra dueña',uid:'u',tienda:{ID_Dueno:'otra'}},
]

for (const caso of casos) {
  for (const [nombre,operacion] of Object.entries(operaciones)) {
    test(`${caso.nombre}: ${nombre} ${caso.permitido?'permitido':'rechazado'}`, async () => {
      await env.withSecurityRulesDisabled(async contexto => {
        const db = contexto.firestore()
        if (caso.usuario) await setDoc(doc(db,'usuarios/u'),caso.usuario)
        if (caso.sinUsuario) await deleteDoc(doc(db,'usuarios/u'))
        if (caso.perfil) await updateDoc(doc(db,'emprendedores/u'),caso.perfil)
        if (caso.tienda) await updateDoc(doc(db,'tiendas/u'),caso.tienda)
      })
      const intento = operacion(cliente(caso.uid),caso.uid)
      if (caso.permitido) await assertSucceeds(intento)
      else {
        await assertFails(intento)
        // Ninguna escritura rechazada debe eliminar el producto ni dejar una venta parcial.
        assert.equal((await getDoc(doc(cliente(null),'productos/existente'))).data().Stock,15)
        assert.equal((await getDoc(doc(cliente(null),'productos/nuevo'))).exists(),false)
        await env.withSecurityRulesDisabled(async contexto => {
          const db = contexto.firestore()
          assert.equal((await getDoc(doc(db,'ventas',(caso.uid||'u')+'_op'))).exists(),false)
          assert.equal((await getDoc(doc(db,'movimientosInventario',caso.uid||'u','operaciones/op'))).exists(),false)
        })
      }
    })
  }
}

test('propietaria guarda todos los campos del editor, actualiza portada y puede vaciarla', async () => {
  const db = cliente('u'), referencia = doc(db,'tiendas/u')
  const {ID_Dueno: _duena, activo: _activo, ...campos} = tienda('u')
  assert.equal(_duena,'u'); assert.equal(_activo,true)
  await assertSucceeds(updateDoc(referencia,{...campos,portada:''}))
  for (const url of ['https://example.test/portada.jpg','http://example.test/otra.png','HTTPS://example.test/imagen.png','https://example.test/'+'a'.repeat(1979),'']) {
    await assertSucceeds(updateDoc(referencia,{portada:url}))
    assert.equal((await getDoc(doc(cliente(null),'tiendas/u'))).data().portada,url)
  }
})

test('tiendas antiguas sin portada pueden actualizarse sin agregar ese campo', async () => {
  await assertSucceeds(updateDoc(doc(cliente('u'),'tiendas/u'),{nombre:'Nombre actualizado'}))
  assert.equal((await getDoc(doc(cliente(null),'tiendas/u'))).data().portada,undefined)
})

test('portada rechaza tipos incorrectos, protocolos no admitidos, URLs incompletas y más de 2000 caracteres', async () => {
  const referencia = doc(cliente('u'),'tiendas/u')
  for (const portada of [null,1,false,{},[], 'javascript:alert(1)','data:image/png;base64,abc','file:///imagen.png','ftp://example.test/imagen.png','https://','https:///sin-host','https://example.test/a b.png','https://example.test/'+'a'.repeat(1980)]) {
    await assertFails(updateDoc(referencia,{portada}))
  }
  assert.equal((await getDoc(doc(cliente(null),'tiendas/u'))).data().portada,undefined)
})

test('portada no permite cambiar dueña, estado ni introducir campos no autorizados', async () => {
  const referencia = doc(cliente('u'),'tiendas/u')
  for (const campos of [{ID_Dueno:'otra'},{activo:false},{campoIntruso:true},{nombre:7},{categoria:''}]) {
    await assertFails(updateDoc(referencia,{...campos,portada:'https://example.test/portada.png'}))
  }
  await assertFails(updateDoc(doc(cliente('u'),'tiendas/otra'),{portada:'https://example.test/ajena.png'}))
  await assertFails(deleteDoc(referencia))
  await assertFails(setDoc(doc(cliente('u'),'tiendas/nueva'),tienda('u')))
})

test('administración mantiene alta atómica, categorías, asociaciones y asignaciones sin acceder como propietaria', async () => {
  const db = cliente('admin'), uid = 'nueva', nombre = 'Nueva emprendedora'
  const batch = writeBatch(db)
  batch.set(doc(db,'usuarios',uid),{ID:uid,nombre,email:'nueva@example.test',rol:'emprendedor',activo:true})
  batch.set(doc(db,'emprendedores',uid),{ID_Tienda:uid,activo:true,nombre,telefono:'',descripcion:'',direccion:''})
  batch.set(doc(db,'tiendas',uid),tienda(uid))
  await assertSucceeds(batch.commit())
  await assertSucceeds(setDoc(doc(db,'categorias/textil'),{nombre:'Textil',estado:'Activa'}))
  await assertSucceeds(setDoc(doc(db,'asociaciones/comunidad'),{nombre:'Comunidad',descripcion:'',estado:'Activa',sector:'',contacto:'',logo:''}))
  await assertSucceeds(setDoc(doc(db,'asignaciones',uid),{emprendedoraId:uid,asociacionId:'comunidad'}))
  await assertFails(updateDoc(doc(db,'tiendas/u'),{portada:'https://example.test/admin.png'}))
  await assertSucceeds(updateDoc(doc(db,'usuarios',uid),{activo:false}))
  await assertFails(updateDoc(doc(env.authenticatedContext(uid).firestore(),'tiendas',uid),{nombre:'No permitido'}))
})
