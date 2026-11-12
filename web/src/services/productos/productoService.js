import { guardarProductoTransaccion } from './inventarioTransacciones'
import { normalizarProducto } from './productoModelo'

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
} from 'firebase/firestore'

import { auth, db } from '../../firebase/config'

export const IMAGEN_PRODUCTO_PREDETERMINADA =
  'https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?w=900&auto=format&fit=crop&q=85'

// Adaptar documentos de Firestore al formato del frontend.
function adaptarProducto(documento, tiendas = {}) {
  const datos = documento.data()
  const tiendaId = datos.ID_Tienda || datos.idTienda || ''
  const tienda = tiendas[tiendaId]

  return {
    ...normalizarProducto(datos, documento.id),
    imagen: datos.imagen?.trim() || datos.Imagen?.trim() || IMAGEN_PRODUCTO_PREDETERMINADA,
    tienda: tienda?.nombre || 'Emprendimiento BORA',
    whatsapp: tienda?.whatsapp || tienda?.telefono || '',
    emailContacto: tienda?.emailContacto || tienda?.correo || tienda?.email || '',
    etiqueta: tienda?.nombre || 'Emprendimiento BORA',
  }
}

// Obtener nombres y datos de contacto de tiendas.
async function obtenerTiendas() {
  const resultado = await getDocs(collection(db, 'tiendas'))
  const tiendas = {}

  resultado.docs.forEach((documento) => {
    tiendas[documento.id] = documento.data()
  })

  return tiendas
}

// Obtener productos disponibles para el catálogo público.
export async function obtenerProductos() {
  const [resultadoProductos, tiendas] = await Promise.all([
    getDocs(collection(db, 'productos')),
    obtenerTiendas(),
  ])

  return resultadoProductos.docs
    .map((documento) => adaptarProducto(documento, tiendas))
    .filter((producto) => producto.visible)
}

// Obtener un producto por su ID.
export async function obtenerProductoPorId(id) {
  if (!id) return null

  const resultado = await getDoc(doc(db, 'productos', id))

  if (!resultado.exists()) return null
  if (resultado.data().Disponible === false) return null

  const tiendas = await obtenerTiendas()

  const producto = adaptarProducto(resultado, tiendas)
  return producto.visible ? producto : null
}

// Obtener todos los productos de una tienda,
// incluidos los que están desactivados.
export async function obtenerProductosPorTienda(tiendaId) {
  if (!tiendaId) {
    throw new Error('No se recibió el identificador de la tienda.')
  }

  const resultado = await getDocs(collection(db, 'productos'))

  return resultado.docs
    .filter((documento) => {
      const datos = documento.data()

      return (
        datos.ID_Tienda === tiendaId ||
        datos.idTienda === tiendaId
      )
    })
    .map((documento) => adaptarProducto(documento))
}


// Validar la información antes de guardar.
function validarProducto(datos) {
  const nombre = String(datos.nombre ?? '').trim()
  const categoria = String(datos.categoria ?? '').trim()
  const descripcion = String(datos.descripcion ?? '').trim()
  const imagen = String(datos.imagen ?? '').trim()
  const precio = Number(datos.precio)
  const stock = Number(datos.stock)

  const ofrecerPedido = datos.ofrecerPedido === true
  const piezaUnica = datos.piezaUnica === true

  const accionAgotado = datos.accionAgotado || 'mostrar'

  if (!nombre || nombre.length > 150) {
    throw new Error('El nombre debe tener entre 1 y 150 caracteres.')
  }

  if (!categoria) {
    throw new Error('Debes seleccionar una categoría.')
  }

  if (!Number.isFinite(precio) || precio <= 0) {
    throw new Error('El precio debe ser mayor que cero.')
  }

  if (!Number.isSafeInteger(stock) || stock < 0) {
    throw new Error('El stock debe ser un número entero positivo o cero.')
  }

  if (descripcion.length > 1000) {
    throw new Error('La descripción no puede superar 1000 caracteres.')
  }

  if (imagen && !/^https?:\/\/\S+$/i.test(imagen)) {
    throw new Error('La imagen debe tener una URL válida.')
  }

  if (!['mostrar', 'ocultar', 'pedido'].includes(accionAgotado)) {
    throw new Error('Selecciona una opción válida para cuando se agote.')
  }

  return {
    Nombre: nombre,
    Categoria: categoria,
    Descripcion: descripcion,
    Precio: precio,
    Stock: stock,
    imagen,
    Disponible: datos.disponible !== false,

    // Nuevas opciones de producto
    OfrecerPedido: ofrecerPedido,
    PiezaUnica: piezaUnica,
    AccionAgotado: accionAgotado,
    ...(datos.variantes ? { Variantes: datos.variantes.map(v => ({
      id: v.id, name: String(v.name || '').trim(), price: Number(v.price), stock: Number(v.stock),
      imageUrl: String(v.imageUrl || '').trim(), imagePath: v.imagePath || '', active: v.active !== false,
    })) } : {}),
  }
}


