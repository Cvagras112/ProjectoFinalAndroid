
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword
} from 'firebase/auth'
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

const formularioInicial = {
  actual: '',
  nueva: '',
  confirmar: ''
}

const visibilidadInicial = {
  actual: false,
  nueva: false,
  confirmar: false
}

function IconoOjo({ visible }) {
  return visible ? (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10.7 10.7 0 0 1 12 5c5 0 9 4 10 7a12 12 0 0 1-3.1 4.4" />
      <path d="M6.2 6.2C4.1 7.5 2.7 9.5 2 12c1 3 5 7 10 7 1.6 0 3.1-.4 4.4-1.1" />
      <path d="M10 10a3 3 0 0 0 4 4" />
    </svg>
  ) : (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function MiPerfil() {
  const [usuario, setUsuario] = useState(null)
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [seccion, setSeccion] = useState(null)

  const [contrasenas, setContrasenas] = useState(formularioInicial)
  const [contrasenasVisibles, setContrasenasVisibles] = useState(
    visibilidadInicial
  )
  const [guardandoContrasena, setGuardandoContrasena] = useState(false)
  const [errorSeguridad, setErrorSeguridad] = useState('')
  const [exitoSeguridad, setExitoSeguridad] = useState('')

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

  const usaContrasena = usuario?.providerData?.some(
    (proveedor) => proveedor.providerId === 'password'
  )

  const actualizarCampoContrasena = (campo, valor) => {
    setContrasenas((anterior) => ({
      ...anterior,
      [campo]: valor
    }))

    setErrorSeguridad('')
    setExitoSeguridad('')
  }

  const alternarVisibilidad = (campo) => {
    setContrasenasVisibles((anterior) => ({
      ...anterior,
      [campo]: !anterior[campo]
    }))
  }

  const limpiarFormulario = () => {
    setContrasenas({ ...formularioInicial })
    setContrasenasVisibles({ ...visibilidadInicial })
    setErrorSeguridad('')
    setExitoSeguridad('')
  }

  const abrirSeccion = (id) => {
    limpiarFormulario()
    setSeccion(id)
  }

  const regresarAlMenu = () => {
    if (guardandoContrasena) return

    limpiarFormulario()
    setSeccion(null)
  }

  const cambiarContrasena = async (evento) => {
    evento.preventDefault()

    if (guardandoContrasena) return

    setErrorSeguridad('')
    setExitoSeguridad('')

    const { actual, nueva, confirmar } = contrasenas

    if (!usuario || !usuario.email) {
      setErrorSeguridad(
        'No se pudo identificar tu cuenta. Inicia sesión nuevamente.'
      )
      return
    }

    if (!usaContrasena) {
      setErrorSeguridad(
        'Esta cuenta no utiliza contraseña de correo electrónico.'
      )
      return
    }

    if (!actual || !nueva || !confirmar) {
      setErrorSeguridad('Completa todos los campos.')
      return
    }

    if (nueva.length < 8) {
      setErrorSeguridad(
        'La nueva contraseña debe tener al menos 8 caracteres.'
      )
      return
    }

    if (nueva !== confirmar) {
      setErrorSeguridad(
        'La nueva contraseña y su confirmación no coinciden.'
      )
      return
    }

    if (actual === nueva) {
      setErrorSeguridad(
        'La nueva contraseña debe ser diferente de la actual.'
      )
      return
    }

    try {
      setGuardandoContrasena(true)

      const credencial = EmailAuthProvider.credential(
        usuario.email,
        actual
      )

      await reauthenticateWithCredential(usuario, credencial)
      await updatePassword(usuario, nueva)

      setContrasenas({ ...formularioInicial })
      setContrasenasVisibles({ ...visibilidadInicial })

      setExitoSeguridad(
        'Tu contraseña se actualizó correctamente. ' +
        'Utiliza la nueva contraseña en tu próximo inicio de sesión.'
      )
    } catch (err) {
      console.error('Error al actualizar contraseña:', err.code)

      switch (err.code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
          setErrorSeguridad(
            'La contraseña actual es incorrecta.'
          )
          break

        case 'auth/weak-password':
          setErrorSeguridad(
            'Firebase rechazó la contraseña por ser demasiado débil.'
          )
          break

        case 'auth/too-many-requests':
          setErrorSeguridad(
            'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.'
          )
          break

        case 'auth/requires-recent-login':
          setErrorSeguridad(
            'Por seguridad, cierra sesión y vuelve a ingresar antes de cambiar tu contraseña.'
          )
          break

        case 'auth/network-request-failed':
          setErrorSeguridad(
            'No se pudo conectar con Firebase. Revisa tu conexión.'
          )
          break

        default:
          setErrorSeguridad(
            'No fue posible actualizar la contraseña. Inténtalo nuevamente.'
          )
      }
    } finally {
      setGuardandoContrasena(false)
    }
  }

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

  const camposContrasena = [
    {
      id: 'actual',
      etiqueta: 'Contraseña actual',
      placeholder: 'Ingresa tu contraseña actual',
      autoComplete: 'current-password'
    },
    {
      id: 'nueva',
      etiqueta: 'Nueva contraseña',
      placeholder: 'Mínimo 8 caracteres',
      autoComplete: 'new-password'
    },
    {
      id: 'confirmar',
      etiqueta: 'Confirmar nueva contraseña',
      placeholder: 'Repite tu nueva contraseña',
      autoComplete: 'new-password'
    }
  ]

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
                    onClick={() => abrirSeccion(opcion.id)}
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
                onClick={regresarAlMenu}
                disabled={guardandoContrasena}
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
              ) : seccion === 'seguridad' ? (
                <div className="bora-perfil-seguridad">
                  <div className="bora-perfil-seguridad-intro">
                    <h3>🔑 Cambiar contraseña</h3>
                    <p>
                      Actualiza tu contraseña para mantener
                      protegida tu cuenta de BORA.
                    </p>
                  </div>

                  {!usaContrasena ? (
                    <div className="bora-perfil-seguridad-aviso">
                      Tu cuenta utiliza otro método de inicio de sesión.
                      No es posible cambiar la contraseña desde este formulario.
                    </div>
                  ) : (
                    <form
                      className="bora-perfil-seguridad-formulario"
                      onSubmit={cambiarContrasena}
                    >
                      {errorSeguridad && (
                        <div
                          className="bora-perfil-seguridad-error"
                          role="alert"
                        >
                          {errorSeguridad}
                        </div>
                      )}

                      {exitoSeguridad && (
                        <div
                          className="bora-perfil-seguridad-exito"
                          role="status"
                        >
                          {exitoSeguridad}
                        </div>
                      )}

                      {camposContrasena.map((campo) => (
                        <div
                          className="bora-perfil-seguridad-campo"
                          key={campo.id}
                        >
                          <label htmlFor={`contrasena-${campo.id}`}>
                            {campo.etiqueta}
                          </label>

                          <div className="bora-perfil-contrasena-control">
                            <input
                              id={`contrasena-${campo.id}`}
                              type={
                                contrasenasVisibles[campo.id]
                                  ? 'text'
                                  : 'password'
                              }
                              autoComplete={campo.autoComplete}
                              placeholder={campo.placeholder}
                              value={contrasenas[campo.id]}
                              onChange={(e) =>
                                actualizarCampoContrasena(
                                  campo.id,
                                  e.target.value
                                )
                              }
                              minLength={
                                campo.id === 'actual' ? undefined : 8
                              }
                              disabled={guardandoContrasena}
                              required
                            />

                            <button
                              type="button"
                              className="bora-perfil-contrasena-ojo"
                              onClick={() =>
                                alternarVisibilidad(campo.id)
                              }
                              disabled={guardandoContrasena}
                              aria-label={
                                contrasenasVisibles[campo.id]
                                  ? `Ocultar ${campo.etiqueta.toLowerCase()}`
                                  : `Mostrar ${campo.etiqueta.toLowerCase()}`
                              }
                              aria-pressed={
                                contrasenasVisibles[campo.id]
                              }
                              title={
                                contrasenasVisibles[campo.id]
                                  ? 'Ocultar contraseña'
                                  : 'Mostrar contraseña'
                              }
                            >
                              <IconoOjo
                                visible={contrasenasVisibles[campo.id]}
                              />
                            </button>
                          </div>
                        </div>
                      ))}

                      <button
                        type="submit"
                        className="bora-perfil-seguridad-guardar"
                        disabled={guardandoContrasena}
                      >
                        {guardandoContrasena
                          ? 'Actualizando contraseña...'
                          : 'Guardar nueva contraseña'}
                      </button>

                      <p className="bora-perfil-seguridad-ayuda">
                        ¿Olvidaste tu contraseña actual?{' '}
                        <Link to="/recuperar">
                          Recuperar contraseña
                        </Link>
                      </p>
                    </form>
                  )}
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
