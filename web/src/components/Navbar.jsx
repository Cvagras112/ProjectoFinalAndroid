
import './Navbar.css'

export default function Navbar() {
  return (
    <header className="navbar">
      <div className="navbar-container">
        <a href="/" className="navbar-logo">
          <span className="navbar-logo-icon">✦</span>
          BORA
        </a>

        <nav className="navbar-links" aria-label="Navegación principal">
          <a href="/">Inicio</a>
          <a href="/productos">Explorar productos</a>
          <a href="/tiendas">Emprendimientos</a>
          <a href="/ayuda">Centro de ayuda</a>
        </nav>

        <div className="navbar-actions">
          <a href="/login" className="navbar-login">
            Iniciar sesión
          </a>
        </div>
      </div>
    </header>
  )
}
