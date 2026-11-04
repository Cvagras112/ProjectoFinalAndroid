
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../../firebase/config'

function RutaEmprendedor({ children }) {
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
        const usuarioRef = doc(db, 'usuarios', usuario.uid)
        const emprendedorRef = doc(
          db,
          'emprendedores',
          usuario.uid
        )

        const [usuarioDoc, emprendedorDoc] = await Promise.all([
          getDoc(usuarioRef),
          getDoc(emprendedorRef),
        ])

        if (actual !== solicitud) return

        if (!usuarioDoc.exists() || !emprendedorDoc.exists()) {
          setEstado('sin-permiso')
          return
        }

        const datosUsuario = usuarioDoc.data()
        const datosEmprendedor = emprendedorDoc.data()

        const rol = String(
          datosUsuario.rol || datosUsuario.Rol || ''
        ).trim().toLowerCase()

        if (
          rol === 'emprendedor' &&
          datosUsuario.activo === true &&
          datosEmprendedor.activo === true
        ) {
          setEstado('autorizado')
        } else {
          setEstado('sin-permiso')
        }
      } catch (error) {
        if (actual !== solicitud) return

        console.error(
          'Error al verificar permisos de emprendedor:',
          error
        )
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
