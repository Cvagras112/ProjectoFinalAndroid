
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { db } from '../../firebase/config'
import './TiendaDetalle.css'

const IMAGEN_PREDETERMINADA =
  'https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?w=1200&auto=format&fit=crop&q=85'

const CLAVE_SEGUIDAS = 'bora-tiendas-seguidas'
const TODAS = 'Todas'

function normalizarTexto(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function obtenerSeguidas() {
  try {
    const datos = JSON.parse(
      localStorage.getItem(CLAVE_SEGUIDAS) || '[]'
    )
    return Array.isArray(datos) ? datos : []
  } catch {
    return []
  }
}

function categoriaProducto(producto) {
  return String(
    producto.Categoria || producto.categoria || 'Sin categoría'
  ).trim()
}

function nombreProducto(producto) {
  return String(producto.Nombre || producto.nombre || 'Producto')
}

function precioProducto(producto) {
  const valor = Number(producto.Precio ?? producto.precio ?? 0)
  return Number.isFinite(valor) ? valor : 0
}

function stockProducto(producto) {
  const valor = producto.Stock ?? producto.stock
  if (valor === undefined || valor === null) return null
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : null
}

function formatoPrecio(precio) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(precio)
}

function ImagenConRespaldo({ src, respaldo, alt, ...props }) {
  const [origen, setOrigen] = useState(src || respaldo)

  useEffect(() => {
    setOrigen(src || respaldo)
  }, [src, respaldo])

  return (
    <img
      {...props}
      src={origen}
      alt={alt}
      onError={() => {
        if (origen !== respaldo) setOrigen(respaldo)
      }}
    />
  )
}

