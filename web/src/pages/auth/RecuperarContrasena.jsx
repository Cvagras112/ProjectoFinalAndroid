
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '../../firebase/config'
import './RecuperarContrasena.css'

function RecuperarContrasena() {
  const [correo, setCorreo] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [tipoMensaje, setTipoMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)

  const recuperarContrasena = async (e) => {
    e.preventDefault()

    if (enviando) return

    const correoLimpio = correo.trim()

    if (!correoLimpio) {
      setTipoMensaje('error')
      setMensaje('Debes ingresar tu correo electrónico.')
      return
    }

    const formatoCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!formatoCorreo.test(correoLimpio)) {
      setTipoMensaje('error')
      setMensaje('Ingresa un correo electrónico válido.')
      return
    }

    setEnviando(true)
    setMensaje('')
    setTipoMensaje('')

    try {
      await sendPasswordResetEmail(auth, correoLimpio)

      setTipoMensaje('informacion')
      setMensaje(
        'Si existe una cuenta asociada a este correo, recibirás un enlace para restablecer tu contraseña. Revisa también la carpeta de spam.'
      )
    } catch (error) {
      console.error(
        'Error al recuperar contraseña:',
        error.code
      )

      setTipoMensaje('error')

      if (error.code === 'auth/too-many-requests') {
        setMensaje(
          'Se realizaron demasiados intentos. Espera unos minutos antes de intentarlo nuevamente.'
        )
      } else if (error.code === 'auth/invalid-email') {
        setMensaje(
          'El correo electrónico ingresado no es válido.'
        )
      } else if (error.code === 'auth/network-request-failed') {
        setMensaje(
          'No se pudo conectar con Firebase. Revisa tu conexión a Internet.'
        )
      } else {
        setMensaje(
          'No pudimos procesar tu solicitud. Inténtalo nuevamente más tarde.'
        )
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="bora-recuperar">
      <section className="bora-recuperar-card">

        <div className="bora-recuperar-presentacion">
          <span className="bora-recuperar-etiqueta">
            ✦ ESTAMOS CONTIGO
          </span>

          <h1>
            Recupera tu acceso y sigue descubriendo BORA.
          </h1>

          <p>
            Queremos que sigas conectando con el talento
            local, descubriendo productos únicos y
            apoyando a nuestra comunidad de emprendedoras.
          </p>

          <div className="bora-recuperar-linea" />
        </div>

        <div className="bora-recuperar-formulario">

          <div className="bora-recuperar-icono">
            🔐
          </div>

          <h2>¿Olvidaste tu contraseña?</h2>

          <p>
            Ingresa el correo electrónico asociado a tu
            cuenta. Te enviaremos un enlace para
            restablecer tu contraseña.
          </p>

          <form onSubmit={recuperarContrasena}>

            <label htmlFor="correo-recuperacion">
              Correo electrónico
            </label>

            <input
              id="correo-recuperacion"
              type="email"
              name="correo"
              placeholder="ejemplo@correo.com"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              autoComplete="email"
              maxLength={254}
              disabled={enviando}
              required
            />

            {mensaje && (
              <div
                className={`bora-recuperar-mensaje bora-recuperar-mensaje--${tipoMensaje}`}
                role="status"
                aria-live="polite"
              >
                {mensaje}
              </div>
            )}

            <button
              type="submit"
              disabled={enviando}
            >
              {enviando
                ? 'Enviando correo...'
                : 'Enviar enlace de recuperación →'}
            </button>

          </form>

          <div className="bora-recuperar-ayuda">
            ¿Recordaste tu contraseña?
          </div>

          <Link
            to="/login"
            className="bora-recuperar-volver"
          >
            ← Volver a iniciar sesión
          </Link>

        </div>
      </section>
    </main>
  )
}

export default RecuperarContrasena
