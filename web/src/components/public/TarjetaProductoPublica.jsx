import { Link } from 'react-router-dom'
import BotonFavorito from '../BotonFavorito'
import ContactosPublicos from '../ContactosPublicos'
import ImagenPublica from '../ImagenPublica'
import { disponibilidadProducto } from '../../services/productos/productoModelo'
import './CatalogoPublico.css'

const pesos = new Intl.NumberFormat('es-CL', {
  style: 'currency', currency: 'CLP', maximumFractionDigits: 0,
})

export default function TarjetaProductoPublica({ producto, tienda, contexto = "general" }) {
  const nombreTienda = tienda?.nombre || producto.tienda || 'Emprendimiento BORA'
  const precio = pesos.format(producto.precio)
  const estado = disponibilidadProducto(producto)
  const variantesActivas = producto.variantes?.filter(v => v.active !== false).length || 0
  const enlace = `/productos/${producto.id}`
  const mensaje = `¡Hola! Vi el producto "${producto.nombre}" en BORA, publicado por "${nombreTienda}", opción "Original", con un precio de ${precio}. Me gustaría obtener más información.`

  return (
    <article className="bora-publico-tarjeta" aria-label={`Ver detalles de ${producto.nombre}`}>
      <div className="bora-publico-foto">
        <Link to={enlace} aria-label={`Ver detalles de ${producto.nombre}`}>
          <ImagenPublica src={producto.imagen} alt={producto.nombre} loading="lazy" />
        </Link>
        <span className="bora-publico-tipo">{contexto === "tienda" ? (producto.categoria || "Sin categoría") : nombreTienda}</span>
        <BotonFavorito productoId={producto.id} />
      </div>
      <div className="bora-publico-info">
        {contexto !== "tienda" && <span className="bora-publico-categoria">{producto.categoria}</span>}
        <h3><Link to={enlace}>{producto.nombre}</Link></h3>
        {producto.tiendaId ? (
          <Link className="bora-publico-tienda" to={`/tiendas/${producto.tiendaId}`}>{nombreTienda}</Link>
        ) : <span className="bora-publico-tienda">{nombreTienda}</span>}
        {producto.descripcion && <p className="bora-publico-descripcion">{producto.descripcion}</p>}
        {variantesActivas > 0 && (
          <Link className="bora-publico-opciones" to={enlace}>
            Original + {variantesActivas} {variantesActivas === 1 ? 'variante' : 'variantes'} · Ver opciones
          </Link>
        )}
        <div className="bora-publico-pie">
          <strong className="bora-publico-precio">{precio}</strong>
          <div className="bora-publico-estados">
            <span className={`bora-publico-estado ${estado.startsWith('Disponible') ? 'bora-publico-estado--disponible' : ''}`}>{estado}</span>
            {producto.ofrecerPedido && estado !== 'A pedido' && <span className="bora-publico-estado">A pedido</span>}
            {producto.piezaUnica && <span className="bora-publico-estado bora-publico-estado--unica">Pieza única</span>}
          </div>
          <div className="bora-publico-acciones">
            <Link className="bora-publico-detalle" to={enlace}>Ver producto <span aria-hidden="true">↗</span></Link>
            <ContactosPublicos
              whatsapp={tienda?.whatsapp || producto.whatsapp}
              correo={tienda?.emailContacto || producto.emailContacto}
              asunto={`Consulta desde BORA — ${producto.nombre}`}
              mensajeWhatsApp={mensaje}
            />
          </div>
        </div>
      </div>
    </article>
  )
}
