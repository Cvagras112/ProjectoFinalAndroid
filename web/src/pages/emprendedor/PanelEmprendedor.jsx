
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../../firebase/config'
import { obtenerTiendaEmprendedor } from '../../services/tiendas/tiendaService'
import {
    obtenerProductosPorTienda,
    crearProducto,
    editarProducto,
    eliminarProducto,
} from '../../services/productos/productoService'
import './PanelEmprendedor.css'

const FORMULARIO_VACIO = {
    nombre: '',
    categoria: '',
    descripcion: '',
    precio: '',
    stock: '',
    imagen: '',
    disponible: true,
}

function formatoPrecio(precio) {
    return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        maximumFractionDigits: 0,
    }).format(precio)
}

export default function PanelEmprendedor() {
    const [tienda, setTienda] = useState(null)
    const [productos, setProductos] = useState([])
    const [cargando, setCargando] = useState(true)
    const [error, setError] = useState('')

    const [formularioAbierto, setFormularioAbierto] = useState(false)
    const [productoEditando, setProductoEditando] = useState(null)
    const [formulario, setFormulario] = useState(FORMULARIO_VACIO)
    const [guardando, setGuardando] = useState(false)
    const [eliminandoId, setEliminandoId] = useState(null)
    const [mensaje, setMensaje] = useState('')
    const [errorOperacion, setErrorOperacion] = useState('')

    useEffect(() => {
        let activo = true
        let solicitud = 0

        const cancelar = onAuthStateChanged(auth, async (usuario) => {
            const actual = ++solicitud

            if (!activo) return

            setCargando(true)
            setError('')
            setTienda(null)
            setProductos([])

            if (!usuario) {
                setError('Debes iniciar sesión para acceder a tu tienda.')
                setCargando(false)
                return
            }

            try {
                const datosTienda = await obtenerTiendaEmprendedor(usuario.uid)
                const productosTienda = await obtenerProductosPorTienda(
                    datosTienda.id
                )

                if (activo && actual === solicitud) {
                    setTienda(datosTienda)
                    setProductos(productosTienda)
                }
            } catch (err) {
                console.error('Error al cargar el panel:', err)

                if (activo && actual === solicitud) {
                    setError(err.message || 'No pudimos cargar tu emprendimiento.')
                }
            } finally {
                if (activo && actual === solicitud) {
                    setCargando(false)
                }
            }
        })

        return () => {
            activo = false
            solicitud++
            cancelar()
        }
    }, [])

    function abrirCrear() {
        setProductoEditando(null)
        setFormulario({ ...FORMULARIO_VACIO })
        setErrorOperacion('')
        setMensaje('')
        setFormularioAbierto(true)
    }

    function abrirEditar(producto) {
        setProductoEditando(producto.id)
        setFormulario({
            nombre: producto.nombre,
            categoria: producto.categoria,
            descripcion: producto.descripcion || '',
            precio: String(producto.precio),
            stock: String(producto.stock),
            imagen: producto.imagen?.includes('unsplash.com/photo-1493106641515')
                ? ''
                : producto.imagen || '',
            disponible: producto.disponible,
        })
        setErrorOperacion('')
        setMensaje('')
        setFormularioAbierto(true)
    }

    function cerrarFormulario() {
        if (guardando) return
        setFormularioAbierto(false)
        setProductoEditando(null)
        setErrorOperacion('')
    }

    function cambiarCampo(evento) {
        const { name, value, type, checked } = evento.target

        setFormulario((anterior) => ({
            ...anterior,
            [name]: type === 'checkbox' ? checked : value,
        }))
    }

    async function actualizarProductos() {
        const resultado = await obtenerProductosPorTienda(tienda.id)
        setProductos(resultado)
    }

    async function guardarProducto(evento) {
        evento.preventDefault()
        if (guardando || !tienda) return

        setGuardando(true)
        setErrorOperacion('')
        setMensaje('')

        try {
            if (productoEditando) {
                await editarProducto(productoEditando, tienda.id, formulario)
            } else {
                await crearProducto(tienda.id, formulario)
            }

            const fueEdicion = Boolean(productoEditando)

            setFormularioAbierto(false)
            setProductoEditando(null)
            setFormulario({ ...FORMULARIO_VACIO })

            await actualizarProductos()

            setMensaje(
                fueEdicion
                    ? 'Producto actualizado correctamente.'
                    : 'Producto registrado correctamente.'
            )
        } catch (err) {
            console.error('Error al guardar producto:', err)
            setErrorOperacion(
                err.code === 'permission-denied'
                    ? 'Firestore rechazó la operación. Debemos revisar las reglas de seguridad.'
                    : err.message || 'No pudimos guardar el producto.'
            )
        } finally {
            setGuardando(false)
        }
    }

    async function confirmarEliminacion(producto) {
        if (eliminandoId || guardando) return

        const confirmar = window.confirm(
            `¿Quieres eliminar "${producto.nombre}"? Esta acción no se puede deshacer.`
        )

        if (!confirmar) return

        setEliminandoId(producto.id)
        setErrorOperacion('')
        setMensaje('')

        try {
            await eliminarProducto(producto.id, tienda.id)
            await actualizarProductos()
            setMensaje('Producto eliminado correctamente.')
        } catch (err) {
            console.error('Error al eliminar producto:', err)
            setErrorOperacion(
                err.code === 'permission-denied'
                    ? 'Firestore rechazó la eliminación. Debemos revisar las reglas.'
                    : err.message || 'No pudimos eliminar el producto.'
            )
        } finally {
            setEliminandoId(null)
        }
    }

    if (cargando) {
        return (
            <main className="panel-emprendedor">
                <div className="panel-emprendedor__mensaje">
                    <h1>Cargando tu emprendimiento...</h1>
                    <p>Estamos preparando la información de tu tienda.</p>
                </div>
            </main>
        )
    }

    if (error || !tienda) {
        return (
            <main className="panel-emprendedor">
                <div className="panel-emprendedor__mensaje">
                    <h1>No pudimos cargar tu tienda</h1>
                    <p>{error || 'No encontramos tu emprendimiento.'}</p>
                    <Link to="/" className="panel-emprendedor__enlace">
                        Volver al inicio
                    </Link>
                </div>
            </main>
        )
    }

    const productosDisponibles = productos.filter(
        (producto) => producto.disponible
    ).length

    const productosNoDisponibles =
        productos.length - productosDisponibles

    return (
        <main className="panel-emprendedor">
            <section className="panel-emprendedor__hero">
                <div className="panel-emprendedor__hero-contenido">
                    <span className="panel-emprendedor__etiqueta">
                        ✨ MI ESPACIO BORA
                    </span>

                    <h1>¡Bienvenida a tu emprendimiento!</h1>

                    <p>
                        Desde aquí puedes conocer el estado de tu tienda,
                        administrar tus productos y seguir haciendo crecer
                        tu emprendimiento en BORA.
                    </p>
                </div>

                <Link
                    to={`/tiendas/${tienda.id}`}
                    className="panel-emprendedor__hero-accion"
                >
                    🛍️ Ver mi tienda ↗
                </Link>
            </section>

            <section
                className="panel-emprendedor__estadisticas"
                aria-label="Resumen de productos"
            >
                <article className="panel-emprendedor__estadistica">
                    <div className="panel-emprendedor__estadistica-icono">
                        📦
                    </div>
                    <div className="panel-emprendedor__estadistica-info">
                        <span>Total de productos</span>
                        <strong>{productos.length}</strong>
                    </div>
                </article>

                <article className="panel-emprendedor__estadistica">
                    <div className="panel-emprendedor__estadistica-icono panel-emprendedor__estadistica-icono--naranja">
                        ✨
                    </div>
                    <div className="panel-emprendedor__estadistica-info">
                        <span>Productos disponibles</span>
                        <strong>{productosDisponibles}</strong>
                    </div>
                </article>

                <article className="panel-emprendedor__estadistica">
                    <div className="panel-emprendedor__estadistica-icono panel-emprendedor__estadistica-icono--gris">
                        🗃️
                    </div>
                    <div className="panel-emprendedor__estadistica-info">
                        <span>No disponibles</span>
                        <strong>{productosNoDisponibles}</strong>
                    </div>
                </article>
            </section>

            <div className="panel-emprendedor__contenido">
                <section className="panel-emprendedor__tarjeta">
                    <div className="panel-emprendedor__titulo-seccion">
                        <h2>🛍️ Mis productos</h2>
                        <span className="panel-emprendedor__estado">
                            {productos.length} registrados
                        </span>
                    </div>

                    <p className="panel-emprendedor__subtitulo">
                        Agrega, actualiza o elimina los productos de tu emprendimiento.
                    </p>

                    <div className="panel-emprendedor__acciones">
                        <button
                            type="button"
                            className="panel-emprendedor__boton-crear"
                            onClick={abrirCrear}
                            disabled={guardando || Boolean(eliminandoId)}
                        >
                            + Agregar producto
                        </button>
                    </div>

                    {mensaje && (
                        <p className="panel-emprendedor__alerta-exito" role="status">
                            {mensaje}
                        </p>
                    )}

                    {errorOperacion && !formularioAbierto && (
                        <p className="panel-emprendedor__alerta-error" role="alert">
                            {errorOperacion}
                        </p>
                    )}

                    {formularioAbierto && (
                        <form
                            className="panel-emprendedor__formulario"
                            onSubmit={guardarProducto}
                        >
                            <h3>
                                {productoEditando
                                    ? 'Editar producto'
                                    : 'Registrar nuevo producto'}
                            </h3>

                            <div className="panel-emprendedor__campos">
                                <label>
                                    Nombre del producto
                                    <input
                                        name="nombre"
                                        value={formulario.nombre}
                                        onChange={cambiarCampo}
                                        maxLength={150}
                                        required
                                    />
                                </label>


                                <label>
                                    Categoría
                                    <select
                                        name="categoria"
                                        value={formulario.categoria}
                                        onChange={cambiarCampo}
                                        required
                                    >
                                        <option value="">Selecciona una categoría</option>
                                        <option value="Artesanía y Manualidades">
                                            Artesanía y Manualidades
                                        </option>
                                        <option value="Textiles y tejidos">
                                            Textiles y tejidos
                                        </option>
                                        <option value="Gastronomía">
                                            Gastronomía
                                        </option>
                                        <option value="Belleza y bienestar">
                                            Belleza y bienestar
                                        </option>
                                        <option value="Decoración">
                                            Decoración
                                        </option>
                                        <option value="Otros">
                                            Otros
                                        </option>
                                    </select>
                                </label>


                                <label>
                                    Precio (CLP)
                                    <input
                                        name="precio"
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={formulario.precio}
                                        onChange={cambiarCampo}
                                        required
                                    />
                                </label>

                                <label>
                                    Stock
                                    <input
                                        name="stock"
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={formulario.stock}
                                        onChange={cambiarCampo}
                                        required
                                    />
                                </label>

                                <label className="panel-emprendedor__campo-ancho">
                                    Descripción
                                    <textarea
                                        name="descripcion"
                                        value={formulario.descripcion}
                                        onChange={cambiarCampo}
                                        maxLength={1000}
                                        rows={4}
                                    />
                                </label>

                                <label className="panel-emprendedor__campo-ancho">
                                    URL de la imagen (opcional)
                                    <input
                                        name="imagen"
                                        type="url"
                                        placeholder="https://ejemplo.com/imagen.jpg"
                                        value={formulario.imagen}
                                        onChange={cambiarCampo}
                                    />
                                </label>
                            </div>

                            <label className="panel-emprendedor__campo-check">
                                <input
                                    name="disponible"
                                    type="checkbox"
                                    checked={formulario.disponible}
                                    onChange={cambiarCampo}
                                />
                                Mostrar producto como disponible
                            </label>

                            {errorOperacion && (
                                <p className="panel-emprendedor__alerta-error" role="alert">
                                    {errorOperacion}
                                </p>
                            )}

                            <div className="panel-emprendedor__acciones">
                                <button
                                    type="submit"
                                    className="panel-emprendedor__boton-crear"
                                    disabled={guardando}
                                >
                                    {guardando
                                        ? 'Guardando...'
                                        : productoEditando
                                            ? 'Guardar cambios'
                                            : 'Registrar producto'}
                                </button>

                                <button
                                    type="button"
                                    className="panel-emprendedor__boton-secundario"
                                    onClick={cerrarFormulario}
                                    disabled={guardando}
                                >
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    )}

                    <div className="panel-emprendedor__productos">
                        {productos.length === 0 ? (
                            <div className="panel-emprendedor__vacio">
                                <span className="panel-emprendedor__vacio-icono">
                                    📦
                                </span>
                                <h3>Aún no tienes productos</h3>
                                <p>
                                    Usa el botón Agregar producto para registrar
                                    tu primer artículo en BORA.
                                </p>
                            </div>
                        ) : (
                            productos.map((producto) => (
                                <article
                                    className="panel-emprendedor__producto"
                                    key={producto.id}
                                >
                                    <img
                                        className="panel-emprendedor__producto-imagen"
                                        src={producto.imagen}
                                        alt={producto.nombre}
                                        loading="lazy"
                                    />

                                    <div className="panel-emprendedor__producto-info">
                                        <h3>{producto.nombre}</h3>

                                        <p className="panel-emprendedor__producto-precio">
                                            {formatoPrecio(producto.precio)}
                                        </p>

                                        <div className="panel-emprendedor__producto-detalles">
                                            <span
                                                className={
                                                    producto.disponible
                                                        ? 'panel-emprendedor__estado'
                                                        : 'panel-emprendedor__estado panel-emprendedor__estado--inactivo'
                                                }
                                            >
                                                {producto.disponible
                                                    ? 'Disponible'
                                                    : 'No disponible'}
                                            </span>

                                            <span className="panel-emprendedor__stock">
                                                Stock: {producto.stock}
                                            </span>
                                        </div>

                                        <div className="panel-emprendedor__acciones-producto">
                                            <button
                                                type="button"
                                                onClick={() => abrirEditar(producto)}
                                                disabled={guardando || Boolean(eliminandoId)}
                                            >
                                                Editar
                                            </button>

                                            <button
                                                type="button"
                                                className="panel-emprendedor__eliminar"
                                                onClick={() => confirmarEliminacion(producto)}
                                                disabled={guardando || Boolean(eliminandoId)}
                                            >
                                                {eliminandoId === producto.id
                                                    ? 'Eliminando...'
                                                    : 'Eliminar'}
                                            </button>

                                            <Link
                                                to={`/productos/${producto.id}`}
                                                className="panel-emprendedor__enlace"
                                            >
                                                Ver producto →
                                            </Link>
                                        </div>
                                    </div>
                                </article>
                            ))
                        )}
                    </div>
                </section>

                <aside className="panel-emprendedor__tarjeta">
                    <div className="panel-emprendedor__titulo-seccion">
                        <h2>🏪 Mi tienda</h2>
                    </div>

                    <h3 className="panel-emprendedor__tienda-nombre">
                        {tienda.nombre}
                    </h3>

                    <p className="panel-emprendedor__descripcion">
                        {tienda.descripcion || 'Sin descripción registrada.'}
                    </p>

                    <div className="panel-emprendedor__dato">
                        <span>Categoría</span>
                        <strong>{tienda.categoria || 'Sin categoría'}</strong>
                    </div>

                    <div className="panel-emprendedor__dato">
                        <span>Estado de la tienda</span>
                        <span
                            className={
                                tienda.activo
                                    ? 'panel-emprendedor__estado'
                                    : 'panel-emprendedor__estado panel-emprendedor__estado--inactivo'
                            }
                        >
                            {tienda.activo ? 'Activa' : 'Inactiva'}
                        </span>
                    </div>

                    <div className="panel-emprendedor__dato">
                        <span>Productos registrados</span>
                        <strong>{productos.length}</strong>
                    </div>

                    <Link
                        to={`/tiendas/${tienda.id}`}
                        className="panel-emprendedor__tienda-link"
                    >
                        Visitar mi tienda pública ↗
                    </Link>
                </aside>
            </div>
        </main>
    )
}
