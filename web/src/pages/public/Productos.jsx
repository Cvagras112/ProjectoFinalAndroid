import { useEffect, useState } from 'react'
import { obtenerProductos } from '../../services/productos/productoService'
import { obtenerTiendasPublicas } from '../../services/tiendas/tiendaService'
import { obtenerNombresCategoriasActivas } from '../../services/categorias/categoriaService'
import CatalogoPublico from '../../components/public/CatalogoPublico'
import './Productos.css'

export default function Productos() {
  const [productos, setProductos] = useState([])
  const [tiendas, setTiendas] = useState([])
  const [categorias, setCategorias] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [avisoTiendas, setAvisoTiendas] = useState('')

  useEffect(() => {
    let activo = true
    async function cargar() {
      // Los fallos de metadatos no deben impedir consultar los productos.
      const [lista, emprendimientos, tipos] = await Promise.allSettled([
        obtenerProductos(), obtenerTiendasPublicas(), obtenerNombresCategoriasActivas(),
      ])
      if (!activo) return
      if (lista.status === 'fulfilled') setProductos(lista.value)
      else setError('No pudimos cargar los productos. Inténtalo nuevamente.')
      if (emprendimientos.status === 'fulfilled') setTiendas(emprendimientos.value)
      else setAvisoTiendas('No pudimos cargar los tipos de emprendimiento. Recarga la página para reintentar.')
      if (tipos.status === 'fulfilled') setCategorias(tipos.value)
      setCargando(false)
    }
    cargar()
    return () => { activo = false }
  }, [])

  return (
    <main className="bora-catalogo">
      <section className="bora-catalogo-encabezado">
        <span>DESCUBRE EL TALENTO LOCAL</span>
        <h1>Explorar productos</h1>
        <p>Encuentra productos únicos creados por emprendedoras de nuestra comunidad.</p>
      </section>
      <section className="bora-catalogo-contenido" aria-label="Catálogo público de productos">
        {avisoTiendas && <p className="bora-catalogo-aviso" role="status">{avisoTiendas}</p>}
        <CatalogoPublico productos={productos} tiendas={tiendas} categoriasAdicionales={categorias} cargando={cargando} error={error} />
      </section>
    </main>
  )
}
