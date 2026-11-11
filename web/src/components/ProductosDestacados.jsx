
import { useEffect, useRef, useState } from 'react'
import './ProductosDestacados.css'

const productosDemo = [
    {
        id: 1,
        nombre: 'Cerámica artesanal',
        categoria: 'Artesanía',
        tienda: 'Taller Raíces',
        precio: 12990,
        descripcion: 'Piezas artesanales para dar un toque especial a tu hogar.',
        imagen:
            'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=700&auto=format&fit=crop&q=85',
    },
    {
        id: 2,
        nombre: 'Accesorios hechos a mano',
        categoria: 'Accesorios',
        tienda: 'Manos Creativas',
        precio: 8500,
        descripcion: 'Accesorios con personalidad, dedicación y detalles únicos.',
        imagen:
            'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=700&auto=format&fit=crop&q=85',
    },
    {
        id: 3,
        nombre: 'Decoración natural',
        categoria: 'Decoración',
        tienda: 'Casa Natural',
        precio: 15990,
        descripcion: 'Detalles decorativos inspirados en la naturaleza.',
        imagen:
            'https://images.unsplash.com/photo-1490312278390-ab64016e0aa9?w=700&auto=format&fit=crop&q=85',
    },
    {
        id: 4,
        nombre: 'Prenda tejida artesanalmente',
        categoria: 'Textil y tejidos',
        tienda: 'Tejidos del Sur',
        precio: 18990,
        descripcion: 'Prendas creadas con dedicación y estilo artesanal.',
        imagen:
            'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=700&auto=format&fit=crop&q=85',
    },
]

const formatoPrecio = (precio) =>
    new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        maximumFractionDigits: 0,
    }).format(precio)

