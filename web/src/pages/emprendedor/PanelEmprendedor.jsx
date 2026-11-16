

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../../firebase/config'

import {
    obtenerTiendaEmprendedor,
} from '../../services/tiendas/tiendaService'

import {
    obtenerProductosPorTienda,
    crearProducto,
    editarProducto,
    eliminarProducto,
} from '../../services/productos/productoService'

import VentasPanel from '../../components/emprendedor/VentasPanel'
import ImagenPublica from '../../components/ImagenPublica'
import './PanelEmprendedor.css'

const SECCIONES = [
    { id: 'inicio', nombre: 'Inicio', descripcion: 'Un vistazo a tu emprendimiento y sus accesos principales.' },
    { id: 'productos', nombre: 'Mis productos', descripcion: 'Administra los productos que ofreces en BORA.' },
    { id: 'ventas', nombre: 'Ventas', descripcion: 'Registra lo vendido y consulta tu historial.' },
    { id: 'tienda', nombre: 'Mi tienda', descripcion: 'Revisa la información y los contactos de tu emprendimiento.' },
]

function IconoPanel({ nombre }) {
    const trazos = {
        inicio: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
        productos: 'm12 3 9 5-9 5-9-5Zm-9 5v9l9 5 9-5V8M12 13v9M7.5 5.5l9 5',
        ventas: 'M5 3h14v18l-3-2-4 2-4-2-3 2ZM9 8h6M9 12h6M9 16h3',
        tienda: 'M3 10h18l-2-7H5Zm1 0v11h16V10M9 21v-7h6v7',
        menu: 'M4 6h16M4 12h16M4 18h16',
        cerrar: 'm6 6 12 12M6 18 18 6',
        flecha: 'M4 12h16m-6-6 6 6-6 6',
        volver: 'M20 12H4m6-6-6 6 6 6',
        externo: 'M14 3h7v7m0-7L10 14M10 3H4a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-6',
    }
    return <svg className="panel-emprendedor__icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={trazos[nombre]} /></svg>
}

const FORMULARIO_VACIO = {
    revision: 0,
    variantes: [],
    nombre: '',
    categoria: '',
    descripcion: '',
    precio: '',
    stockOriginal: '',
    requiereConfirmarStockOriginal: false,
    stockOriginalConfirmado: false,
    imagen: '',
    disponible: true,

    // Características del producto
    ofrecerPedido: false,
    piezaUnica: false,

    // Comportamiento cuando se agote
    accionAgotado: 'mostrar',
}

function formatoPrecio(precio) {
    return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        maximumFractionDigits: 0,
    }).format(precio)
}

function imagenParaVistaPrevia(valor) {
    try {
        const url = new URL(valor)
        return ['http:', 'https:'].includes(url.protocol) && url.hostname ? url.href : ''
    } catch {
        return ''
    }
}

