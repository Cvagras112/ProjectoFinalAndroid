
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../../firebase/config'
import './EditarTienda.css'

import {
  obtenerTiendaEmprendedor,
  actualizarTiendaEmprendedor,
} from '../../services/tiendas/tiendaService'

const categorias = [
  'Artesanía',
  'Textiles y tejidos',
  'Gastronomía',
  'Belleza y bienestar',
  'Decoración',
  'Otros',
]


const sectores = [
  // Provincia de Llanquihue
  'Calbuco',
  'Cochamó',
  'Fresia',
  'Frutillar',
  'Llanquihue',
  'Los Muermos',
  'Maullín',
  'Puerto Montt',
  'Puerto Varas',

  // Provincia de Osorno
  'Osorno',
  'Puerto Octay',
  'Purranque',
  'Puyehue',
  'Río Negro',
  'San Juan de la Costa',
  'San Pablo',

  // Provincia de Chiloé
  'Ancud',
  'Castro',
  'Chonchi',
  'Curaco de Vélez',
  'Dalcahue',
  'Puqueldón',
  'Queilén',
  'Quellón',
  'Quemchi',
  'Quinchao',

  // Provincia de Palena
  'Chaitén',
  'Futaleufú',
  'Hualaihué',
  'Palena',
]


const formularioInicial = {
  nombre: '',
  descripcion: '',
  categoria: '',
  sector: '',
  telefono: '',
  whatsapp: '',
  emailContacto: '',
  imagen: '',
}

function EditarTienda() {
  const [usuario, setUsuario] = useState(null)
  const [tienda, setTienda] = useState(null)
  const [formulario, setFormulario] = useState(formularioInicial)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    const cancelar = onAuthStateChanged(auth, async (usuarioActual) => {
      setCargando(true)
      setError('')

      if (!usuarioActual) {
        setUsuario(null)
        setTienda(null)
        setError('Debes iniciar sesión para editar tu tienda.')
        setCargando(false)
        return
      }

      setUsuario(usuarioActual)

      try {
        const datos = await obtenerTiendaEmprendedor(usuarioActual.uid)

        setTienda(datos)
        setFormulario({
          nombre: datos.nombre || '',
          descripcion: datos.descripcion || '',
          categoria: datos.categoria || '',
          sector: datos.sector || '',
          telefono: datos.telefono || '',
          whatsapp: datos.whatsapp || '',
          emailContacto: datos.emailContacto || '',
          imagen: datos.imagen || '',
        })
      } catch (err) {
        setError(err.message || 'No pudimos cargar tu tienda.')
      } finally {
        setCargando(false)
      }
    })

    return () => cancelar()
  }, [])

  function cambiarCampo(evento) {
    const { name, value } = evento.target

    setFormulario((anterior) => ({
      ...anterior,
      [name]: value,
    }))
  }

  async function guardarCambios(evento) {
    evento.preventDefault()

    if (!usuario || !tienda || guardando) return

    setError('')
    setMensaje('')
    setGuardando(true)

    try {
      const datosActualizados = await actualizarTiendaEmprendedor(
        usuario.uid,
        formulario
      )

      setTienda(datosActualizados)
      setMensaje('¡La información de tu tienda se actualizó correctamente!')
    } catch (err) {
      setError(err.message || 'No pudimos guardar los cambios.')
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) {
    return (
      <main className="editar-tienda">
        <p>Cargando información de tu tienda...</p>
      </main>
    )
  }

  if (!tienda) {
    return (
      <main className="editar-tienda">
        <h1>Editar mi tienda</h1>
        <p role="alert">{error || 'No encontramos tu tienda.'}</p>
        <Link to="/panel-emprendedora">Volver al panel</Link>
      </main>
    )
  }

  return (
    <main className="editar-tienda">
      <div className="editar-tienda__encabezado">
        <Link to="/panel-emprendedora">
          ← Volver a mi panel
        </Link>

        <h1>Editar mi tienda</h1>
        <p>
          Actualiza la información que las personas verán
          cuando visiten tu emprendimiento en BORA.
        </p>
      </div>

      <form onSubmit={guardarCambios} className="editar-tienda__formulario">
        <h2>Información de tu emprendimiento</h2>

        <label htmlFor="nombre">Nombre de la tienda</label>
        <input
          id="nombre"
          name="nombre"
          value={formulario.nombre}
          onChange={cambiarCampo}
          maxLength={150}
          required
        />

        <label htmlFor="descripcion">Descripción</label>
        <textarea
          id="descripcion"
          name="descripcion"
          value={formulario.descripcion}
          onChange={cambiarCampo}
          maxLength={2000}
          rows={4}
        />

        <label htmlFor="categoria">Tipo de emprendimiento</label>
        <select
          id="categoria"
          name="categoria"
          value={formulario.categoria}
          onChange={cambiarCampo}
          required
        >
          <option value="">Selecciona una categoría</option>
          {categorias.map((categoria) => (
            <option key={categoria} value={categoria}>
              {categoria}
            </option>
          ))}
        </select>

        <label htmlFor="sector">Comuna de la Región de Los Lagos</label>
        <select
          id="sector"
          name="sector"
          value={formulario.sector}
          onChange={cambiarCampo}
        >
          <option value="">Selecciona tu comuna</option>
          {sectores.map((sector) => (
            <option key={sector} value={sector}>
              {sector}
            </option>
          ))}
        </select>

        <h2>Datos de contacto</h2>

        <label htmlFor="telefono">Teléfono</label>
        <input
          id="telefono"
          name="telefono"
          type="tel"
          value={formulario.telefono}
          onChange={cambiarCampo}
          placeholder="+56 9 1234 5678"
        />

        <label htmlFor="whatsapp">WhatsApp</label>
        <input
          id="whatsapp"
          name="whatsapp"
          type="tel"
          value={formulario.whatsapp}
          onChange={cambiarCampo}
          placeholder="+56 9 1234 5678"
        />

        <label htmlFor="emailContacto">Correo de contacto</label>
        <input
          id="emailContacto"
          name="emailContacto"
          type="email"
          value={formulario.emailContacto}
          onChange={cambiarCampo}
          placeholder="contacto@ejemplo.cl"
        />

        <h2>Imagen de la tienda</h2>

        <label htmlFor="imagen">URL de la foto o logo</label>
        <input
          id="imagen"
          name="imagen"
          type="url"
          value={formulario.imagen}
          onChange={cambiarCampo}
          placeholder="https://ejemplo.cl/logo.jpg"
        />

        {formulario.imagen && (
          <img
            src={formulario.imagen}
            alt="Vista previa de la tienda"
            style={{
              width: 140,
              height: 140,
              objectFit: 'cover',
              borderRadius: 16,
            }}
          />
        )}

        {error && <p role="alert">{error}</p>}
        {mensaje && <p role="status">{mensaje}</p>}

        <div className="editar-tienda__acciones">
          <Link to="/panel-emprendedora">
            Cancelar
          </Link>

          <button type="submit" disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </main>
  )
}

export default EditarTienda
