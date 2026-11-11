
import { useEffect, useRef, useState } from 'react'
import './Ayuda.css'

// ==========================================
// PREGUNTAS FRECUENTES DE BORA
// ==========================================

const preguntas = [
  // GENERAL
  {
    categoria: 'General',
    pregunta: '¿Qué es BORA?',
    respuesta:
      'BORA significa Bazar de Ofertas y Red de Artesanos. Es un marketplace que conecta emprendimientos y compradores.',
    palabrasClave:
      'plataforma aplicacion sitio web significado para que sirve',
  },
  {
    categoria: 'General',
    pregunta: '¿Quiénes pueden utilizar BORA?',
    respuesta:
      'Compradores interesados en descubrir productos y emprendedoras que forman parte de la plataforma.',
    palabrasClave:
      'usuarios personas clientes vendedores artesanos participar',
  },
  {
    categoria: 'General',
    pregunta: '¿BORA es una tienda o un marketplace?',
    respuesta:
      'Es un marketplace que reúne diferentes emprendimientos en un mismo espacio digital.',
    palabrasClave:
      'mercado negocio comercio varias tiendas vender comprar',
  },
  {
    categoria: 'General',
    pregunta: '¿Puedo utilizar BORA desde mi celular?',
    respuesta:
      'BORA contempla una plataforma web adaptable a celulares y una aplicación Android para emprendedoras.',
    palabrasClave:
      'telefono smartphone android movil tablet dispositivo',
  },
  {
    categoria: 'General',
    pregunta: '¿Qué significa el eslogan de BORA?',
    respuesta:
      'Emprendimientos que conectan representa nuestro objetivo de acercar emprendedoras y compradores.',
    palabrasClave:
      'frase lema emprendimientos que conectan identidad',
  },

  // COMPRAS
  {
    categoria: 'Compras',
    pregunta: '¿Necesito registrarme para explorar productos?',
    respuesta:
      'No. Puedes explorar el catálogo público sin iniciar sesión.',
    palabrasClave:
      'sin cuenta invitado navegar mirar productos registro',
  },
  {
    categoria: 'Compras',
    pregunta: '¿Cómo encuentro un producto?',
    respuesta:
      'Puedes explorar el catálogo y utilizar las opciones de búsqueda disponibles.',
    palabrasClave:
      'buscar localizar hallar encontrar articulo catalogo',
  },
  {
    categoria: 'Compras',
    pregunta: '¿Puedo buscar por categorías?',
    respuesta:
      'Las categorías permiten organizar los productos y facilitar su búsqueda cuando esta función esté disponible.',
    palabrasClave:
      'filtrar filtros tipo clasificacion ordenar productos',
  },
  {
    categoria: 'Compras',
    pregunta: '¿Cómo conozco a la emprendedora de un producto?',
    respuesta:
      'Puedes consultar la información de la tienda asociada al producto cuando su perfil esté disponible.',
    palabrasClave:
      'vendedor artesano negocio dueño perfil tienda contacto',
  },
  {
    categoria: 'Compras',
    pregunta: '¿Cómo puedo comprar un producto?',
    respuesta:
      'Las opciones de compra o contacto dependerán de las funciones disponibles en cada tienda. BORA no confirma pagos integrados por ahora.',
    palabrasClave:
      'comprar pagar pago pedido adquirir solicitar comprar online',
  },

  // TIENDAS
  {
    categoria: 'Tiendas',
    pregunta: '¿Cómo puedo incorporarme a BORA?',
    respuesta:
      'La incorporación se realizará mediante el proceso de registro definido para las emprendedoras.',
    palabrasClave:
      'inscribirme unirme registrarme participar vender emprendimiento',
  },
  {
    categoria: 'Tiendas',
    pregunta: '¿Cómo accedo a mi tienda?',
    respuesta:
      'Las emprendedoras podrán acceder mediante los mecanismos de autenticación habilitados en la aplicación.',
    palabrasClave:
      'ingresar entrar login negocio iniciar sesion',
  },
  {
    categoria: 'Tiendas',
    pregunta: '¿Puedo editar la información de mi tienda?',
    respuesta:
      'La aplicación contempla herramientas para administrar la información del emprendimiento.',
    palabrasClave:
      'modificar cambiar actualizar nombre descripcion negocio perfil',
  },
  {
    categoria: 'Tiendas',
    pregunta: '¿Qué información debería mostrar mi tienda?',
    respuesta:
      'Un nombre claro, descripción, fotografías y datos de contacto autorizados.',
    palabrasClave:
      'datos negocio perfil foto descripcion informacion contacto',
  },
  {
    categoria: 'Tiendas',
    pregunta: '¿Qué son las asociaciones?',
    respuesta:
      'Son agrupaciones de emprendedoras que pueden ser registradas y administradas en BORA.',
    palabrasClave:
      'grupo agrupacion organizacion comunidad emprendedoras',
  },

  // PRODUCTOS
  {
    categoria: 'Productos',
    pregunta: '¿Cómo publico un producto?',
    respuesta:
      'Desde la gestión de productos de la aplicación podrás completar la información requerida y guardar la publicación cuando esta función esté habilitada.',
    palabrasClave:
      'publicar subir agregar crear cargar vender articulo publicacion nuevo',
  },
  {
    categoria: 'Productos',
    pregunta: '¿Qué datos necesita un producto?',
    respuesta:
      'Nombre, descripción, precio, categoría e imagen, según los campos habilitados.',
    palabrasClave:
      'formulario requisitos nombre descripcion foto precio informacion',
  },
  {
    categoria: 'Productos',
    pregunta: '¿Puedo cambiar el precio?',
    respuesta:
      'La edición de productos permitirá actualizar los precios cuando esté habilitada.',
    palabrasClave:
      'modificar valor costo actualizar editar dinero precio',
  },
  {
    categoria: 'Productos',
    pregunta: '¿Puedo eliminar un producto?',
    respuesta:
      'Las operaciones de eliminación dependerán de los permisos asignados a tu cuenta.',
    palabrasClave:
      'borrar quitar retirar sacar eliminar publicacion articulo',
  },
  {
    categoria: 'Productos',
    pregunta: '¿Qué fotografías debería utilizar?',
    respuesta:
      'Fotografías claras, bien iluminadas y que representen fielmente el producto.',
    palabrasClave:
      'foto fotos imagen imagenes camara fotografia calidad',
  },

  // MI CUENTA
  {
    categoria: 'Mi cuenta',
    pregunta: '¿Cómo inicio sesión?',
    respuesta:
      'Podrás iniciar sesión mediante los métodos de acceso que estén habilitados en BORA.',
    palabrasClave:
      'login ingresar entrar acceder correo google autenticar',
  },
  {
    categoria: 'Mi cuenta',
    pregunta: '¿Puedo explorar sin una cuenta?',
    respuesta:
      'Sí. Puedes visitar el catálogo público sin registrarte.',
    palabrasClave:
      'invitado navegar mirar sin registro sin login',
  },
  {
    categoria: 'Mi cuenta',
    pregunta: '¿Qué hago si olvidé mi contraseña?',
    respuesta:
      'Utiliza la recuperación de contraseña cuando esté disponible para tu método de acceso.',
    palabrasClave:
      'olvide clave recuperar restablecer password acceso cambiar',
  },
  {
    categoria: 'Mi cuenta',
    pregunta: '¿Puedo modificar mis datos personales?',
    respuesta:
      'Dependerá de las opciones de perfil disponibles para tu tipo de cuenta.',
    palabrasClave:
      'editar perfil actualizar nombre correo informacion personal',
  },
  {
    categoria: 'Mi cuenta',
    pregunta: '¿Por qué no puedo entrar al panel administrativo?',
    respuesta:
      'El panel está reservado para usuarios con permisos de administración.',
    palabrasClave:
      'administrador admin acceso bloqueado permisos autorizado',
  },

  // SEGURIDAD
  {
    categoria: 'Seguridad',
    pregunta: '¿Debo compartir mi contraseña?',
    respuesta:
      'No. Nunca compartas contraseñas ni códigos de verificación.',
    palabrasClave:
      'clave password secreto compartir proteger privacidad',
  },
  {
    categoria: 'Seguridad',
    pregunta: '¿Cómo reconozco información sospechosa?',
    respuesta:
      'Desconfía de enlaces desconocidos y solicitudes inesperadas de datos personales.',
    palabrasClave:
      'estafa fraude phishing mensaje falso enlace peligroso',
  },
  {
    categoria: 'Seguridad',
    pregunta: '¿Puedo acceder a datos de otras tiendas?',
    respuesta:
      'Cada cuenta debe acceder únicamente a la información autorizada para su rol.',
    palabrasClave:
      'permisos privacidad informacion ajena autorizacion',
  },
  {
    categoria: 'Seguridad',
    pregunta: '¿Qué hago si encuentro información incorrecta?',
    respuesta:
      'Comunícala mediante el canal de soporte cuando esté disponible.',
    palabrasClave:
      'reportar denunciar error problema informacion falsa ayuda',
  },
  {
    categoria: 'Seguridad',
    pregunta: '¿Cómo protejo mi cuenta?',
    respuesta:
      'Utiliza contraseñas seguras y cierra sesión en dispositivos compartidos.',
    palabrasClave:
      'seguridad clave proteger hackeo acceso privacidad',
  },
]

