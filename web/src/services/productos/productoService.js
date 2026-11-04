
import {
  collection,
  doc,
  getDoc,
  getDocs,
} from 'firebase/firestore'

import { db } from '../../firebase/config'

// Imagen utilizada cuando el producto no tiene fotografía.
export const IMAGEN_PRODUCTO_PREDETERMINADA =
  'https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?w=900&auto=format&fit=crop&q=85'

// Adaptar los campos de Firestore al formato del frontend.
function adaptarProducto(documento, tiendas = {}) {
  const datos = documento.data()

  const tiendaId = datos.ID_Tienda || datos.idTienda || ''

  const tienda = tiendas[tiendaId]

  return {
    id: documento.id,
    nombre: datos.Nombre || datos.nombre || 'Producto sin nombre',
    categoria: datos.Categoria || datos.categoria || 'Sin categoría',
    precio: Number(datos.Precio ?? datos.precio ?? 0),
    stock: Number(datos.Stock ?? datos.stock ?? 0),
    disponible: datos.Disponible !== false,
    imagen:
      datos.imagen?.trim() ||
      datos.Imagen?.trim() ||
      IMAGEN_PRODUCTO_PREDETERMINADA,
    descripcion:
      datos.Descripcion ||
      datos.descripcion ||
      'Este producto todavía no tiene una descripción disponible.',
    tiendaId,
    tienda: tienda?.nombre || 'Emprendimiento BORA',
    etiqueta: 'Producto BORA',
  }
}

// Obtener nombres de las tiendas.
async function obtenerTiendas() {
  const resultado = await getDocs(collection(db, 'tiendas'))

  const tiendas = {}

  resultado.docs.forEach((documento) => {
    tiendas[documento.id] = documento.data()
  })

  return tiendas
}

// Obtener productos disponibles para el catálogo.
export async function obtenerProductos() {
  const [resultadoProductos, tiendas] = await Promise.all([
    getDocs(collection(db, 'productos')),
    obtenerTiendas(),
  ])

  return resultadoProductos.docs
    .map((documento) => adaptarProducto(documento, tiendas))
    .filter((producto) => producto.disponible)
}

// Obtener un producto por su identificador.
export async function obtenerProductoPorId(id) {
  if (!id) return null

  const referencia = doc(db, 'productos', id)
  const resultado = await getDoc(referencia)

  if (!resultado.exists()) return null

  const datos = resultado.data()

  if (datos.Disponible === false) return null

  const tiendas = await obtenerTiendas()

  return adaptarProducto(resultado, tiendas)
}
