
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../../firebase/config'

function RutaAdmin({ children }) {
  const [estado, setEstado] = useState('cargando')

  useEffect(() => {
    let solicitud = 0

    const cancelar = onAuthStateChanged(auth, async (usuario) => {
      const actual = ++solicitud

      if (!usuario) {
        setEstado('sin-sesion')
        return
      }

      setEstado('cargando')

      try {
        const referencia = doc(db, 'usuarios', usuario.uid)
        const resultado = await getDoc(referencia)

        if (actual !== solicitud) return

        if (!resultado.exists()) {
          setEstado('sin-permiso')
          return
        }

        const datos = resultado.data()

        const rol = String(datos.rol || datos.Rol || '')
          .trim()
          .toLowerCase()

        if (rol === 'administrador' && datos.activo === true) {
          setEstado('autorizado')
        } else {
          setEstado('sin-permiso')
        }
      } catch (error) {
        if (actual !== solicitud) return

        console.error('Error al verificar permisos:', error)
        setEstado('error')
      }
    })

    return () => {
      solicitud++
      cancelar()
    }
  }, [])

  if (estado === 'cargando') {
    return (
      <main style={{ padding: 60, textAlign: 'center' }}>
        <p>Verificando permisos de administrador...</p>
      </main>
    )
  }

  if (estado === 'sin-sesion') {
    return (
      <main style={{ padding: 60, textAlign: 'center' }}>
        <h1>Inicia sesión</h1>
        <p>Debes iniciar sesión para acceder al panel administrativo.</p>
        <Link to="/login">Ir a iniciar sesión</Link>
      </main>
    )
  }

  if (estado === 'sin-permiso') {
    return (
      <main style={{ padding: 60, textAlign: 'center' }}>
        <h1>Acceso restringido</h1>
        <p>No tienes permisos para acceder al panel administrativo de BORA.</p>
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

export default RutaAdmin
