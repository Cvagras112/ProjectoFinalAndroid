
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { observarAcceso } from '../../services/auth/observarAcceso'

function RutaEmprendedor({ children }) {
  const [estado, setEstado] = useState('cargando')

  useEffect(() => observarAcceso(setEstado, { emprendedor: true }), [])

  if (estado === 'cargando') {
    return (
      <main style={{ padding: 60, textAlign: 'center' }}>
        <p>Verificando permisos de emprendedor/a...</p>
      </main>
    )
  }

  if (estado === 'sin-sesion') {
    return (
      <main style={{ padding: 60, textAlign: 'center' }}>
        <h1>Inicia sesión</h1>
        <p>Debes iniciar sesión para administrar tu emprendimiento.</p>
        <Link to="/login">Ir a iniciar sesión</Link>
      </main>
    )
  }

  if (estado === 'sin-permiso') {
    return (
      <main style={{ padding: 60, textAlign: 'center' }}>
        <h1>Acceso restringido</h1>
        <p>
          Necesitas tener un perfil de emprendedor/a activo
          para acceder a este panel.
        </p>
        <Link to="/">Volver al inicio</Link>
      </main>
    )
  }

  if (estado === 'error') {
    return (
      <main style={{ padding: 60, textAlign: 'center' }}>
        <h1>No pudimos verificar tu acceso</h1>
        <p>Intenta nuevamente más tarde.</p>
        <Link to="/">Volver al inicio</Link>
      </main>
    )
  }

  return children
}

export default RutaEmprendedor
