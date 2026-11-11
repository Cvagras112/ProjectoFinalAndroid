
import { useEffect, useRef, useState } from 'react'
import Footer from '../../components/Footer'
import ProductosDestacados from '../../components/ProductosDestacados'
import './Home.css'

// ==========================================
// PORTADA - CARRUSEL PRINCIPAL
// ==========================================

const slides = [
  {
    etiqueta: 'Emprendimientos que conectan',
    titulo: 'Descubre productos únicos,',
    destacado: 'apoya el talento local.',
    descripcion:
      'Un espacio para descubrir productos hechos con dedicación, conocer emprendimientos de nuestra comunidad y conectar con sus historias.',
    imagen:
      'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?w=1500&auto=format&fit=crop&q=85',
  },
  {
    etiqueta: 'Creaciones con identidad',
    titulo: 'Encuentra algo especial,',
    destacado: 'hecho con dedicación.',
    descripcion:
      'Explora artesanía, decoración, accesorios y productos creados por personas que aman lo que hacen.',
    imagen:
      'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=1500&auto=format&fit=crop&q=85',
  },
  {
    etiqueta: 'Nuestra comunidad',
    titulo: 'Conoce nuevas historias,',
    destacado: 'conecta con emprendedoras.',
    descripcion:
      'Cada emprendimiento tiene una historia que contar. Descubre el talento que existe detrás de cada creación.',
    imagen:
      'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1500&auto=format&fit=crop&q=85',
  },
]

// ==========================================
// CATEGORÍAS
// ==========================================

const categorias = [
  {
    nombre: 'Artesanía',
    icono: '🧺',
    imagen:
      'https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?w=700&auto=format&fit=crop&q=85',
    color: 'artesania',
  },
  {
    nombre: 'Gastronomía',
    icono: '🥐',
    imagen:
      'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=700&auto=format&fit=crop&q=85',
    color: 'gastronomia',
  },
  {
    nombre: 'Belleza y cuidado',
    icono: '🌿',
    imagen:
      'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=700&auto=format&fit=crop&q=85',
    color: 'belleza',
  },
  {
    nombre: 'Textil y tejidos',
    icono: '🧶',
    imagen:
      'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=700&auto=format&fit=crop&q=85',
    color: 'textil',
  },
  {
    nombre: 'Hogar y decoración',
    icono: '🪴',
    imagen:
      'https://images.unsplash.com/photo-1490312278390-ab64016e0aa9?w=700&auto=format&fit=crop&q=85',
    color: 'hogar',
  },
  {
    nombre: 'Productos locales',
    icono: '🍯',
    imagen:
      'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=700&auto=format&fit=crop&q=85',
    color: 'locales',
  },
]

// ==========================================
// PREGUNTAS FRECUENTES
// ==========================================

const preguntas = [
  {
    pregunta: '¿Qué es BORA?',
    respuesta:
      'BORA significa Bazar de Ofertas y Red de Artesanos. Es una plataforma orientada a dar visibilidad a emprendimientos y facilitar que las personas descubran sus productos.',
  },
  {
    pregunta: '¿Cómo puedo explorar productos?',
    respuesta:
      'Puedes utilizar el buscador, seleccionar una categoría o entrar a Explorar productos desde el menú principal.',
  },
  {
    pregunta: '¿Cómo puedo conocer emprendimientos?',
    respuesta:
      'En la sección Emprendimientos podrás descubrir negocios, conocer sus propuestas y explorar sus productos cuando sus perfiles estén disponibles.',
  },
  {
    pregunta: '¿Dónde puedo obtener ayuda?',
    respuesta:
      'Visita nuestro Centro de ayuda para consultar preguntas frecuentes y guías sobre el uso de la plataforma.',
  },
]

// ==========================================
// ANIMACIONES AL DESPLAZARSE
// ==========================================

