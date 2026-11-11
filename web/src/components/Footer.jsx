
import './Footer.css'

export default function Footer() {
  return (
    <footer className="bora-footer">
      <div className="bora-footer-wave" aria-hidden="true">
        <svg
          viewBox="0 0 1440 90"
          preserveAspectRatio="none"
        >
          <path
            d="M0,35 C240,95 440,0 720,38 C1000,80 1200,5 1440,35 L1440,90 L0,90 Z"
            fill="#06452f"
          />
        </svg>
      </div>

      <div className="bora-footer-main">
        <div className="bora-footer-brand">
          <img
            src="/imagenes/Logo_BORA.png"
            alt="BORA - Bazar de Ofertas y Red de Artesanos"
            className="bora-footer-logo"
          />

          <p>
            Un espacio donde las ideas, el talento y los
            emprendimientos se conectan para crecer juntos.
          </p>

          <span className="bora-footer-slogan">
            Emprendimientos que conectan.
          </span>
        </div>

        <div className="bora-footer-column">
          <h3>Explorar</h3>
          <a href="/">Inicio</a>
          <a href="/productos">Productos</a>
          <a href="/tiendas">Emprendimientos</a>
        </div>

        <div className="bora-footer-column">
          <h3>Comunidad</h3>
          <a href="/tiendas">Conoce emprendedoras</a>
          <a href="/login">Iniciar sesión</a>
          <a href="/ayuda">Cómo funciona BORA</a>
        </div>

        <div className="bora-footer-column">
          <h3>¿Necesitas ayuda?</h3>
          <p>
            Encuentra respuestas y aprende a utilizar
            nuestra plataforma.
          </p>
          <a href="/ayuda" className="bora-footer-help">
            Ir al Centro de ayuda →
          </a>
        </div>
      </div>

      <div className="bora-footer-bottom">
        <span>
          © {new Date().getFullYear()} BORA.
          Todos los derechos reservados.
        </span>

        <span>
          Bazar de Ofertas y Red de Artesanos
        </span>
      </div>
    </footer>
  )
}