// Comprobar que la sesión actual pertenece
// al propietario de una tienda activa.
async function verificarPropiedad(tiendaId) {
  const usuario = auth.currentUser

  if (!usuario) {
    throw new Error('Debes iniciar sesión.')
  }

  if (!tiendaId) {
    throw new Error('No se identificó la tienda.')
  }

  const [perfil, tienda] = await Promise.all([
    getDoc(doc(db, 'emprendedores', usuario.uid)),
    getDoc(doc(db, 'tiendas', tiendaId)),
  ])

  if (!perfil.exists() || !tienda.exists()) {
    throw new Error('No encontramos tu emprendimiento.')
  }

  const datosPerfil = perfil.data()
  const datosTienda = tienda.data()

  if (
    datosPerfil.activo !== true ||
    datosPerfil.ID_Tienda !== tiendaId ||
    datosTienda.activo !== true ||
    datosTienda.ID_Dueno !== usuario.uid
  ) {
    throw new Error('No tienes autorización para administrar esta tienda.')
  }

  return usuario
}

// Crear un producto en la tienda del emprendedor.
export async function crearProducto(tiendaId, datos) {
  await verificarPropiedad(tiendaId)

  const producto = validarProducto(datos)

  const referencia = doc(collection(db, 'productos'))

  const resultado = await guardarProductoTransaccion(db, auth.currentUser?.uid, {
    productoId: datos.idCreacion || referencia.id, tiendaId, datos: producto, revision: null,
  })

  return resultado.productoId

}

// Editar un producto existente.
export async function editarProducto(productoId, tiendaId, datos) {
  await verificarPropiedad(tiendaId)

  if (!productoId) {
    throw new Error('No se identificó el producto.')
  }

  const referencia = doc(db, 'productos', productoId)
  const resultado = await getDoc(referencia)

  if (!resultado.exists()) {
    throw new Error('El producto no existe.')
  }

  if (resultado.data().ID_Tienda !== tiendaId) {
    throw new Error('Este producto no pertenece a tu tienda.')
  }

  const producto = validarProducto(datos)

  await guardarProductoTransaccion(db, auth.currentUser?.uid, {
    productoId, tiendaId, datos: producto, revision: datos.revision ?? 0,
  })
}

// Eliminar un producto de la tienda.
export async function eliminarProducto(productoId, tiendaId) {
  await verificarPropiedad(tiendaId)

  if (!productoId) {
    throw new Error('No se identificó el producto.')
  }

  const referencia = doc(db, 'productos', productoId)
  const resultado = await getDoc(referencia)

  if (!resultado.exists()) {
    throw new Error('El producto no existe.')
  }

  if (resultado.data().ID_Tienda !== tiendaId) {
    throw new Error('Este producto no pertenece a tu tienda.')
  }

  await deleteDoc(referencia)
}