function useReveal() {
  useEffect(() => {
    const elementos = document.querySelectorAll('.bora-reveal')

    if (
      !('IntersectionObserver' in window) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      elementos.forEach((elemento) =>
        elemento.classList.add('bora-visible')
      )
      return
    }

    const observer = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((entrada) => {
          if (entrada.isIntersecting) {
            entrada.target.classList.add('bora-visible')
            observer.unobserve(entrada.target)
          }
        })
      },
      {
        threshold: 0.08,
        rootMargin: '0px 0px 30px 0px',
      }
    )

    elementos.forEach((elemento) => observer.observe(elemento))

    return () => observer.disconnect()
  }, [])
}

// ==========================================
// PÁGINA DE INICIO
// ==========================================

export default function Home() {
  const [slideActual, setSlideActual] = useState(0)
  const [preguntaAbierta, setPreguntaAbierta] = useState(null)
  const [mostrarArriba, setMostrarArriba] = useState(false)

  const categoriasRef = useRef(null)

  useReveal()

  // Cambio automático de portada
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    const intervalo = window.setInterval(() => {
      setSlideActual((actual) => (actual + 1) % slides.length)
    }, 5500)

    return () => window.clearInterval(intervalo)
  }, [])

  // Mostrar botón para volver arriba
  useEffect(() => {
    const revisarScroll = () => {
      setMostrarArriba(window.scrollY > 550)
    }

    window.addEventListener('scroll', revisarScroll, {
      passive: true,
    })

    revisarScroll()

    return () =>
      window.removeEventListener('scroll', revisarScroll)
  }, [])

  function cambiarSlide(direccion) {
    setSlideActual(
      (actual) =>
        (actual + direccion + slides.length) % slides.length
    )
  }

  function moverCategorias(direccion) {
    categoriasRef.current?.scrollBy({
      left: direccion * 330,
      behavior: 'smooth',
    })
  }

  return (
    <main className="bora-home bora-home-v2">

      {/* ==================================
          PORTADA ORGÁNICA
      ================================== */}

      <section
        className="bora-portada"
        aria-label="Bienvenida a BORA"
      >
        <div className="bora-portada-contenido">

          <div className="bora-portada-texto">
            <span className="bora-portada-etiqueta">
              🌿 {slides[slideActual].etiqueta}
            </span>

            <h1 key={`titulo-${slideActual}`}>
              {slides[slideActual].titulo}
              <span> {slides[slideActual].destacado}</span>
            </h1>

            <p key={`descripcion-${slideActual}`}>
              {slides[slideActual].descripcion}
            </p>

            <div className="bora-portada-acciones">
              <a href="/tiendas" className="bora-boton-verde">
                🏪 Conocer emprendimientos
                <span>→</span>
              </a>

              <a href="/productos" className="bora-boton-borde">
                🛍️ Explorar productos
              </a>
            </div>
          </div>

          <div className="bora-portada-imagen">
            {slides.map((slide, indice) => (
              <img
                key={slide.imagen}
                src={slide.imagen}
                alt={
                  slideActual === indice
                    ? 'Espacio de productos y emprendimientos'
                    : ''
                }
                className={`bora-portada-foto ${slideActual === indice ? 'activa' : ''
                  }`}
                aria-hidden={slideActual !== indice}
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          className="bora-portada-flecha bora-flecha-izquierda"
          aria-label="Ver portada anterior"
          onClick={() => cambiarSlide(-1)}
        >
          ‹
        </button>

        <button
          type="button"
          className="bora-portada-flecha bora-flecha-derecha"
          aria-label="Ver portada siguiente"
          onClick={() => cambiarSlide(1)}
        >
          ›
        </button>

        <div
          className="bora-portada-indicadores"
          aria-label="Seleccionar portada"
        >
          {slides.map((slide, indice) => (
            <button
              type="button"
              key={slide.etiqueta}
              className={slideActual === indice ? 'activo' : ''}
              aria-label={`Ver portada ${indice + 1}`}
              aria-current={
                slideActual === indice ? 'true' : undefined
              }
              onClick={() => setSlideActual(indice)}
            />
          ))}
        </div>
      </section>

      {/* ==================================
          BENEFICIOS
      ================================== */}

      <section className="bora-beneficios bora-reveal">
        <div className="bora-beneficio">
          <span className="bora-beneficio-icono">🚚</span>
          <div>
            <strong>Apoya lo local</strong>
            <p>
              Descubre emprendimientos de nuestra comunidad.
            </p>
          </div>
        </div>

        <div className="bora-beneficio">
          <span className="bora-beneficio-icono">♡</span>
          <div>
            <strong>Conoce cada historia</strong>
            <p>
              Personas y proyectos detrás de cada creación.
            </p>
          </div>
        </div>

        <div className="bora-beneficio">
          <span className="bora-beneficio-icono">🌿</span>
          <div>
            <strong>Productos únicos</strong>
            <p>
              Artesanía, decoración, tejidos y mucho más.
            </p>
          </div>
        </div>

        <div className="bora-beneficio">
          <span className="bora-beneficio-icono">🤝</span>
          <div>
            <strong>Comunidad BORA</strong>
            <p>
              Un espacio para conectar y emprender.
            </p>
          </div>
        </div>
      </section>

      {/* ==================================
          CATEGORÍAS
      ================================== */}

      <section className="bora-seccion bora-reveal">
        <div className="bora-titulo-fila">
          <div>
            <span className="bora-subtitulo">
              ENCUENTRA LO QUE TE INSPIRA
            </span>

            <h2>Explora por categorías</h2>

            <p>
              Un mundo de creaciones por descubrir.
            </p>
          </div>

          <div className="bora-controles-seccion">
            <button
              type="button"
              aria-label="Categorías anteriores"
              onClick={() => moverCategorias(-1)}
            >
              ←
            </button>

            <button
              type="button"
              aria-label="Categorías siguientes"
              onClick={() => moverCategorias(1)}
            >
              →
            </button>
          </div>
        </div>

        <div
          className="bora-categorias-carrusel"
          ref={categoriasRef}
        >
          {categorias.map((categoria) => (
            <a
              href={`/productos?categoria=${encodeURIComponent(
                categoria.nombre
              )}`}
              className={`bora-categoria bora-categoria-${categoria.color}`}
              key={categoria.nombre}
            >
              <img
                src={categoria.imagen}
                alt=""
                loading="lazy"
              />

              <span className="bora-categoria-capa" />

              <div className="bora-categoria-contenido">
                <span>{categoria.icono}</span>
                <h3>{categoria.nombre}</h3>
                <small>Explorar →</small>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* ==================================
          COMUNIDAD Y EVENTOS
      ================================== */}

      <section className="bora-comunidad-eventos bora-reveal">
        <article className="bora-comunidad-panel">
          <div className="bora-comunidad-texto">
            <span className="bora-panel-icono">♧</span>

            <h2>Conoce a nuestras emprendedoras</h2>

            <p>
              Historias reales, talento local y productos
              con identidad.
            </p>

            <a href="/tiendas">
              Ver emprendimientos →
            </a>
          </div>

          <div className="bora-comunidad-fotos">
            <img
              src="https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?w=400&auto=format&fit=crop&q=85"
              alt="Creación artesanal"
              loading="lazy"
            />

            <img
              src="https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400&auto=format&fit=crop&q=85"
              alt="Productos artesanales"
              loading="lazy"
            />

            <img
              src="https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400&auto=format&fit=crop&q=85"
              alt="Accesorios artesanales"
              loading="lazy"
            />
          </div>
        </article>

        <article className="bora-eventos-panel">
          <div className="bora-eventos-icono">🗓️</div>

          <div>
            <span className="bora-panel-etiqueta">
              NUESTRA COMUNIDAD
            </span>

            <h2>Próximos eventos</h2>

            <p>
              Ferias, talleres y actividades de nuestra
              red de emprendedores.
            </p>

            <span className="bora-eventos-estado">
              Calendario próximamente
            </span>
          </div>


          <div className="bora-eventos-calendario" aria-hidden="true">
            <div className="bora-calendario-superior">
              <span />
              <span />
            </div>

            <div className="bora-calendario-cuerpo">
              <span className="bora-calendario-mes">PRÓXIMAMENTE</span>
              <span className="bora-calendario-icono">✦</span>
              <span className="bora-calendario-texto">Ferias y talleres</span>
            </div>
          </div>

        </article>
      </section>

      {/* ==================================
          NUEVOS PRODUCTOS DESTACADOS
      ================================== */}

      <ProductosDestacados />

      {/* ==================================
          CÓMO FUNCIONA BORA
      ================================== */}

      <section className="bora-guia bora-reveal">
        <div className="bora-guia-encabezado">
          <span className="bora-subtitulo">
            TU EXPERIENCIA EN BORA
          </span>

          <h2>Descubrir es muy sencillo</h2>

          <p>
            Conoce cómo puedes comenzar a explorar
            nuestra plataforma.
          </p>
        </div>

        <div className="bora-guia-pasos">
          <article>
            <span className="bora-paso-numero">01</span>
            <span className="bora-paso-icono">🔎</span>

            <h3>Busca y explora</h3>

            <p>
              Descubre productos utilizando categorías
              y herramientas de búsqueda.
            </p>
          </article>

          <article>
            <span className="bora-paso-numero">02</span>
            <span className="bora-paso-icono">♡</span>

            <h3>Encuentra favoritos</h3>

            <p>
              Conoce las creaciones que más te gustan
              y guarda tus preferidas.
            </p>
          </article>

          <article>
            <span className="bora-paso-numero">03</span>
            <span className="bora-paso-icono">🤝</span>

            <h3>Conoce emprendimientos</h3>

            <p>
              Descubre quién está detrás de cada
              producto y su historia.
            </p>
          </article>
        </div>
      </section>

      {/* ==================================
          INVITACIÓN A EMPRENDEDORAS
      ================================== */}

      <section className="bora-invitacion bora-reveal">
        <div>
          <span>
            UNA COMUNIDAD QUE CRECE
          </span>

          <h2>
            Tu emprendimiento también puede ser parte de BORA
          </h2>

          <p>
            Queremos que más personas conozcan tu talento,
            tus creaciones y la historia de tu negocio.
          </p>

          <div className="bora-invitacion-botones">
            <a href="/quiero-emprender" className="bora-boton-claro">
              Quiero ser emprendedor/a →
            </a>

            <a href="/ayuda" className="bora-boton-transparente">
              Conocer más
            </a>
          </div>
        </div>

        <div
          className="bora-invitacion-decoracion"
          aria-hidden="true"
        >
          <span>🌿</span>
          <strong>
            Emprendimientos que conectan
          </strong>
        </div>
      </section>

      {/* ==================================
          PREGUNTAS FRECUENTES
      ================================== */}

      <section className="bora-seccion bora-faq bora-reveal">
        <div className="bora-guia-encabezado">
          <span className="bora-subtitulo">
            TE AYUDAMOS A COMENZAR
          </span>

          <h2>Preguntas frecuentes</h2>

          <p>
            Resolvemos algunas dudas sobre nuestra plataforma.
          </p>
        </div>

        <div className="bora-faq-lista">
          {preguntas.map((item, indice) => (
            <div
              className={`bora-faq-item ${preguntaAbierta === indice ? 'abierto' : ''
                }`}
              key={item.pregunta}
            >
              <button
                type="button"
                aria-expanded={preguntaAbierta === indice}
                onClick={() =>
                  setPreguntaAbierta(
                    preguntaAbierta === indice ? null : indice
                  )
                }
              >
                <span>{item.pregunta}</span>

                <span aria-hidden="true">
                  {preguntaAbierta === indice ? '−' : '+'}
                </span>
              </button>

              {preguntaAbierta === indice && (
                <p>{item.respuesta}</p>
              )}
            </div>
          ))}
        </div>

        <div className="bora-centrar">
          <a href="/ayuda" className="bora-boton-verde">
            Visitar Centro de ayuda →
          </a>
        </div>
      </section>

      {/* ==================================
          PIE DE PÁGINA
      ================================== */}

      <Footer />

      {/* ==================================
          VOLVER ARRIBA
      ================================== */}

      {mostrarArriba && (
        <button
          type="button"
          className="bora-volver-arriba"
          aria-label="Volver al inicio de la página"
          onClick={() =>
            window.scrollTo({
              top: 0,
              behavior: 'smooth',
            })
          }
        >
          ↑
        </button>
      )}
    </main>
  )
}