const categorias = [
  'Todas',
  'General',
  'Compras',
  'Tiendas',
  'Productos',
  'Mi cuenta',
  'Seguridad',
]

// ==========================================
// FUNCIONES DEL BUSCADOR
// ==========================================

function normalizar(texto) {
  return String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function obtenerPalabras(texto) {
  return normalizar(texto)
    .split(/\s+/)
    .filter(Boolean)
}

function calcularPuntaje(item, consulta) {
  const palabras = obtenerPalabras(consulta)

  if (!palabras.length) return 0

  const titulo = normalizar(item.pregunta)
  const categoria = normalizar(item.categoria)
  const claves = normalizar(item.palabrasClave)
  const respuesta = normalizar(item.respuesta)

  let puntaje = 0

  if (titulo.includes(normalizar(consulta))) {
    puntaje += 30
  }

  for (const palabra of palabras) {
    if (titulo.includes(palabra)) {
      puntaje += 12
    } else if (claves.includes(palabra)) {
      puntaje += 8
    } else if (categoria.includes(palabra)) {
      puntaje += 5
    } else if (respuesta.includes(palabra)) {
      puntaje += 2
    } else {
      return 0
    }
  }

  return puntaje
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export default function Ayuda() {
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('Todas')
  const [guiaActiva, setGuiaActiva] = useState(null)
  const [mostrarSugerencias, setMostrarSugerencias] =
    useState(false)
  const [sugerenciaActiva, setSugerenciaActiva] = useState(-1)
  const [preguntaAbierta, setPreguntaAbierta] = useState(null)

  const buscadorRef = useRef(null)
  const preguntasRef = useRef({})

  const consulta = normalizar(busqueda)

  const coincidencias = consulta
    ? preguntas
        .map((item) => ({
          ...item,
          puntaje: calcularPuntaje(item, consulta),
        }))
        .filter((item) => item.puntaje > 0)
        .sort((a, b) => b.puntaje - a.puntaje)
    : []

  const sugerencias = coincidencias.slice(0, 5)

  const preguntasFiltradas = consulta
    ? coincidencias
    : preguntas.filter(
        (item) =>
          categoria === 'Todas' ||
          item.categoria === categoria
      )

  // Desplazamiento y apertura automática.
  useEffect(() => {
    if (!preguntaAbierta) return

    const elemento = preguntasRef.current[preguntaAbierta]

    if (elemento) {
      elemento.open = true
      elemento.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }
  }, [preguntaAbierta, categoria, busqueda])

  function seleccionarPregunta(item) {
    setBusqueda('')
    setCategoria(item.categoria)
    setPreguntaAbierta(item.pregunta)
    setMostrarSugerencias(false)
    setSugerenciaActiva(-1)
    buscadorRef.current?.blur()
  }

  function manejarTeclado(evento) {
    if (!mostrarSugerencias || !sugerencias.length) {
      if (evento.key === 'Escape') {
        setMostrarSugerencias(false)
      }
      return
    }

    if (evento.key === 'ArrowDown') {
      evento.preventDefault()
      setSugerenciaActiva((actual) =>
        actual < sugerencias.length - 1 ? actual + 1 : 0
      )
    }

    if (evento.key === 'ArrowUp') {
      evento.preventDefault()
      setSugerenciaActiva((actual) =>
        actual > 0 ? actual - 1 : sugerencias.length - 1
      )
    }

    if (evento.key === 'Enter') {
      evento.preventDefault()
      seleccionarPregunta(
        sugerencias[sugerenciaActiva >= 0 ? sugerenciaActiva : 0]
      )
    }

    if (evento.key === 'Escape') {
      setMostrarSugerencias(false)
    }
  }

  function cambiarCategoria(nuevaCategoria) {
    setBusqueda('')
    setCategoria(nuevaCategoria)
    setPreguntaAbierta(null)
    setMostrarSugerencias(false)
  }

  return (
    <main className="ayuda-page">
      {/* ENCABEZADO */}
      <section className="ayuda-hero">
        <div className="ayuda-hero-superior">
          <span className="ayuda-etiqueta">
            ✨ CENTRO DE AYUDA
          </span>
          <span className="ayuda-decoracion" aria-hidden="true">
            ✧
          </span>
        </div>

        <h1>¡Hola! 👋 ¿En qué podemos ayudarte?</h1>
        <p>
          Estamos aquí para ayudarte a descubrir, aprender
          y emprender con BORA.
        </p>

        {/* BUSCADOR INTELIGENTE */}
        <div className="ayuda-buscador-contenedor">
          <div className="ayuda-buscador">
            <span aria-hidden="true">⌕</span>

            <input
              ref={buscadorRef}
              type="search"
              placeholder="Escribe tu duda..."
              aria-label="Buscar preguntas frecuentes"
              aria-autocomplete="list"
              aria-expanded={
                mostrarSugerencias && consulta.length > 0
              }
              aria-controls="ayuda-lista-sugerencias"
              value={busqueda}
              onChange={(evento) => {
                setBusqueda(evento.target.value)
                setMostrarSugerencias(true)
                setSugerenciaActiva(-1)
                setPreguntaAbierta(null)
              }}
              onFocus={() => setMostrarSugerencias(true)}
              onKeyDown={manejarTeclado}
            />
          </div>

          {mostrarSugerencias && consulta && (
            <div
              className="ayuda-sugerencias"
              id="ayuda-lista-sugerencias"
              role="listbox"
              aria-label="Preguntas sugeridas"
            >
              <span className="ayuda-sugerencias-titulo">
                PREGUNTAS SUGERIDAS
              </span>

              {sugerencias.length > 0 ? (
                sugerencias.map((item, indice) => (
                  <button
                    key={item.pregunta}
                    type="button"
                    role="option"
                    aria-selected={
                      indice === sugerenciaActiva
                    }
                    className={
                      indice === sugerenciaActiva
                        ? 'ayuda-sugerencia activa'
                        : 'ayuda-sugerencia'
                    }
                    onMouseDown={(evento) =>
                      evento.preventDefault()
                    }
                    onClick={() => seleccionarPregunta(item)}
                  >
                    <span>
                      <strong>{item.pregunta}</strong>
                      <small>{item.categoria}</small>
                    </span>
                    <span aria-hidden="true">↗</span>
                  </button>
                ))
              ) : (
                <div className="ayuda-sugerencias-vacio">
                  No encontramos sugerencias para esta búsqueda.
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ACCESOS RÁPIDOS */}
      <div className="ayuda-accesos">
        {[
          ['Mis productos', 'Productos'],
          ['Mi tienda', 'Tiendas'],
          ['Cómo comprar', 'Compras'],
          ['Mi cuenta', 'Mi cuenta'],
        ].map(([nombre, destino]) => (
          <button
            key={nombre}
            type="button"
            onClick={() => {
              cambiarCategoria(destino)
              document.getElementById('preguntas')?.scrollIntoView({
                behavior: 'smooth',
              })
            }}
          >
            {nombre}
          </button>
        ))}
      </div>

      {/* TARJETAS */}
      <section className="ayuda-seccion">
        <h2>¿Qué quieres aprender hoy? ✨</h2>

        <div className="ayuda-tarjetas">
          <button
            type="button"
            className="ayuda-tarjeta emprendedora"
            onClick={() => {
              setGuiaActiva('emprendedora')
              document.getElementById('guias')?.scrollIntoView({
                behavior: 'smooth',
              })
            }}
          >
            <span className="ayuda-icono">🏪</span>
            <h3>Soy emprendedora</h3>
            <p>Aprende a gestionar tu tienda y productos.</p>
            <span className="ayuda-enlace">
              Ver guía completa →
            </span>
          </button>

          <button
            type="button"
            className="ayuda-tarjeta comprador"
            onClick={() => {
              setGuiaActiva('comprador')
              document.getElementById('guias')?.scrollIntoView({
                behavior: 'smooth',
              })
            }}
          >
            <span className="ayuda-icono">🛍️</span>
            <h3>Soy comprador</h3>
            <p>Descubre productos y emprendimientos.</p>
            <span className="ayuda-enlace">
              Ver guía completa →
            </span>
          </button>
        </div>
      </section>

      {/* TUTORIALES */}
      <section className="ayuda-seccion">
        <h2>Aprende a tu ritmo 🌟</h2>
        <p>Descubre BORA en tres sencillos pasos.</p>

        <div className="ayuda-pasos">
          <article>
            <span className="ayuda-paso-icono">🔎</span>
            <span className="ayuda-paso-numero">PASO 01</span>
            <h3>Explora</h3>
            <p>Encuentra productos y emprendimientos.</p>
          </article>

          <article>
            <span className="ayuda-paso-icono">🤝</span>
            <span className="ayuda-paso-numero">PASO 02</span>
            <h3>Conecta</h3>
            <p>Conoce las tiendas de nuestra comunidad.</p>
          </article>

          <article>
            <span className="ayuda-paso-icono">🌱</span>
            <span className="ayuda-paso-numero">PASO 03</span>
            <h3>Crece</h3>
            <p>Da visibilidad a tus ideas y productos.</p>
          </article>
        </div>
      </section>

      {/* GUÍAS */}
      <section className="ayuda-seccion" id="guias">
        <h2>Guías paso a paso 📖</h2>
        <p>Selecciona una guía para comenzar.</p>

        <div className="ayuda-selector-guias">
          <button
            type="button"
            className={
              guiaActiva === 'emprendedora' ? 'activo' : ''
            }
            onClick={() => setGuiaActiva('emprendedora')}
          >
            Para emprendedoras
          </button>

          <button
            type="button"
            className={
              guiaActiva === 'comprador' ? 'activo' : ''
            }
            onClick={() => setGuiaActiva('comprador')}
          >
            Para compradores
          </button>
        </div>

        {guiaActiva === 'emprendedora' && (
          <div className="ayuda-guia-contenido">
            <h3>Tu camino como emprendedora</h3>
            <ol>
              <li>Consulta cómo incorporarte a BORA.</li>
              <li>Accede a tu cuenta de emprendedora.</li>
              <li>Completa la información de tu tienda.</li>
              <li>Agrega fotografías y datos de tus productos.</li>
              <li>Mantén tus publicaciones actualizadas.</li>
            </ol>
          </div>
        )}

        {guiaActiva === 'comprador' && (
          <div className="ayuda-guia-contenido">
            <h3>Descubre productos en BORA</h3>
            <ol>
              <li>Ingresa al catálogo público.</li>
              <li>Explora productos y categorías.</li>
              <li>Encuentra tiendas de tu interés.</li>
              <li>Consulta la información de los productos.</li>
              <li>Utiliza las opciones de contacto disponibles.</li>
            </ol>
          </div>
        )}

        {!guiaActiva && (
          <p className="ayuda-guia-vacia">
            Elige una de las guías para ver sus instrucciones.
          </p>
        )}
      </section>

      {/* PREGUNTAS FRECUENTES */}
      <section className="ayuda-seccion" id="preguntas">
        <h2>Preguntas frecuentes</h2>
        <p>Encuentra respuestas rápidas a tus dudas.</p>

        <div className="ayuda-categorias">
          {categorias.map((item) => (
            <button
              key={item}
              type="button"
              className={categoria === item ? 'activo' : ''}
              onClick={() => cambiarCategoria(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="ayuda-preguntas">
          {preguntasFiltradas.length > 0 ? (
            preguntasFiltradas.map((item) => (
              <details
                key={item.pregunta}
                ref={(elemento) => {
                  if (elemento) {
                    preguntasRef.current[item.pregunta] = elemento
                  } else {
                    delete preguntasRef.current[item.pregunta]
                  }
                }}
                onToggle={(evento) => {
                  if (
                    !evento.currentTarget.open &&
                    preguntaAbierta === item.pregunta
                  ) {
                    setPreguntaAbierta(null)
                  }
                }}
              >
                <summary>
                  <span>{item.pregunta}</span>
                  <span
                    className="ayuda-mas"
                    aria-hidden="true"
                  />
                </summary>
                <p>{item.respuesta}</p>
              </details>
            ))
          ) : (
            <div className="ayuda-sin-resultados">
              <h3>No encontramos resultados</h3>
              <p>
                Prueba otra palabra o selecciona otra categoría.
              </p>
              <button
                type="button"
                onClick={() => cambiarCategoria('Todas')}
              >
                Ver todas las preguntas
              </button>
            </div>
          )}
        </div>
      </section>

      {/* SOPORTE */}
      <section className="ayuda-soporte">
        <span className="ayuda-soporte-icono">💬</span>
        <div>
          <h2>¿No encontraste lo que buscabas?</h2>
          <p>
            ¡Queremos ayudarte! Pronto podrás comunicarte
            con el equipo de BORA mediante nuestro canal
            oficial de soporte.
          </p>
          <span className="ayuda-soporte-pendiente">
            Canal de soporte próximamente
          </span>
        </div>
      </section>
    </main>
  )
}