export default function PanelEmprendedor() {
    const [seccion, setSeccion] = useState('inicio')
    const [menuAbierto, setMenuAbierto] = useState(false)
    const botonMenu = useRef(null)
    const tituloSeccion = useRef(null)
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
    const [formularioInicial, setFormularioInicial] = useState(JSON.stringify(FORMULARIO_VACIO))
    const hayCambios = formularioAbierto && JSON.stringify(formulario) !== formularioInicial

    function puedeSalirDelFormulario() {
        if (!formularioAbierto) return true
        if (guardando) return false
        return !hayCambios || window.confirm('Tienes cambios sin guardar. ¿Quieres descartarlos?')
    }

    function seleccionarSeccion(id) {
        if (!puedeSalirDelFormulario()) return
        setFormularioAbierto(false)
        setProductoEditando(null)
        setErrorOperacion('')
        setSeccion(id)
        setMenuAbierto(false)
        tituloSeccion.current?.focus()
    }

    useEffect(() => {
        if (!hayCambios) return
        const avisar = evento => {
            evento.preventDefault()
            evento.returnValue = ''
        }
        window.addEventListener('beforeunload', avisar)
        return () => window.removeEventListener('beforeunload', avisar)
    }, [hayCambios])

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
        const nuevo = { ...FORMULARIO_VACIO, variantes: [], idCreacion: crypto.randomUUID() }
        setFormularioInicial(JSON.stringify(nuevo))
        setFormulario(nuevo)
        setErrorOperacion('')
        setMensaje('')
        setFormularioAbierto(true)
        tituloSeccion.current?.focus()
    }


    function abrirEditar(producto) {
        setProductoEditando(producto.id)

        const datos = {
            revision: producto.revision,
            variantes: producto.variantes.map(v => ({ ...v, price: String(v.price), stock: String(v.stock) })),
            nombre: producto.nombre,
            categoria: producto.categoria,
            descripcion: producto.descripcion || '',
            precio: String(producto.precioBase ?? producto.precio),
            stockOriginal: String(producto.stockOriginal),
            requiereConfirmarStockOriginal: producto.requiereConfirmarStockOriginal,
            stockOriginalConfirmado: false,
            imagen: producto.imagen?.includes('unsplash.com/photo-1493106641515')
                ? ''
                : producto.imagen || '',
            disponible: producto.disponible,

            // Características del producto
            ofrecerPedido: producto.ofrecerPedidoBase === true,
            piezaUnica: producto.piezaUnica === true,

            // Comportamiento cuando se agote
            accionAgotado: producto.accionAgotado || 'mostrar',
        }
        setFormularioInicial(JSON.stringify(datos))
        setFormulario(datos)

        setErrorOperacion('')
        setMensaje('')
        setFormularioAbierto(true)
        tituloSeccion.current?.focus()
    }

    function cerrarFormulario() {
        if (!puedeSalirDelFormulario()) return
        setFormularioAbierto(false)
        setProductoEditando(null)
        setErrorOperacion('')
        setSeccion('productos')
        tituloSeccion.current?.focus()
    }

    function cambiarCampo(evento) {
        const { name, value, type, checked } = evento.target

        setFormulario((anterior) => ({
            ...anterior,
            [name]: type === 'checkbox' ? checked : value,
        }))
    }

    function agregarVariante() {
        setFormulario(anterior => anterior.variantes.length >= 5 ? anterior : ({...anterior, variantes: [...anterior.variantes, {
            id: crypto.randomUUID(), name: '', price: anterior.precio || '', stock: '0', imageUrl: '', active: true,
        }]}))
    }
    function cambiarVariante(id, campo, valor) {
        setFormulario(anterior => ({...anterior, variantes: anterior.variantes.map(v => v.id === id ? {...v, [campo]: valor} : v)}))
    }

    async function actualizarProductos() {
        const resultado = await obtenerProductosPorTienda(tienda.id)
        setProductos(resultado)
    }

    async function guardarProducto(evento) {
        evento.preventDefault()
        if (guardando || !tienda) return
        if (formulario.requiereConfirmarStockOriginal && !formulario.stockOriginalConfirmado) {
            setErrorOperacion('Confirma las existencias del producto original antes de guardar.')
            return
        }

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
            let avisoListado = ''
            try {
                await actualizarProductos()
            } catch {
                avisoListado = 'El producto se guardó, pero no pudimos actualizar el listado. Recarga la página para ver los cambios.'
            }

            setFormularioAbierto(false)
            setProductoEditando(null)
            setFormulario({ ...FORMULARIO_VACIO })

            setSeccion('productos')
            setErrorOperacion(avisoListado)
            tituloSeccion.current?.focus()

            setMensaje(
                fueEdicion
                    ? 'Producto actualizado correctamente.'
                    : 'Producto registrado correctamente.'
            )
        } catch (err) {
            console.error('Error al guardar producto:', err)
            setErrorOperacion(
                err.code === 'permission-denied'
                    ? 'No pudimos guardar el producto por falta de permisos. Contacta al administrador.'
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
                    ? 'No pudimos eliminar el producto por falta de permisos. Contacta al administrador.'
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
    const actual = SECCIONES.find(item => item.id === seccion)
    const nombreEmprendedora = auth.currentUser?.displayName
    const tituloActual = formularioAbierto ? (productoEditando ? 'Editar producto' : 'Agregar producto') : actual.nombre
    const imagenVistaPrevia = imagenParaVistaPrevia(formulario.imagen)

    return (
        <main className="panel-emprendedor panel-emprendedor--dashboard">
            <aside className="panel-emprendedor__menu" onKeyDown={evento => {
                if (evento.key === 'Escape' && menuAbierto) {
                    setMenuAbierto(false)
                    botonMenu.current?.focus()
                }
            }}>
                <div className="panel-emprendedor__menu-cabecera">
                    <div className="panel-emprendedor__marca"><IconoPanel nombre="tienda" /><span>BORA<small>Mi emprendimiento</small></span></div>
                    <button ref={botonMenu} type="button" className="panel-emprendedor__menu-toggle" aria-expanded={menuAbierto} aria-controls="panel-menu-contenido" onClick={() => setMenuAbierto(abierto => !abierto)}>
                        <IconoPanel nombre={menuAbierto ? 'cerrar' : 'menu'} />
                        {menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
                    </button>
                </div>
                <div id="panel-menu-contenido" className="panel-emprendedor__menu-contenido" data-abierto={menuAbierto}>
                    <p className="panel-emprendedor__menu-etiqueta">TU ESPACIO</p>
                    <nav className="panel-emprendedor__menu-nav" aria-label="Secciones de tu emprendimiento">
                        {SECCIONES.map(item => (
                            <button key={item.id} type="button" aria-current={seccion === item.id ? 'page' : undefined} onClick={() => seleccionarSeccion(item.id)}>
                                <IconoPanel nombre={item.id} /><span>{item.nombre}</span>
                            </button>
                        ))}
                    </nav>
                    <div className="panel-emprendedor__menu-tienda">
                        <span className="panel-emprendedor__avatar" aria-hidden="true">{tienda.nombre?.slice(0, 1).toLocaleUpperCase('es-CL') || 'B'}</span>
                        <div><strong>{tienda.nombre}</strong><small>{nombreEmprendedora || 'Tu tienda en BORA'}</small></div>
                    </div>
                </div>
            </aside>

            <div className="panel-emprendedor__principal">
                <header className="panel-emprendedor__cabecera">
                    <div>
                        <p className="panel-emprendedor__ruta">{tienda.nombre} <span aria-hidden="true">/</span> {actual.nombre}{formularioAbierto ? ` / ${tituloActual}` : ''}</p>
                        <h1 ref={tituloSeccion} tabIndex={-1} id="panel-titulo">{tituloActual}</h1>
                        <p>{formularioAbierto ? 'Completa la información del producto original y sus variantes.' : actual.descripcion}</p>
                    </div>
                    {formularioAbierto ? (
                        <button type="button" onClick={cerrarFormulario} disabled={guardando} className="panel-emprendedor__boton-secundario panel-emprendedor__ver-tienda"><IconoPanel nombre="volver" /> Volver a Mis productos</button>
                    ) : (
                        <Link to={`/tiendas/${tienda.id}`} className="panel-emprendedor__boton-secundario panel-emprendedor__ver-tienda">Ver tienda pública <IconoPanel nombre="externo" /></Link>
                    )}
                </header>

            <section className="panel-emprendedor__inicio" hidden={seccion !== 'inicio'} aria-label="Resumen de tu tienda">
            <section className="panel-emprendedor__hero">
                <div className="panel-emprendedor__hero-contenido">
                    <span className="panel-emprendedor__etiqueta">HECHO POR TI, COMPARTIDO EN BORA</span>
                    <h2>{nombreEmprendedora ? `¡Hola, ${nombreEmprendedora}!` : '¡Bienvenida a tu espacio BORA!'}</h2>
                    <p>Este es el espacio de <strong>{tienda.nombre}</strong>. Revisa tus productos, registra tus ventas y mantén tu tienda al día.</p>
                </div>
                <span className="panel-emprendedor__hero-icono" aria-hidden="true"><IconoPanel nombre="tienda" /></span>
            </section>

            <section
                className="panel-emprendedor__estadisticas"
                aria-label="Resumen de productos"
            >
                <article className="panel-emprendedor__estadistica">
                    <div className="panel-emprendedor__estadistica-icono">
                        <IconoPanel nombre="tienda" />
                    </div>
                    <div className="panel-emprendedor__estadistica-info">
                        <span>Estado de la tienda</span>
                        <strong>{tienda.activo ? 'Activa' : 'Inactiva'}</strong>
                    </div>
                </article>

                <article className="panel-emprendedor__estadistica">
                    <div className="panel-emprendedor__estadistica-icono panel-emprendedor__estadistica-icono--naranja">
                        <IconoPanel nombre="productos" />
                    </div>
                    <div className="panel-emprendedor__estadistica-info">
                        <span>Productos registrados</span>
                        <strong>{productos.length}</strong>
                    </div>
                </article>

                <article className="panel-emprendedor__estadistica">
                    <div className="panel-emprendedor__estadistica-icono panel-emprendedor__estadistica-icono--gris">
                        <IconoPanel nombre="productos" />
                    </div>
                    <div className="panel-emprendedor__estadistica-info">
                        <span>Productos disponibles</span>
                        <strong>{productosDisponibles}</strong>
                        <small>{productosNoDisponibles} no disponibles</small>
                    </div>
                </article>
            </section>

            <section className="panel-emprendedor__accesos" aria-labelledby="panel-accesos-titulo">
                <h2 id="panel-accesos-titulo">¿Qué quieres hacer hoy?</h2>
                <div className="panel-emprendedor__accesos-grid">
                    {SECCIONES.filter(item => item.id !== 'inicio').map(item => (
                        <button type="button" key={item.id} onClick={() => seleccionarSeccion(item.id)}>
                            <span className="panel-emprendedor__acceso-icono"><IconoPanel nombre={item.id} /></span>
                            <strong>{item.nombre}</strong><span>{item.descripcion}</span><IconoPanel nombre="flecha" />
                        </button>
                    ))}
                </div>
            </section>
            </section>

            {seccion === 'ventas' && <VentasPanel key={tienda.id} tiendaId={tienda.id} productos={productos} actualizarProductos={actualizarProductos} />}
            <div className="panel-emprendedor__contenido" hidden={seccion !== 'productos'}>
                <section className="panel-emprendedor__tarjeta" hidden={formularioAbierto}>
                    <div className="panel-emprendedor__titulo-seccion">
                        <h2><IconoPanel nombre="productos" /> Mis productos</h2>
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

                    <div className="panel-emprendedor__productos">
                        {productos.length === 0 ? (
                            <div className="panel-emprendedor__vacio">
                                <span className="panel-emprendedor__vacio-icono">
                                    <IconoPanel nombre="productos" />
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
                                                    producto.disponible && Number(producto.stock) > 0
                                                        ? 'panel-emprendedor__estado'
                                                        : 'panel-emprendedor__estado panel-emprendedor__estado--inactivo'
                                                }
                                            >
                                                {!producto.disponible
                                                    ? 'No disponible'
                                                    : Number(producto.stock) <= 0
                                                        ? producto.accionAgotado === 'ocultar'
                                                            ? 'Agotado · Oculto del catálogo'
                                                            : 'Agotado'
                                                        : `Disponible · ${producto.stock} unidades`}
                                            </span>

                                            {producto.ofrecerPedido && (
                                                <span className="panel-emprendedor__etiqueta-modalidad panel-emprendedor__etiqueta-modalidad--pedido">
                                                    A pedido
                                                </span>
                                            )}

                                            {producto.piezaUnica && (
                                                <span className="panel-emprendedor__etiqueta-modalidad panel-emprendedor__etiqueta-modalidad--unica">
                                                    Pieza única
                                                </span>
                                            )}

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
                    {formularioAbierto && (
                        <section className="panel-emprendedor__tarjeta panel-emprendedor__editor">
                            <form
                                className="panel-emprendedor__formulario"
                                aria-labelledby="panel-titulo"
                                onSubmit={guardarProducto}
                            >
                                <fieldset className="panel-emprendedor__bloque-formulario" disabled={guardando}>
                                    <legend>Información general</legend>
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

                                    </div>
                                </fieldset>

                                <fieldset className="panel-emprendedor__bloque-formulario" disabled={guardando}>
                                    <legend>Producto original</legend>
                                    <div className="panel-emprendedor__campos">
                                        <label>
                                            Precio original (CLP)
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
                                            Stock original
                                            <input
                                                name="stockOriginal"
                                                type="number"
                                                min="0"
                                                max="1000000"
                                                step="1"
                                                value={formulario.stockOriginal}
                                                onChange={cambiarCampo}
                                                required
                                            />
                                        </label>

                                        <label className="panel-emprendedor__campo-ancho">
                                            URL de la fotografía original (opcional)
                                            <input
                                                name="imagen"
                                                type="url"
                                                placeholder="https://ejemplo.com/imagen.jpg"
                                                value={formulario.imagen}
                                                onChange={cambiarCampo}
                                            />
                                        </label>
                                    </div>
                                    {imagenVistaPrevia && (
                                        <figure className="panel-emprendedor__vista-previa">
                                            <ImagenPublica src={imagenVistaPrevia} alt={`Vista previa de ${formulario.nombre || 'tu producto'}`} />
                                            <figcaption>Vista previa de la fotografía original</figcaption>
                                        </figure>
                                    )}
                                </fieldset>


                                {formulario.requiereConfirmarStockOriginal && (
                                    <div role="note" className="panel-emprendedor__nota-inventario">
                                        <p>Este producto se creó con el inventario anterior. Sus variantes conservan sus existencias. El stock original parte de 0 para no duplicar unidades; ingresa las existencias reales del original y confírmalas.</p>
                                        <label className="panel-emprendedor__campo-check">
                                            <input type="checkbox" name="stockOriginalConfirmado" checked={formulario.stockOriginalConfirmado} onChange={cambiarCampo} required />
                                            Confirmo que el stock original corresponde a sus existencias reales.
                                        </label>
                                    </div>
                                )}

                                <fieldset className="panel-emprendedor__variantes" disabled={guardando}>
                                    <legend>Variantes del producto</legend>
                                    <p>Agrega tallas, colores o presentaciones. Cada opción tiene precio y existencias propios.</p>
                                    {formulario.variantes.map((v, indice) => (
                                        <div className="panel-emprendedor__variante" key={v.id}>
                                            <h4>Variante {indice + 1}</h4>
                                            <div className="panel-emprendedor__campos">
                                                <label>Nombre o descripción
                                                    <input value={v.name} maxLength={150} required onChange={e => cambiarVariante(v.id, 'name', e.target.value)} />
                                                </label>
                                                <label>Precio (CLP)
                                                    <input type="number" min="1" max="999999999" step="1" value={v.price} required onChange={e => cambiarVariante(v.id, 'price', e.target.value)} />
                                                </label>
                                                <label>Stock
                                                    <input type="number" min="0" max="100000" step="1" value={v.stock} required onChange={e => cambiarVariante(v.id, 'stock', e.target.value)} />
                                                </label>
                                                <label>URL de imagen (opcional)
                                                    <input type="url" maxLength={2000} value={v.imageUrl} onChange={e => cambiarVariante(v.id, 'imageUrl', e.target.value)} />
                                                </label>
                                            </div>
                                            <label className="panel-emprendedor__campo-check">
                                                <input type="checkbox" checked={v.active} onChange={e => cambiarVariante(v.id, 'active', e.target.checked)} /> Variante activa
                                            </label>
                                            {!v.active && <small>Se conserva para mantener las referencias del historial.</small>}
                                        </div>
                                    ))}
                                    <button type="button" onClick={agregarVariante} disabled={formulario.variantes.length >= 5}>+ Agregar variante</button>
                                    <small>Máximo 5 variantes en total, incluidas las desactivadas; puedes editar las existentes.</small>
                                </fieldset>

                                <fieldset className="panel-emprendedor__campos panel-emprendedor__bloque-formulario">
                                    <legend>Resumen de inventario</legend>
                                    <label>Stock original<input readOnly value={Number(formulario.stockOriginal || 0)} /></label>
                                    <label>Stock de variantes activas<input readOnly value={formulario.variantes.filter(v => v.active).reduce((n,v) => n + Number(v.stock || 0), 0)} /></label>
                                    <label>Stock total disponible<input readOnly value={Number(formulario.stockOriginal || 0) + formulario.variantes.filter(v => v.active).reduce((n,v) => n + Number(v.stock || 0), 0)} /></label>
                                </fieldset>

                                <fieldset className="panel-emprendedor__bloque-formulario" disabled={guardando}>
                                    <legend>Disponibilidad</legend>
                                    <label className="panel-emprendedor__campo-check">
                                        <input
                                            name="disponible"
                                            type="checkbox"
                                            checked={formulario.disponible}
                                            onChange={cambiarCampo}
                                        />
                                        Mostrar producto como disponible
                                    </label>

                                    <div className="panel-emprendedor__campo-ancho">
                                        <strong>Características del producto</strong>

                                        <label className="panel-emprendedor__campo-check">
                                            <input
                                                name="ofrecerPedido"
                                                type="checkbox"
                                                checked={formulario.ofrecerPedido}
                                                onChange={cambiarCampo}
                                            />
                                            Ofrecer a pedido
                                        </label>

                                        <label className="panel-emprendedor__campo-check">
                                            <input
                                                name="piezaUnica"
                                                type="checkbox"
                                                checked={formulario.piezaUnica}
                                                onChange={cambiarCampo}
                                            />
                                            Pieza única
                                        </label>
                                    </div>

                                    <div className="panel-emprendedor__campo-ancho">
                                        <strong>¿Qué hacer cuando se agote el producto?</strong>

                                        <label className="panel-emprendedor__campo-check">
                                            <input
                                                type="radio"
                                                name="accionAgotado"
                                                value="mostrar"
                                                checked={formulario.accionAgotado === 'mostrar'}
                                                onChange={cambiarCampo}
                                            />
                                            Mostrar como agotado
                                        </label>

                                        <label className="panel-emprendedor__campo-check">
                                            <input
                                                type="radio"
                                                name="accionAgotado"
                                                value="ocultar"
                                                checked={formulario.accionAgotado === 'ocultar'}
                                                onChange={cambiarCampo}
                                            />
                                            Ocultar del catálogo
                                        </label>
                                    </div>

                                </fieldset>

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
                        </section>
                    )}

            </div>

                <section className="panel-emprendedor__tarjeta panel-emprendedor__mi-tienda" hidden={seccion !== 'tienda'} aria-label="Información de tu tienda">
                    <div className="panel-emprendedor__titulo-seccion">
                        <h2><IconoPanel nombre="tienda" /> Información de la tienda</h2>
                    </div>

                    <Link
                        to="/emprendedor/editar-tienda"
                        className="panel-emprendedor__boton-crear"
                    >
                        Editar mi tienda <IconoPanel nombre="flecha" />
                    </Link>

                    <h3 className="panel-emprendedor__tienda-nombre">
                        {tienda.nombre}
                    </h3>

                    <p className="panel-emprendedor__descripcion">
                        {tienda.descripcion || 'Sin descripción registrada.'}
                    </p>

                    <div className="panel-emprendedor__dato">
                        <span>Sector</span>
                        <strong>{tienda.sector || 'Sin sector informado'}</strong>
                    </div>

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
                        Visitar mi tienda <IconoPanel nombre="externo" />
                    </Link>
                </section>
            </div>
        </main>
    )
}


