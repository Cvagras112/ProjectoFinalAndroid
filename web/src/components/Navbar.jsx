
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase/config'
import './Navbar.css'

const enlaces = [
  { nombre: 'Inicio', ruta: '/', icono: '⌂' },
  { nombre: 'Explorar productos', ruta: '/productos', icono: '▦' },
  { nombre: 'Emprendimientos', ruta: '/tiendas', icono: '♧' },
  { nombre: 'Centro de ayuda', ruta: '/ayuda', icono: '?' },
]

function obtenerRol(datos) {
  return String(datos?.rol || datos?.Rol || '')
    .trim()
    .toLowerCase()
}

function obtenerPanel(rol) {
  if (rol === 'administrador') return '/admin'

  if (rol === 'emprendedora' || rol === 'emprendedor') {
    return '/panel-emprendedora'
  }

  return null
}

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const menuRef = useRef(null)

  const [usuario, setUsuario] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [menuAbierto, setMenuAbierto] = useState(false)

  useEffect(() => {
    let solicitud = 0

    const cancelar = onAuthStateChanged(auth, async (usuarioFirebase) => {
      const actual = ++solicitud

      setUsuario(usuarioFirebase)
      setPerfil(null)
      setCargando(Boolean(usuarioFirebase))

      if (!usuarioFirebase) {
        setCargando(false)
        return
      }

      try {
        const referencia = doc(db, 'usuarios', usuarioFirebase.uid)
        const resultado = await getDoc(referencia)

        if (actual !== solicitud) return

        if (resultado.exists()) {
          setPerfil(resultado.data())
        }
      } catch (error) {
        console.error('Error al consultar perfil:', error)
      } finally {
        if (actual === solicitud) setCargando(false)
      }
    })

    return () => {
      solicitud++
      cancelar()
    }
  }, [])

  useEffect(() => {
    setMenuAbierto(false)
  }, [location.pathname])

  useEffect(() => {
    if (!menuAbierto) return

    const cerrarFuera = (evento) => {
      if (!menuRef.current?.contains(evento.target)) {
        setMenuAbierto(false)
      }
    }

    const cerrarEscape = (evento) => {
      if (evento.key === 'Escape') setMenuAbierto(false)
    }

    document.addEventListener('pointerdown', cerrarFuera)
    document.addEventListener('keydown', cerrarEscape)

    return () => {
      document.removeEventListener('pointerdown', cerrarFuera)
      document.removeEventListener('keydown', cerrarEscape)
    }
  }, [menuAbierto])

  const rol = obtenerRol(perfil)

  const nombre =
    perfil?.nombre ||
    usuario?.displayName ||
    usuario?.email?.split('@')[0] ||
    'Mi cuenta'

  const inicial = nombre.charAt(0).toUpperCase()

  const panel = perfil?.activo === false ? null : obtenerPanel(rol)

  const nombreRol = {
    administrador: 'Administrador',
    emprendedora: 'Emprendedora',
    emprendedor: 'Emprendedor',
    comprador: 'Comprador',
  }[rol] || 'Usuario'

  const cerrarSesion = async () => {
    try {
      setMenuAbierto(false)
      await signOut(auth)
      navigate('/', { replace: true })
    } catch (error) {
      console.error('Error al cerrar sesión:', error)
      alert('No fue posible cerrar la sesión. Inténtalo nuevamente.')
    }
  }

  return (
    <header className="navbar">
      <div className="navbar-container">

        <Link to="/" className="navbar-logo" aria-label="BORA - Inicio">
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
        </Link>

        <nav className="navbar-links" aria-label="Navegación principal">
          {enlaces.map((enlace) => {
            const activo = location.pathname === enlace.ruta

            return (
              <Link
                key={enlace.ruta}
                to={enlace.ruta}
                className={activo ? 'navbar-link-active' : ''}
                aria-current={activo ? 'page' : undefined}
              >
                <span className="navbar-link-icon" aria-hidden="true">
                  {enlace.icono}
                </span>
                {enlace.nombre}
              </Link>
            )
          })}
        </nav>

        <div className="navbar-actions">
          {cargando ? (
            <span className="navbar-auth-loading">Cargando...</span>
          ) : !usuario ? (
            <Link to="/login" className="navbar-login">
              <span aria-hidden="true">↪</span>
              Iniciar sesión
            </Link>
          ) : (
            <div className="navbar-user" ref={menuRef}>
              <button
                type="button"
                className="navbar-user-trigger"
                onClick={() => setMenuAbierto(!menuAbierto)}
                aria-expanded={menuAbierto}
                aria-haspopup="true"
                aria-controls="navbar-user-menu"
              >
                <span className="navbar-user-avatar">
                  {usuario.photoURL ? (
                    <img src={usuario.photoURL} alt="" />
                  ) : (
                    inicial
                  )}
                </span>

                <span className="navbar-user-info">
                  <strong>{nombre}</strong>
                  <small>{nombreRol}</small>
                </span>

                <span aria-hidden="true">
                  {menuAbierto ? '⌃' : '⌄'}
                </span>
              </button>

              {menuAbierto && (
                <div
                  id="navbar-user-menu"
                  className="navbar-user-dropdown"
                >
                  <div className="navbar-user-header">
                    <strong>{nombre}</strong>
                    <small>{usuario.email}</small>
                    <span>{nombreRol}</span>
                  </div>

                  <Link to="/perfil" className="navbar-user-option">
                    <span aria-hidden="true">♙</span>
                    Mi perfil
                  </Link>

                  {rol === 'comprador' && (
                  <Link
                    to="/mis-favoritos"
                    className="navbar-user-option"
                  >
                    <span aria-hidden="true">♥</span>
                    Mis favoritos
                  </Link>
                )}

                  {panel && (
                    <Link to={panel} className="navbar-user-option">
                      <span aria-hidden="true">▦</span>
                      {rol === 'administrador'
                        ? 'Panel de administración'
                        : 'Administrar mi tienda'}
                    </Link>
                  )}

                  <button
                    type="button"
                    className="navbar-user-option navbar-user-logout"
                    onClick={cerrarSesion}
                  >
                    <span aria-hidden="true">↪</span>
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </header>
  )
}
