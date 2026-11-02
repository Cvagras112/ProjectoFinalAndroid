
import { useState } from 'react'
import { Link } from 'react-router-dom'
import './Registro.css'

function Registro() {
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

  const actualizarCampo = (e) => {
    const { name, value } = e.target

    setDatos((anterior) => ({
      ...anterior,
      [name]: value,
    }))

    setMensaje('')
  }

  const registrarUsuario = (e) => {
    e.preventDefault()

    if (
      !datos.nombre.trim() ||
      !datos.apellido.trim() ||
      !datos.correo.trim() ||
      !datos.contrasena ||
      !datos.confirmarContrasena
    ) {
      setMensaje('Completa todos los campos.')
      return
    }

    if (datos.contrasena.length < 8) {
      setMensaje('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    if (datos.contrasena !== datos.confirmarContrasena) {
      setMensaje('Las contraseñas no coinciden.')
      return
    }

    if (!aceptaTerminos) {
      setMensaje('Debes aceptar los términos y condiciones.')
      return
    }

    setMensaje(
      'El formulario está listo. El registro de cuentas se habilitará al conectar Firebase.'
    )
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
              />

              <button
                type="button"
                onClick={() => setMostrarContrasena(!mostrarContrasena)}
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
            />

            <label className="bora-registro-terminos">
              <input
                type="checkbox"
                checked={aceptaTerminos}
                onChange={(e) => setAceptaTerminos(e.target.checked)}
              />
              <span>
                Acepto los términos y condiciones de BORA.
              </span>
            </label>

            {mensaje && (
              <p className="bora-registro-mensaje" role="status">
                {mensaje}
              </p>
            )}

            <button type="submit" className="bora-registro-submit">
              Crear mi cuenta →
            </button>
          </form>

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
