
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { auth } from '../../firebase/config'
import { enviarSolicitudEmprendedor } from '../../services/solicitudes/solicitudService'
import './QuieroEmprender.css'

const categorias = [
  'Artesanía',
  'Textiles y tejidos',
  'Gastronomía',
  'Belleza y bienestar',
  'Decoración',
  'Otros',
]

function QuieroEmprender() {
  const [datos, setDatos] = useState({
    nombre: '',
    telefono: '',
    emprendimiento: '',
    categoria: '',
    descripcion: '',
  })

  const [mensaje, setMensaje] = useState('')
  const [tipoMensaje, setTipoMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  const actualizarCampo = (e) => {
    const { name, value } = e.target

    setDatos((anterior) => ({
      ...anterior,
      [name]: value,
    }))

    setMensaje('')
  }

  const enviarSolicitud = async (e) => {
    e.preventDefault()

    if (enviando || enviado) return

    if (Object.values(datos).some((valor) => !valor.trim())) {
      setTipoMensaje('error')
      setMensaje('Por favor, completa todos los campos.')
      return
    }

    if (!auth.currentUser) {
      setTipoMensaje('error')
      setMensaje(
        'Debes iniciar sesión antes de enviar tu solicitud.'
      )
      return
    }

    setEnviando(true)
    setMensaje('')

    try {
      await enviarSolicitudEmprendedor(datos)

      setEnviado(true)
      setTipoMensaje('exito')
      setMensaje(
        '¡Tu solicitud fue enviada correctamente! Está pendiente de revisión por el equipo de BORA.'
      )
    } catch (error) {
      console.error('Error al enviar solicitud:', error)

      setTipoMensaje('error')

      if (error.code === 'permission-denied') {
        setMensaje(
          'Firebase rechazó la solicitud. Comprueba que tu correo esté verificado y que no tengas una solicitud anterior.'
        )
      } else if (error.code === 'already-exists') {
        setMensaje('Ya tienes una solicitud registrada.')
      } else {
        setMensaje(
          error.message || 'No se pudo enviar la solicitud.'
        )
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="bora-emprender">
      <section className="bora-emprender-contenedor">

        <div className="bora-emprender-intro">
          <span className="bora-emprender-etiqueta">
            ✦ CRECE CON BORA
          </span>

          <h1>Tu emprendimiento merece ser descubierto.</h1>

          <p>
            Forma parte de nuestra comunidad de emprendedores y
            emprendedoras. Comparte tus productos, conecta con nuevos
            clientes y haz crecer tu negocio.
          </p>

          <div className="bora-emprender-beneficios">
            <p>✓ Da a conocer tu emprendimiento</p>
            <p>✓ Comparte tus productos con la comunidad</p>
            <p>✓ Conecta con potenciales compradores</p>
          </div>
        </div>

        <div className="bora-emprender-formulario">
          <span className="bora-emprender-icono">✦</span>

          <h2>Quiero ser emprendedor/a</h2>

          <p className="bora-emprender-subtitulo">
            Cuéntanos sobre ti y tu emprendimiento.
            Revisaremos tu solicitud para formar parte de BORA.
          </p>

          <form onSubmit={enviarSolicitud}>

            <label htmlFor="emprender-nombre">
              Nombre completo
            </label>
            <input
              id="emprender-nombre"
              type="text"
              name="nombre"
              placeholder="Tu nombre y apellido"
              value={datos.nombre}
              onChange={actualizarCampo}
              maxLength={150}
              required
              disabled={enviado || enviando}
            />

            <label htmlFor="emprender-telefono">
              Teléfono de contacto
            </label>
            <input
              id="emprender-telefono"
              type="tel"
              name="telefono"
              placeholder="Ejemplo: 912345678"
              value={datos.telefono}
              onChange={actualizarCampo}
              maxLength={30}
              required
              disabled={enviado || enviando}
            />

            <label htmlFor="emprender-emprendimiento">
              Nombre del emprendimiento
            </label>
            <input
              id="emprender-emprendimiento"
              type="text"
              name="emprendimiento"
              placeholder="¿Cómo se llama tu emprendimiento?"
              value={datos.emprendimiento}
              onChange={actualizarCampo}
              maxLength={150}
              required
              disabled={enviado || enviando}
            />

            <label htmlFor="emprender-categoria">
              Categoría
            </label>
            <select
              id="emprender-categoria"
              name="categoria"
              value={datos.categoria}
              onChange={actualizarCampo}
              required
              disabled={enviado || enviando}
            >
              <option value="">Selecciona una categoría</option>

              {categorias.map((categoria) => (
                <option key={categoria} value={categoria}>
                  {categoria}
                </option>
              ))}
            </select>

            <label htmlFor="emprender-descripcion">
              Cuéntanos sobre tu emprendimiento
            </label>
            <textarea
              id="emprender-descripcion"
              name="descripcion"
              placeholder="Describe qué productos ofreces y qué hace especial a tu emprendimiento..."
              value={datos.descripcion}
              onChange={actualizarCampo}
              rows={4}
              maxLength={1000}
              required
              disabled={enviado || enviando}
            />

            {mensaje && (
              <p
                className="bora-emprender-mensaje"
                role="status"
                style={{
                  background:
                    tipoMensaje === 'exito'
                      ? '#e5f5eb'
                      : '#fff3df',
                  color:
                    tipoMensaje === 'exito'
                      ? '#17653d'
                      : '#85520b',
                }}
              >
                {mensaje}
              </p>
            )}

            <button
              type="submit"
              className="bora-emprender-submit"
              disabled={enviando || enviado}
            >
              {enviando
                ? 'Enviando solicitud...'
                : enviado
                  ? 'Solicitud enviada ✓'
                  : 'Enviar mi solicitud →'}
            </button>
          </form>

          <p className="bora-emprender-acceso">
            ¿Ya tienes una cuenta?{' '}
            <Link to="/login">Iniciar sesión</Link>
          </p>
        </div>
      </section>
    </main>
  )
}

export default QuieroEmprender
