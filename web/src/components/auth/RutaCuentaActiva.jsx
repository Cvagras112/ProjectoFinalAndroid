import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { observarAcceso } from '../../services/auth/observarAcceso'

export default function RutaCuentaActiva({ children, comprador = false }) {
  const [estado, setEstado] = useState('cargando')
  useEffect(() => observarAcceso(setEstado, { comprador }), [comprador])

  if (estado === 'autorizado') return children
  return (
    <main style={{ padding: 60, textAlign: 'center' }}>
      <h1>{estado === 'cargando' ? 'Verificando acceso...' :
        estado === 'sin-sesion' ? 'Inicia sesión' :
          estado === 'error' ? 'No pudimos verificar tu acceso' : 'Acceso restringido'}</h1>
      <p>{estado === 'sin-permiso' ? 'Necesitas una cuenta activa y autorizada para acceder a esta sección.' :
        estado === 'error' ? 'Inténtalo nuevamente más tarde.' : ''}</p>
      {estado !== 'cargando' && <Link to="/login">Ir a iniciar sesión</Link>}
    </main>
  )
}
