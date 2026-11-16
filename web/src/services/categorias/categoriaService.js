import { listarCategorias } from '../../repositories/categorias/categoriaRepository'

export async function obtenerNombresCategoriasActivas() {
  return (await listarCategorias())
    .filter((item) =>
      item.estado === 'Activa' &&
      typeof item.nombre === 'string' &&
      item.nombre.trim()
    )
    .map((item) => item.nombre.trim())
}
