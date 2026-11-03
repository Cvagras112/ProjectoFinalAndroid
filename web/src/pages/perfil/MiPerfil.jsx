
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../../firebase/config'

import './MiPerfil.css'

const opciones = [
  {
    id: 'informacion',
    icono: '👤',
    titulo: 'Información de mi perfil',
    descripcion: 'Consulta tus datos personales y de contacto.'
  },
  {
    id: 'seguridad',
    icono: '🔒',
    titulo: 'Seguridad',
    descripcion: 'Protege tu cuenta y administra tu contraseña.'
  },
  {
    id: 'direcciones',
    icono: '📍',
    titulo: 'Direcciones',
    descripcion: 'Administra tus direcciones de contacto y entrega.'
  },
  {
    id: 'privacidad',
    icono: '🛡️',
    titulo: 'Privacidad',
    descripcion: 'Consulta las opciones de privacidad de tu cuenta.'
  },
  {
    id: 'comunicaciones',
    icono: '💬',
    titulo: 'Comunicaciones',
    descripcion: 'Configura tus preferencias de notificaciones.'
  }
]

function MiPerfil() {
  const [usuario, setUsuario] = useState(null)
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [seccion, setSeccion] = useState(null)

  useEffect(() => {
    let solicitud = 0

    const cancelar = onAuthStateChanged(auth, async (usuarioFirebase) => {
      const actual = ++solicitud

      setUsuario(usuarioFirebase)
      setDatos(null)
      setError('')

      if (!usuarioFirebase) {
        setCargando(false)
        return
      }

      setCargando(true)

      try {
        const referencia = doc(db, 'usuarios', usuarioFirebase.uid)
        const resultado = await getDoc(referencia)

        if (actual !== solicitud) return

        if (resultado.exists()) {
          setDatos(resultado.data())
        } else {
          setError('No encontramos tu perfil registrado en BORA.')
        }
      } catch (err) {
        if (actual !== solicitud) return

        console.error('Error al cargar perfil:', err)
        setError('No fue posible consultar tu perfil.')
      } finally {
        if (actual === solicitud) setCargando(false)
      }
    })

    return () => {
      solicitud++
      cancelar()
    }
  }, [])

  const nombre = datos?.nombre || usuario?.displayName || 'Usuario BORA'
  const correo = usuario?.email || datos?.email || 'No disponible'
  const rol = String(datos?.rol || datos?.Rol || 'Usuario')
  const rolNormalizado = rol.trim().toLowerCase()
  const inicial = nombre.charAt(0).toUpperCase()
  const activa = datos?.activo !== false

  const puedeVerColaboradores =
    activa &&
    ['administrador', 'emprendedora', 'emprendedor'].includes(rolNormalizado)

  const opcionesVisibles = [
    ...opciones.slice(0, 2),
    ...(puedeVerColaboradores
      ? [{
          id: 'colaboradores',
          icono: '👥',
          titulo: 'Colaboradores',
          descripcion: 'Gestiona personas y accesos de tu negocio.'
        }]
      : []),
    ...opciones.slice(2)
  ]

  const opcionSeleccionada = opcionesVisibles.find(
    (opcion) => opcion.id === seccion
  )

  if (cargando) {
    return <main style={{ padding: 60 }}>Cargando tu perfil...</main>
  }

  if (!usuario) {
    return (
      <main style={{ padding: 60 }}>
        <h1>Mi perfil</h1>
        <p>Debes iniciar sesión para ver tu perfil.</p>
        <Link to="/login">Iniciar sesión</Link>
      </main>
    )
  }

  return (
    <main className="bora-perfil">
      <section className="bora-perfil-card">

        <div className="bora-perfil-encabezado">
          <div className="bora-perfil-avatar">
            {usuario.photoURL ? (
              <img src={usuario.photoURL} alt="Foto de perfil" />
            ) : (
              inicial
            )}
          </div>

          <h1>{nombre}</h1>
          <p>{correo}</p>
          <span className="bora-perfil-rol">{rol}</span>
        </div>

        <div className="bora-perfil-contenido">
          {error && (
            <p className="bora-perfil-alerta" role="alert">
              {error}
            </p>
          )}

          {!seccion ? (
            <>
              <div className="bora-perfil-titulo-menu">
                <span>MI CUENTA</span>
                <h2>Gestiona tu perfil</h2>
                <p>
                  Consulta tu información y encuentra las opciones
                  para administrar tu cuenta en BORA.
                </p>
              </div>

              <div className="bora-perfil-menu">
                {opcionesVisibles.map((opcion) => (
                  <button
                    key={opcion.id}
                    type="button"
                    className="bora-perfil-menu-item"
                    onClick={() => setSeccion(opcion.id)}
                  >
                    <span className="bora-perfil-menu-icono">
                      {opcion.icono}
                    </span>

                    <span className="bora-perfil-menu-texto">
                      <strong>{opcion.titulo}</strong>
                      <small>{opcion.descripcion}</small>
                    </span>

                    <span className="bora-perfil-menu-flecha">
                      ›
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="bora-perfil-seccion">
              <button
                type="button"
                className="bora-perfil-regresar"
                onClick={() => setSeccion(null)}
              >
                ← Volver a mi cuenta
              </button>

              <div className="bora-perfil-seccion-titulo">
                <span>{opcionSeleccionada?.icono}</span>
                <h2>{opcionSeleccionada?.titulo}</h2>
                <p>{opcionSeleccionada?.descripcion}</p>
              </div>

              {seccion === 'informacion' ? (
                <div className="bora-perfil-datos">
                  <div>
                    <span>Nombre</span>
                    <strong>{nombre}</strong>
                  </div>

                  <div>
                    <span>Correo electrónico</span>
                    <strong>{correo}</strong>
                  </div>

                  <div>
                    <span>Rol en BORA</span>
                    <strong>{rol}</strong>
                  </div>

                  <div>
                    <span>Estado de la cuenta</span>
                    <strong>
                      {activa ? 'Activa' : 'Desactivada'}
                    </strong>
                  </div>
                </div>
              ) : (
                <div className="bora-perfil-proximamente">
                  <span>✦</span>
                  <h3>Estamos preparando esta sección</h3>
                  <p>
                    Próximamente podrás administrar esta información
                    desde tu cuenta de BORA.
                  </p>
                </div>
              )}
            </div>
          )}

          <Link to="/" className="bora-perfil-volver">
            ← Volver al inicio
          </Link>
        </div>

      </section>
    </main>
  )
}

export default MiPerfil