export default function TiendaDetalle() {
  const { slug: tiendaId } = useParams()

  const [tienda, setTienda] = useState(null)
  const [productos, setProductos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [categoriaSeleccionada, setCategoriaSeleccionada] =
    useState(TODAS)
  const [precioMinimo, setPrecioMinimo] = useState('')
  const [precioMaximo, setPrecioMaximo] = useState('')
  const [soloConStock, setSoloConStock] = useState(false)
  const [ordenamiento, setOrdenamiento] = useState('predeterminado')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [seguida, setSeguida] = useState(false)
  const [mensajeCompartir, setMensajeCompartir] = useState('')

  useEffect(() => {
    setSeguida(obtenerSeguidas().includes(tiendaId))
    setBusqueda('')
    setCategoriaSeleccionada(TODAS)
    setPrecioMinimo('')
    setPrecioMaximo('')
    setSoloConStock(false)
    setOrdenamiento('predeterminado')
    setMensajeCompartir('')
  }, [tiendaId])

  useEffect(() => {
    let activo = true

    async function cargarTienda() {
      if (!tiendaId) {
        setCargando(false)
        return
      }

      try {
        setCargando(true)
        setError('')
        setTienda(null)
        setProductos([])

        const resultado = await getDoc(
          doc(db, 'tiendas', tiendaId)
        )

        if (!resultado.exists() || resultado.data().activo !== true) {
          return
        }

        const datosTienda = {
          id: resultado.id,
          ...resultado.data(),
        }

        const resultadoProductos = await getDocs(
          collection(db, 'productos')
        )

        const productosTienda = resultadoProductos.docs
          .map((documento) => ({
            ...documento.data(),
            id: documento.id,
          }))
          .filter(
            (producto) =>
              producto.ID_Tienda === tiendaId &&
              producto.Disponible !== false
          )

        if (activo) {
          setTienda(datosTienda)
          setProductos(productosTienda)
        }
      } catch (errorFirebase) {
        console.error('Error al cargar tienda:', errorFirebase)

        if (activo) {
          setError(
            'No pudimos cargar esta tienda. Inténtalo nuevamente.'
          )
        }
      } finally {
        if (activo) setCargando(false)
      }
    }

    cargarTienda()

    return () => {
      activo = false
    }
  }, [tiendaId])

  const categorias = useMemo(() => {
    const mapa = new Map()

    productos.forEach((producto) => {
      const nombre = categoriaProducto(producto)
      const clave = normalizarTexto(nombre)

      if (!mapa.has(clave)) {
        mapa.set(clave, { nombre, cantidad: 0 })
      }

      mapa.get(clave).cantidad += 1
    })

    return [...mapa.values()].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es')
    )
  }, [productos])

  const productosFiltrados = useMemo(() => {
    const minimo =
      precioMinimo === '' ? null : Number(precioMinimo)

    const maximo =
      precioMaximo === '' ? null : Number(precioMaximo)

    const filtrados = productos.filter((producto) => {
      const contenido = normalizarTexto(
        `${nombreProducto(producto)} ${categoriaProducto(producto)} ${
          producto.Descripcion || producto.descripcion || ''
        }`
      )

      const coincideBusqueda = contenido.includes(
        normalizarTexto(busqueda)
      )

      const coincideCategoria =
        categoriaSeleccionada === TODAS ||
        normalizarTexto(categoriaProducto(producto)) ===
          normalizarTexto(categoriaSeleccionada)

      const precio = precioProducto(producto)
      const coincideMinimo = minimo === null || precio >= minimo
      const coincideMaximo = maximo === null || precio <= maximo

      const stock = stockProducto(producto)
      const coincideStock =
        !soloConStock || stock === null || stock > 0

      return (
        coincideBusqueda &&
        coincideCategoria &&
        coincideMinimo &&
        coincideMaximo &&
        coincideStock
      )
    })

    if (ordenamiento === 'precio-asc') {
      filtrados.sort(
        (a, b) => precioProducto(a) - precioProducto(b)
      )
    } else if (ordenamiento === 'precio-desc') {
      filtrados.sort(
        (a, b) => precioProducto(b) - precioProducto(a)
      )
    } else if (ordenamiento === 'nombre-asc') {
      filtrados.sort((a, b) =>
        nombreProducto(a).localeCompare(nombreProducto(b), 'es')
      )
    } else if (ordenamiento === 'nombre-desc') {
      filtrados.sort((a, b) =>
        nombreProducto(b).localeCompare(nombreProducto(a), 'es')
      )
    }

    return filtrados
  }, [
    productos,
    busqueda,
    categoriaSeleccionada,
    precioMinimo,
    precioMaximo,
    soloConStock,
    ordenamiento,
  ])

  const hayFiltros =
    busqueda !== '' ||
    categoriaSeleccionada !== TODAS ||
    precioMinimo !== '' ||
    precioMaximo !== '' ||
    soloConStock ||
    ordenamiento !== 'predeterminado'

  function limpiarFiltros() {
    setBusqueda('')
    setCategoriaSeleccionada(TODAS)
    setPrecioMinimo('')
    setPrecioMaximo('')
    setSoloConStock(false)
    setOrdenamiento('predeterminado')
  }

  function aplicarRango(minimo, maximo) {
    setPrecioMinimo(minimo)
    setPrecioMaximo(maximo)
  }

  function cambiarSeguimiento() {
    const seguidas = obtenerSeguidas()

    const nuevas = seguida
      ? seguidas.filter((id) => id !== tiendaId)
      : [...new Set([...seguidas, tiendaId])]

    localStorage.setItem(
      CLAVE_SEGUIDAS,
      JSON.stringify(nuevas)
    )
    setSeguida(!seguida)
  }

  async function compartirTienda() {
    const datos = {
      title: tienda?.nombre || 'Emprendimiento BORA',
      text: `Conoce ${tienda?.nombre} en BORA`,
      url: window.location.href,
    }

    try {
      if (navigator.share) {
        await navigator.share(datos)
      } else {
        await navigator.clipboard.writeText(datos.url)
        setMensajeCompartir('¡Enlace copiado!')
      }
    } catch (errorCompartir) {
      if (errorCompartir.name !== 'AbortError') {
        setMensajeCompartir('No se pudo compartir el enlace.')
      }
    }
  }

  if (cargando) {
    return (
      <main className="bora-tienda-detalle">
        <div className="bora-tienda-estado">
          <h2>🌿 Cargando emprendimiento...</h2>
          <p>Estamos preparando la información de la tienda.</p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="bora-tienda-detalle">
        <div className="bora-tienda-estado">
          <h2>⚠️ No pudimos cargar la tienda</h2>
          <p>{error}</p>
          <Link to="/tiendas">Volver a emprendimientos</Link>
        </div>
      </main>
    )
  }

  if (!tienda) {
    return (
      <main className="bora-tienda-detalle">
        <div className="bora-tienda-estado">
          <h1>No encontramos este emprendimiento</h1>
          <p>La tienda que buscas no está disponible.</p>
          <Link to="/tiendas">Volver a emprendimientos</Link>
        </div>
      </main>
    )
  }

  const logo = String(tienda.imagen || '').trim()
  const portada = String(tienda.portada || '').trim()
  const comuna = String(tienda.sector || '').trim()

  const telefono = String(
    tienda.whatsapp || tienda.telefono || ''
  ).replace(/\D/g, '')

  const numeroWhatsApp =
    telefono.length === 9 && telefono.startsWith('9')
      ? `56${telefono}`
      : telefono

  const correo = String(
    tienda.emailContacto || tienda.correo || tienda.email || ''
  ).trim()

  const mensaje = `¡Hola! Vi tu tienda "${tienda.nombre}" en BORA y me gustaría obtener más información sobre tus productos.`
  const asunto = `Consulta sobre ${tienda.nombre} - BORA`

  return (
    <main className="bora-tienda-detalle">
      <div className="bora-tienda-contenido">
        <Link className="bora-tienda-volver" to="/tiendas">
          ← Volver a emprendimientos
        </Link>

        <section
          className="bora-tienda-cabecera"
          aria-label="Perfil del emprendimiento"
        >
          <div className="bora-tienda-portada">
            <ImagenConRespaldo
              src={portada}
              respaldo={IMAGEN_PREDETERMINADA}
              alt={`Portada de ${tienda.nombre}`}
            />

            <div className="bora-tienda-portada-overlay" />

            <span className="bora-tienda-portada-distintivo">
              ✦ EMPRENDIMIENTO BORA
            </span>
          </div>

          <div className="bora-tienda-perfil">
            <div className="bora-tienda-identidad-principal">
              <div className="bora-tienda-avatar">
                {logo ? (
                  <ImagenConRespaldo
                    src={logo}
                    respaldo={IMAGEN_PREDETERMINADA}
                    alt={`Logo de ${tienda.nombre}`}
                  />
                ) : (
                  <span>
                    {tienda.nombre?.charAt(0).toUpperCase() || 'B'}
                  </span>
                )}
              </div>

              <div className="bora-tienda-informacion">
                <span className="bora-tienda-etiqueta">
                  {tienda.categoria || 'Emprendimiento BORA'}
                </span>

                <h1>{tienda.nombre}</h1>

                <p className="bora-tienda-descripcion">
                  {tienda.descripcion ||
                    'Conoce los productos de este emprendimiento.'}
                </p>

                <div className="bora-tienda-metadatos">
                  {comuna && (
                    <span>📍 {comuna}, Región de Los Lagos</span>
                  )}

                  <span>
                    🛍️ {productos.length}{' '}
                    {productos.length === 1
                      ? 'producto publicado'
                      : 'productos publicados'}
                  </span>

                  <span>🌿 Tienda activa</span>
                </div>
              </div>
            </div>

            <div className="bora-tienda-acciones">
              <div className="bora-tienda-contactos">
                {numeroWhatsApp && (
                  <a
                    href={`https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensaje)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bora-tienda-contacto-whatsapp"
                  >
                    💬 WhatsApp
                  </a>
                )}

                {correo && (
                  <a
                    href={`mailto:${correo}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensaje)}`}
                    className="bora-tienda-contacto-email"
                  >
                    ✉️ Correo
                  </a>
                )}

                {!numeroWhatsApp && !correo && (
                  <span className="bora-tienda-contacto-no-disponible">
                    Contacto no disponible
                  </span>
                )}
              </div>

              <button
                type="button"
                className={`bora-tienda-seguir ${
                  seguida ? 'activo' : ''
                }`}
                onClick={cambiarSeguimiento}
              >
                {seguida ? '💚 Siguiendo' : '🤍 Seguir tienda'}
              </button>

              <button
                type="button"
                className="bora-tienda-compartir"
                onClick={compartirTienda}
              >
                🔗 Compartir tienda
              </button>

              {mensajeCompartir && (
                <p
                  role="status"
                  className="bora-tienda-mensaje-compartir"
                >
                  {mensajeCompartir}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="bora-tienda-productos" id="productos">
          <div className="bora-tienda-productos-header">
            <span className="bora-tienda-seccion-etiqueta">
              EXPLORA SU CATÁLOGO
            </span>

            <h2>Descubre los productos de {tienda.nombre}</h2>

            <p>
              Encuentra productos de este emprendimiento,
              explora sus categorías y descubre sus creaciones.
            </p>
          </div>

          <div className="bora-tienda-buscador">
            <span className="bora-tienda-buscador-icono" aria-hidden="true">
              🔎
            </span>

            <label htmlFor="bora-buscar-tienda" className="bora-sr-only">
              Buscar productos en esta tienda
            </label>

            <input
              id="bora-buscar-tienda"
              type="search"
              placeholder="Buscar productos, categorías o palabras clave..."
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
            />
          </div>

          <div className="bora-tienda-catalogo">
            <aside
              className="bora-tienda-filtros"
              aria-label="Filtros de productos"
            >
              <div className="bora-tienda-filtros-encabezado">
                <h3>Filtrar productos</h3>

                <button
                  type="button"
                  className="bora-tienda-limpiar"
                  onClick={limpiarFiltros}
                >
                  Limpiar
                </button>
              </div>

              <div className="bora-tienda-filtro-seccion">
                <h4>Categorías</h4>

                <button
                  type="button"
                  className={`bora-tienda-filtro-opcion ${
                    categoriaSeleccionada === TODAS
                      ? 'seleccionada'
                      : ''
                  }`}
                  onClick={() => setCategoriaSeleccionada(TODAS)}
                >
                  <span>Todas</span>
                  <span>{productos.length}</span>
                </button>

                {categorias.map(({ nombre, cantidad }) => (
                  <button
                    type="button"
                    key={normalizarTexto(nombre)}
                    className={`bora-tienda-filtro-opcion ${
                      normalizarTexto(categoriaSeleccionada) ===
                      normalizarTexto(nombre)
                        ? 'seleccionada'
                        : ''
                    }`}
                    onClick={() => setCategoriaSeleccionada(nombre)}
                  >
                    <span>{nombre}</span>
                    <span>{cantidad}</span>
                  </button>
                ))}
              </div>

              <div className="bora-tienda-filtro-seccion">
                <h4>Precio</h4>

                <button
                  type="button"
                  className="bora-tienda-filtro-opcion"
                  onClick={() => aplicarRango('', '10000')}
                >
                  Hasta $10.000
                </button>

                <button
                  type="button"
                  className="bora-tienda-filtro-opcion"
                  onClick={() => aplicarRango('10000', '20000')}
                >
                  $10.000 a $20.000
                </button>

                <button
                  type="button"
                  className="bora-tienda-filtro-opcion"
                  onClick={() => aplicarRango('20000', '')}
                >
                  Desde $20.000
                </button>

                <div className="bora-tienda-precios">
                  <label>
                    <span className="bora-sr-only">Precio mínimo</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="Mínimo"
                      value={precioMinimo}
                      onChange={(evento) =>
                        setPrecioMinimo(evento.target.value)
                      }
                    />
                  </label>

                  <span>—</span>

                  <label>
                    <span className="bora-sr-only">Precio máximo</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="Máximo"
                      value={precioMaximo}
                      onChange={(evento) =>
                        setPrecioMaximo(evento.target.value)
                      }
                    />
                  </label>
                </div>
              </div>

              <div className="bora-tienda-filtro-seccion">
                <h4>Disponibilidad</h4>

                <label className="bora-tienda-stock-filtro">
                  <input
                    type="checkbox"
                    checked={soloConStock}
                    onChange={(evento) =>
                      setSoloConStock(evento.target.checked)
                    }
                  />
                  <span>Con stock disponible</span>
                </label>
              </div>

              <div className="bora-tienda-filtros-pie">
                <span>🌿 Compra y apoya a emprendedores locales.</span>
              </div>
            </aside>

            <div className="bora-tienda-catalogo-resultados">
              <div className="bora-tienda-resultados">
                <div>
                  <strong>{productosFiltrados.length}</strong>{' '}
                  {productosFiltrados.length === 1
                    ? 'producto encontrado'
                    : 'productos encontrados'}
                </div>

                <label className="bora-tienda-ordenar">
                  <span>Ordenar por:</span>

                  <select
                    value={ordenamiento}
                    onChange={(evento) =>
                      setOrdenamiento(evento.target.value)
                    }
                  >
                    <option value="predeterminado">
                      Predeterminado
                    </option>
                    <option value="precio-asc">
                      Menor precio
                    </option>
                    <option value="precio-desc">
                      Mayor precio
                    </option>
                    <option value="nombre-asc">
                      Nombre A-Z
                    </option>
                    <option value="nombre-desc">
                      Nombre Z-A
                    </option>
                  </select>
                </label>
              </div>

              {hayFiltros && (
                <div className="bora-tienda-filtros-activos">
                  <span>Filtros aplicados</span>
                  <button type="button" onClick={limpiarFiltros}>
                    ✕ Quitar filtros
                  </button>
                </div>
              )}

              {productosFiltrados.length > 0 ? (
                <div className="bora-tienda-productos-grid">
                  {productosFiltrados.map((producto) => {
                    const nombre = nombreProducto(producto)
                    const precio = precioProducto(producto)
                    const stock = stockProducto(producto)

                    return (
                      <Link
                        key={producto.id}
                        to={`/productos/${producto.id}`}
                        className="bora-tienda-producto"
                      >
                        <div className="bora-tienda-producto-imagen">
                          <ImagenConRespaldo
                            src={String(
                              producto.imagen || producto.Imagen || ''
                            ).trim()}
                            respaldo={IMAGEN_PREDETERMINADA}
                            alt={nombre}
                            loading="lazy"
                          />

                          <span className="bora-tienda-producto-sello">
                            Producto BORA
                          </span>
                        </div>

                        <div className="bora-tienda-producto-info">
                          <span className="bora-tienda-producto-categoria">
                            {categoriaProducto(producto)}
                          </span>

                          <h3>{nombre}</h3>

                          <p className="bora-tienda-producto-tienda">
                            {tienda.nombre}
                          </p>

                          {producto.Descripcion ||
                          producto.descripcion ? (
                            <p className="bora-tienda-producto-descripcion">
                              {producto.Descripcion ||
                                producto.descripcion}
                            </p>
                          ) : null}

                          <div className="bora-tienda-producto-pie">
                            <strong>{formatoPrecio(precio)}</strong>

                            <span
                              className={
                                stock === 0
                                  ? 'bora-tienda-sin-stock'
                                  : 'bora-tienda-con-stock'
                              }
                            >
                              {stock === 0
                                ? 'Sin stock'
                                : 'Ver producto →'}
                            </span>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              ) : (
                <div className="bora-tienda-sin-productos">
                  <span className="bora-tienda-vacio-icono">🔎</span>
                  <h3>No encontramos productos</h3>

                  <p>
                    {hayFiltros
                      ? 'Prueba cambiando los filtros o el texto de búsqueda.'
                      : 'Esta tienda todavía no tiene productos publicados.'}
                  </p>

                  {hayFiltros && (
                    <button type="button" onClick={limpiarFiltros}>
                      Ver todos los productos
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
