
import { Link, useParams } from 'react-router-dom'
import { productosDemo } from '../../data/productosDemo'
import BotonFavorito from '../../components/BotonFavorito'
import './ProductoDetalle.css'

function formatoPrecio(precio) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(precio)
}

export default function ProductoDetalle() {
  // Obtiene el ID del producto desde la dirección web.
  const { id } = useParams()

  // Busca el producto correspondiente.
  const producto = productosDemo.find(
    (item) => String(item.id) === id
  )

  // Si el producto no existe.
  if (!producto) {
    return (
      <main className="bora-producto-no-encontrado">
        <h1>Producto no encontrado</h1>
        <p>
          El producto que buscas no está disponible.
        </p>
        <Link to="/productos">
          Volver al catálogo
        </Link>
      </main>
    )
  }

  // Productos de la misma categoría, excluyendo el actual.
  const relacionados = productosDemo
    .filter(
      (item) =>
        item.categoria === producto.categoria &&
        item.id !== producto.id
    )
    .slice(0, 4)

  return (
    <main className="bora-producto-pagina">

      {/* NAVEGACIÓN */}
      <nav
        className="bora-producto-ruta"
        aria-label="Ruta de navegación"
      >
        <Link to="/productos">
          ← Volver al catálogo
        </Link>

        <span>/</span>

        <Link to="/productos">
          Productos
        </Link>

        <span>/</span>

        <span>{producto.categoria}</span>

        <span>/</span>

        <strong>{producto.nombre}</strong>
      </nav>

      {/* CONTENIDO PRINCIPAL */}
      <section className="bora-producto-contenedor">

        {/* FOTOGRAFÍA PRINCIPAL */}
        <div className="bora-producto-galeria">
          <div className="bora-producto-foto">
            <img
              src={producto.imagen}
              alt={producto.nombre}
            />
          </div>

          <p className="bora-producto-foto-nota">
            Imagen ilustrativa del producto.
          </p>
        </div>

        {/* INFORMACIÓN DEL PRODUCTO */}
        <div className="bora-producto-informacion">

          <span className="bora-producto-categoria">
            {producto.categoria}
          </span>

          <div className="bora-producto-titulo-fila">
            <h1>{producto.nombre}</h1>

            <BotonFavorito productoId={producto.id} />
          </div>

          <span className="bora-producto-etiqueta">
            {producto.etiqueta}
          </span>

          <strong className="bora-producto-precio">
            {formatoPrecio(producto.precio)}
          </strong>

          <div className="bora-producto-vendedor">
            <span className="bora-producto-vendedor-icono">
              🏪
            </span>

            <div>
              <small>Producto ofrecido por</small>
              <h2>{producto.tienda}</h2>
              <p>Emprendimiento de nuestra comunidad</p>
            </div>
          </div>

          <div className="bora-producto-descripcion">
            <h2>Descripción del producto</h2>
            <p>{producto.descripcion}</p>
          </div>

          <div className="bora-producto-acciones">
            <button
              type="button"
              className="bora-producto-contactar"
              disabled
              title="Disponible al integrar los datos reales"
            >
              Contactar emprendimiento
            </button>

            <p>
              La opción de contacto estará disponible
              cuando integremos los emprendimientos
              reales a BORA.
            </p>
          </div>

        </div>
      </section>

      {/* PRODUCTOS RELACIONADOS */}
      {relacionados.length > 0 && (
        <section className="bora-producto-relacionados">
          <div className="bora-producto-relacionados-titulo">
            <h2>También te puede interesar</h2>

            <Link to="/productos">
              Explorar más productos
            </Link>
          </div>

          <div className="bora-producto-relacionados-grid">
            {relacionados.map((item) => (
              <Link
                key={item.id}
                to={`/productos/${item.id}`}
                className="bora-producto-relacionado"
              >
                <img
                  src={item.imagen}
                  alt={item.nombre}
                  loading="lazy"
                />

                <div>
                  <span>{item.categoria}</span>
                  <h3>{item.nombre}</h3>
                  <p>{item.tienda}</p>
                  <strong>
                    {formatoPrecio(item.precio)}
                  </strong>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

    </main>
  )
}
