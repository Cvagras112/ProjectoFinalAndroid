
import './Navbar.css'

const enlaces = [
  { nombre: 'Inicio', ruta: '/', icono: '⌂' },
  { nombre: 'Explorar productos', ruta: '/productos', icono: '▦' },
  { nombre: 'Emprendimientos', ruta: '/tiendas', icono: '♧' },
  { nombre: 'Centro de ayuda', ruta: '/ayuda', icono: '?' },
]

export default function Navbar() {
  const rutaActual = window.location.pathname

  return (
    <header className="navbar">
      <div className="navbar-container">

        <a href="/" className="navbar-logo" aria-label="BORA - Inicio">
          <span className="navbar-logo-icon">
            <img
              src="/imagenes/Icono_BORA.png"
              alt=""
              className="navbar-icon-img"
            />
          </span>

          <span className="navbar-brand-text">
            <strong>BORA</strong>
            <small>Bazar de Ofertas y Red de Artesanos</small>
          </span>
        </a>

        <nav
          className="navbar-links"
          aria-label="Navegación principal"
        >
          {enlaces.map((enlace) => {
            const activo = rutaActual === enlace.ruta

            return (
              <a
                key={enlace.ruta}
                href={enlace.ruta}
                className={activo ? 'navbar-link-active' : ''}
                aria-current={activo ? 'page' : undefined}
              >
                <span className="navbar-link-icon" aria-hidden="true">
                  {enlace.icono}
                </span>
                {enlace.nombre}
              </a>
            )
          })}
        </nav>

        <div className="navbar-actions">
          <a href="/login" className="navbar-login">
            <span aria-hidden="true">↪</span>
            Iniciar sesión
          </a>
        </div>

      </div>
    </header>
  )
}
