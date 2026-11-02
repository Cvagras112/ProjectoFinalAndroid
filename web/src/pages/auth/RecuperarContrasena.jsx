
import { useState } from 'react'
import { Link } from 'react-router-dom'
import './RecuperarContrasena.css'

function RecuperarContrasena() {
  const [correo, setCorreo] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [tipoMensaje, setTipoMensaje] = useState('')

  const recuperarContrasena = (e) => {
    e.preventDefault()

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

    setTipoMensaje('informacion')
    setMensaje(
      'El formulario está preparado. El envío del correo de recuperación estará disponible cuando conectemos Firebase.'
    )
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

          <p className="bora-recuperar-subtitulo">
            Ingresa el correo electrónico asociado
            a tu cuenta. Cuando habilitemos la
            recuperación, podrás recibir un enlace
            para restablecer tu contraseña.
          </p>

          <form onSubmit={recuperarContrasena} noValidate>
            <label htmlFor="recuperar-correo">
              Correo electrónico
            </label>

            <input
              id="recuperar-correo"
              type="email"
              placeholder="ejemplo@correo.com"
              value={correo}
              onChange={(e) => {
                setCorreo(e.target.value)
                setMensaje('')
              }}
              autoComplete="email"
            />

            {mensaje && (
              <p
                className={`bora-recuperar-mensaje ${tipoMensaje}`}
                role="status"
              >
                {mensaje}
              </p>
            )}

            <button
              type="submit"
              className="bora-recuperar-submit"
            >
              Continuar →
            </button>
          </form>

          <div className="bora-recuperar-volver">
            <p>¿Recordaste tu contraseña?</p>

            <Link to="/login">
              ← Volver a iniciar sesión
            </Link>
          </div>
        </div>

      </section>
    </main>
  )
}

export default RecuperarContrasena