export default function ProductosDestacados({
    productos = productosDemo,
}) {
    const [categoriaActiva, setCategoriaActiva] = useState('Todos')
    const [productoSeleccionado, setProductoSeleccionado] = useState(null)

    const [favoritos, setFavoritos] = useState(() => {
        try {
            const guardados = JSON.parse(
                localStorage.getItem('bora-favoritos') || '[]'
            )
            return Array.isArray(guardados) ? guardados : []
        } catch {
            return []
        }
    })

    const carruselRef = useRef(null)

    const categorias = [
        'Todos',
        ...new Set(productos.map((producto) => producto.categoria)),
    ]

    const productosFiltrados =
        categoriaActiva === 'Todos'
            ? productos
            : productos.filter(
                (producto) => producto.categoria === categoriaActiva
            )

    useEffect(() => {
        localStorage.setItem('bora-favoritos', JSON.stringify(favoritos))
    }, [favoritos])

    useEffect(() => {
        if (!productoSeleccionado) return

        const cerrarConEscape = (evento) => {
            if (evento.key === 'Escape') setProductoSeleccionado(null)
        }

        window.addEventListener('keydown', cerrarConEscape)
        return () => window.removeEventListener('keydown', cerrarConEscape)
    }, [productoSeleccionado])

    function cambiarFavorito(id) {
        setFavoritos((actuales) =>
            actuales.includes(id)
                ? actuales.filter((favorito) => favorito !== id)
                : [...actuales, id]
        )
    }

    function cambiarCategoria(categoria) {
        setCategoriaActiva(categoria)

        if (carruselRef.current) {
            carruselRef.current.scrollTo({
                left: 0,
                behavior: 'smooth',
            })
        }
    }

    function moverCarrusel(direccion) {
        carruselRef.current?.scrollBy({
            left: direccion * 340,
            behavior: 'smooth',
        })
    }

    return (
        <section className="bora-seccion bora-productos-seccion bora-reveal bora-productos-nuevos">
            <div className="bora-titulo-fila">
                <div>
                    <span className="bora-subtitulo">
                        ✦ HECHOS CON DEDICACIÓN
                    </span>
                    <h2>Productos destacados</h2>
                    <p>
                        Pequeñas creaciones, grandes historias.
                        Descubre lo especial de nuestra comunidad.
                    </p>
                </div>

                <div className="bora-productos-navegacion">
                    <button
                        type="button"
                        aria-label="Productos anteriores"
                        onClick={() => moverCarrusel(-1)}
                    >
                        ←
                    </button>
                    <button
                        type="button"
                        aria-label="Productos siguientes"
                        onClick={() => moverCarrusel(1)}
                    >
                        →
                    </button>
                </div>
            </div>

            <div className="bora-productos-filtros" aria-label="Filtrar productos">
                {categorias.map((categoria) => (
                    <button
                        key={categoria}
                        type="button"
                        className={categoriaActiva === categoria ? 'activo' : ''}
                        aria-pressed={categoriaActiva === categoria}
                        onClick={() => cambiarCategoria(categoria)}
                    >
                        {categoria}
                    </button>
                ))}
            </div>

            <div className="bora-productos-carrusel" ref={carruselRef}>
                {productosFiltrados.map((producto) => {
                    const favorito = favoritos.includes(producto.id)

                    return (
                        <article className="bora-producto" key={producto.id}>
                            <div className="bora-producto-foto">
                                <img
                                    src={producto.imagen}
                                    alt={producto.nombre}
                                    loading="lazy"
                                />

                                <span className="bora-producto-destacado">
                                    ✦ Destacado
                                </span>

                                <button
                                    type="button"
                                    className={`bora-producto-favorito ${favorito ? 'activo' : ''
                                        }`}
                                    aria-label={
                                        favorito
                                            ? `Quitar ${producto.nombre} de favoritos`
                                            : `Guardar ${producto.nombre} en favoritos`
                                    }
                                    aria-pressed={favorito}
                                    onClick={() => cambiarFavorito(producto.id)}
                                >
                                    {favorito ? '♥' : '♡'}
                                </button>
                            </div>

                            <div className="bora-producto-detalles">
                                <span>{producto.categoria}</span>
                                <h3>{producto.nombre}</h3>
                                <p>Por {producto.tienda}</p>

                                <div className="bora-producto-inferior">
                                    <strong>{formatoPrecio(producto.precio)}</strong>
                                </div>

                                <button
                                    type="button"
                                    className="bora-producto-ver"
                                    onClick={() => setProductoSeleccionado(producto)}
                                >
                                    Ver producto <span>↗</span>
                                </button>
                            </div>
                        </article>
                    )
                })}
            </div>

            <p className="bora-productos-nota">
                Vista de demostración. Próximamente encontrarás productos
                publicados por emprendimientos reales de BORA.
            </p>

            <div className="bora-centrar">
                <a href="/productos" className="bora-boton-verde">
                    Explorar todos los productos →
                </a>
            </div>

            {productoSeleccionado && (
                <div
                    className="bora-modal-fondo"
                    role="presentation"
                    onMouseDown={(evento) => {
                        if (evento.target === evento.currentTarget) {
                            setProductoSeleccionado(null)
                        }
                    }}
                >
                    <div
                        className="bora-modal-producto"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="bora-modal-titulo"
                    >
                        <button
                            type="button"
                            className="bora-modal-cerrar"
                            aria-label="Cerrar vista rápida"
                            onClick={() => setProductoSeleccionado(null)}
                        >
                            ×
                        </button>

                        <img
                            src={productoSeleccionado.imagen}
                            alt={productoSeleccionado.nombre}
                        />

                        <div className="bora-modal-contenido">
                            <span>{productoSeleccionado.categoria}</span>
                            <h2 id="bora-modal-titulo">
                                {productoSeleccionado.nombre}
                            </h2>
                            <p>Por {productoSeleccionado.tienda}</p>
                            <p>{productoSeleccionado.descripcion}</p>
                            <strong>
                                {formatoPrecio(productoSeleccionado.precio)}
                            </strong>

                            <p className="bora-modal-aviso">
                                Producto de demostración. No disponible para compra.
                            </p>


                            <div className="bora-modal-acciones">
                                <button
                                    type="button"
                                    className="bora-modal-comprar"
                                    onClick={() =>
                                        window.alert(
                                            'Próximamente podrás comprar este producto en BORA.'
                                        )
                                    }
                                >
                                    🛍️ Comprar producto
                                </button>

                                <button
                                    type="button"
                                    className="bora-modal-seguir"
                                    onClick={() => setProductoSeleccionado(null)}
                                >
                                    Seguir explorando
                                </button>
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </section>
    )
}
