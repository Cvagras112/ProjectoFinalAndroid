
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { auth } from '../../firebase/config'
import './Registro.css'

function Registro() {
  const navigate = useNavigate()

  const [datos, setDatos] = useState({
    nombre: '',
    apellido: '',
    correo: '',
    contrasena: '',
    confirmarContrasena: '',
  })

  const [mostrarContrasena, setMostrarContrasena] = useState(false)
  const [aceptaTerminos, setAceptaTerminos] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [registroExitoso, setRegistroExitoso] = useState(false)

  const actualizarCampo = (e) => {
    const { name, value } = e.target

    setDatos((anterior) => ({
      ...anterior,
      [name]: value,
    }))

    setMensaje('')
    setError('')
  }

  const registrarUsuario = async (e) => {
    e.preventDefault()
    setError('')
    setMensaje('')

    const nombre = datos.nombre.trim()
    const apellido = datos.apellido.trim()
    const correo = datos.correo.trim().toLowerCase()

    if (
      !nombre ||
      !apellido ||
      !correo ||
      !datos.contrasena ||
      !datos.confirmarContrasena
    ) {
      setError('Completa todos los campos.')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      setError('Ingresa un correo electrónico válido.')
      return
    }

    if (datos.contrasena.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    if (datos.contrasena !== datos.confirmarContrasena) {
      setError('Las contraseñas no coinciden.')
      return
    }

    if (!aceptaTerminos) {
      setError('Debes aceptar los términos y condiciones.')
      return
    }

    setCargando(true)

    let cuentaCreada = false

    try {
      const credencial = await createUserWithEmailAndPassword(
        auth,
        correo,
        datos.contrasena
      )

      cuentaCreada = true

      await updateProfile(credencial.user, {
        displayName: `${nombre} ${apellido}`,
      })

      await sendEmailVerification(credencial.user)

      setRegistroExitoso(true)
      setMensaje(
        '¡Cuenta creada! Revisa tu correo electrónico y verifica tu cuenta antes de iniciar sesión.'
      )

      await signOut(auth)
    } catch (err) {
      console.error('Error al registrar usuario:', err.code || err.message)

      if (err.code === 'auth/email-already-in-use') {
        setError('Este correo electrónico ya está registrado.')
      } else if (err.code === 'auth/invalid-email') {
        setError('El correo electrónico no es válido.')
      } else if (err.code === 'auth/weak-password') {
        setError('La contraseña no cumple los requisitos de seguridad.')
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('El registro con correo no está habilitado.')
      } else if (err.code === 'auth/network-request-failed') {
        setError('No hay conexión. Comprueba tu internet.')
      } else if (cuentaCreada) {
        setError(
          'La cuenta se creó, pero no se completó el envío de verificación. Contacta al administrador antes de intentar registrarte otra vez.'
        )
      } else {
        setError('No fue posible crear la cuenta. Inténtalo nuevamente.')
      }
    } finally {
      setCargando(false)
    }
  }

  return (
    <main className="bora-registro">
      <section className="bora-registro-card">

        <div className="bora-registro-presentacion">
          <span className="bora-registro-etiqueta">
            ✦ ÚNETE A BORA
          </span>

          <h1>
            Sé parte de una comunidad que impulsa el talento local.
          </h1>

          <p>
            Crea tu cuenta, descubre productos únicos
            y conecta con los emprendimientos de nuestra comunidad.
          </p>

          <div className="bora-registro-linea" />
        </div>

        <div className="bora-registro-formulario">
          <span className="bora-registro-icono">✦</span>

          <h2>Crear una cuenta</h2>

          <p className="bora-registro-subtitulo">
            Completa tus datos para unirte a BORA.
          </p>

          {registroExitoso ? (
            <div className="bora-registro-confirmacion" role="status">
              <h3>✉️ Revisa tu correo electrónico</h3>
              <p>{mensaje}</p>

              <button
                type="button"
                className="bora-registro-submit"
                onClick={() => navigate('/login')}
              >
                Ir a iniciar sesión →
              </button>
            </div>
          ) : (
            <form onSubmit={registrarUsuario} noValidate>

              <div className="bora-registro-fila">
                <div>
                  <label htmlFor="registro-nombre">Nombre</label>
                  <input
                    id="registro-nombre"
                    type="text"
                    name="nombre"
                    placeholder="Tu nombre"
                    value={datos.nombre}
                    onChange={actualizarCampo}
                    autoComplete="given-name"
                    disabled={cargando}
                  />
                </div>

                <div>
                  <label htmlFor="registro-apellido">Apellido</label>
                  <input
                    id="registro-apellido"
                    type="text"
                    name="apellido"
                    placeholder="Tu apellido"
                    value={datos.apellido}
                    onChange={actualizarCampo}
                    autoComplete="family-name"
                    disabled={cargando}
                  />
                </div>
              </div>

              <label htmlFor="registro-correo">
                Correo electrónico
              </label>
              <input
                id="registro-correo"
                type="email"
                name="correo"
                placeholder="ejemplo@correo.com"
                value={datos.correo}
                onChange={actualizarCampo}
                autoComplete="email"
                disabled={cargando}
              />

              <label htmlFor="registro-contrasena">
                Contraseña
              </label>

              <div className="bora-registro-password">
                <input
                  id="registro-contrasena"
                  type={mostrarContrasena ? 'text' : 'password'}
                  name="contrasena"
                  placeholder="Mínimo 8 caracteres"
                  value={datos.contrasena}
                  onChange={actualizarCampo}
                  autoComplete="new-password"
                  disabled={cargando}
                />

                <button
                  type="button"
                  onClick={() => setMostrarContrasena(!mostrarContrasena)}
                  disabled={cargando}
                >
                  {mostrarContrasena ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>

              <label htmlFor="registro-confirmar">
                Confirmar contraseña
              </label>

              <input
                id="registro-confirmar"
                type={mostrarContrasena ? 'text' : 'password'}
                name="confirmarContrasena"
                placeholder="Repite tu contraseña"
                value={datos.confirmarContrasena}
                onChange={actualizarCampo}
                autoComplete="new-password"
                disabled={cargando}
              />

              <label className="bora-registro-terminos">
                <input
                  type="checkbox"
                  checked={aceptaTerminos}
                  onChange={(e) => setAceptaTerminos(e.target.checked)}
                  disabled={cargando}
                />
                <span>
                  Acepto los términos y condiciones de BORA.
                </span>
              </label>

              {error && (
                <p className="bora-registro-mensaje" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="bora-registro-submit"
                disabled={cargando}
              >
                {cargando ? 'Creando cuenta...' : 'Crear mi cuenta →'}
              </button>
            </form>
          )}

          <div className="bora-registro-login">
            <p>¿Ya tienes una cuenta?</p>
            <Link to="/login">Iniciar sesión</Link>
          </div>
        </div>
      </section>
    </main>
  )
}

export default Registro
