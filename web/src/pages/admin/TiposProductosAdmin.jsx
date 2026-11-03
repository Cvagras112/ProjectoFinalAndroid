
import CategoriasAdmin from './CategoriasAdmin'

export default function TiposProductosAdmin({
  tipos,
  setTipos
}) {
  return (
    <CategoriasAdmin
      categorias={tipos}
      setCategorias={setTipos}
      titulo="Gestión de tipos de productos"
      descripcion="Registra y administra los tipos de productos de BORA."
      nombreElemento="tipo de producto"
    />
  )
}
