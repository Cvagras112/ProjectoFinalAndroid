import { useState } from 'react'
import { collection, doc, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'

const inicial = {
  nombre: '',
  descripcion: '',
  sector: '',
  contacto: '',
  logo: ''
}

export default function AsociacionesAdmin({ asociaciones, setAsociaciones }) {
  const [formulario, setFormulario] = useState(inicial)
  const [editando, setEditando] = useState(null)
  const [mostrar, setMostrar] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const limpiar = () => {
    setFormulario(inicial)
    setEditando(null)
    setMostrar(false)
    setError('')
  }

  const editar = (item) => {
    setFormulario({
      nombre: item.nombre || '',
      descripcion: item.descripcion || '',
      sector: item.sector || '',
      contacto: item.contacto || '',
      logo: item.logo || ''
    })
    setEditando(item.id)
    setMostrar(true)
    setError('')
  }

  const guardar = async (e) => {
    e.preventDefault()
    if (guardando) return

    const datos = Object.fromEntries(
      Object.entries(formulario).map(([clave, valor]) => [
        clave, valor.trim()
      ])
    )

    if (datos.nombre.length < 3 || datos.nombre.length > 100) {
      setError('El nombre debe tener entre 3 y 100 caracteres.')
      return
    }

    const repetida = asociaciones.some(
      item =>
        item.id !== editando &&
        (item.nombre || '').toLocaleLowerCase('es').trim() ===
          datos.nombre.toLocaleLowerCase('es')
    )

    if (repetida) {
      setError('Ya existe una asociación con ese nombre.')
      return
    }

    if (datos.logo) {
      try {
        const url = new URL(datos.logo)
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error('URL inválida')
        }
      } catch {
        setError('El logo debe ser una URL http o https válida.')
        return
      }
    }

    setGuardando(true)
    setError('')

    try {
      if (editando) {
        await updateDoc(doc(db, 'asociaciones', editando), datos)
        setAsociaciones(anteriores =>
          anteriores.map(item =>
            item.id === editando ? { ...item, ...datos } : item
          )
        )
      } else {
        const referencia = doc(collection(db, 'asociaciones'))
        const nueva = {
          ...datos,
          estado: 'Activa'
        }

        await setDoc(referencia, nueva)

        setAsociaciones(anteriores => [
          ...anteriores,
          { id: referencia.id, ...nueva }
        ])
      }

      limpiar()
    } catch (err) {
      console.error('Error guardando asociación:', err)
      setError('No se pudo guardar en Firebase: ' + err.message)
    } finally {
      setGuardando(false)
    }
  }

  const cambiarEstado = async (item) => {
    const estado = item.estado === 'Activa' ? 'Inactiva' : 'Activa'

    if (!window.confirm(
      `¿Cambiar "${item.nombre}" a ${estado}?`
    )) return

    try {
      await updateDoc(doc(db, 'asociaciones', item.id), { estado })
      setAsociaciones(anteriores =>
        anteriores.map(actual =>
          actual.id === item.id ? { ...actual, estado } : actual
        )
      )
    } catch (err) {
      console.error(err)
      window.alert('No se pudo cambiar el estado: ' + err.message)
    }
  }

  const normalizar = valor =>
    String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('es')

  const filtradas = asociaciones.filter(item =>
    [item.nombre, item.descripcion, item.sector, item.contacto]
      .some(valor => normalizar(valor).includes(normalizar(busqueda)))
  )

  return (
    <div className="bora-seccion-admin">
      <div className="bora-emprendedoras-header">
        <div>
          <h2>Gestión de asociaciones</h2>
          <p>Registra y administra las asociaciones de BORA.</p>
        </div>
        <button type="button" onClick={() => {
          if (mostrar) limpiar()
          else {
            setFormulario(inicial)
            setEditando(null)
            setMostrar(true)
          }
        }}>
          {mostrar ? 'Cancelar' : '+ Nueva asociación'}
        </button>
      </div>

      {mostrar && (
        <div className="bora-formulario">
          <h3>{editando ? 'Editar asociación' : 'Nueva asociación'}</h3>

          <form className="bora-formulario-campos" onSubmit={guardar}>
            {[
              ['nombre', 'Nombre de la asociación', 100],
              ['descripcion', 'Descripción', 500],
              ['sector', 'Sector', 150],
              ['contacto', 'Contacto', 200],
              ['logo', 'URL del logo', 2000]
            ].map(([campo, etiqueta, maximo]) => (
              <div className="bora-campo" key={campo}>
                <label htmlFor={'asociacion-' + campo}>{etiqueta}</label>
                <input
                  id={'asociacion-' + campo}
                  type={campo === 'logo' ? 'url' : 'text'}
                  value={formulario[campo]}
                  maxLength={maximo}
                  required={campo === 'nombre'}
                  minLength={campo === 'nombre' ? 3 : undefined}
                  onChange={e =>
                    setFormulario(anterior => ({
                      ...anterior,
                      [campo]: e.target.value
                    }))
                  }
                />
              </div>
            ))}

            {formulario.logo && (
              <img
                src={formulario.logo}
                alt="Vista previa del logo"
                style={{ maxWidth: 110, maxHeight: 110, objectFit: 'contain' }}
              />
            )}

            {error && <p role="alert" style={{ color: '#b42318' }}>{error}</p>}

            <button type="submit" disabled={guardando}>
              {guardando
                ? 'Guardando...'
                : editando ? 'Guardar cambios' : 'Registrar asociación'}
            </button>
          </form>
        </div>
      )}

      <div className="bora-buscador">
        <label htmlFor="buscar-asociacion">Buscar asociación</label>
        <input
          id="buscar-asociacion"
          type="search"
          value={busqueda}
          placeholder="Nombre, descripción, sector o contacto"
          onChange={e => setBusqueda(e.target.value)}
        />
      </div>

      <div className="bora-tabla-contenedor">
        <table className="bora-tabla">
          <thead>
            <tr>
              <th>Logo</th>
              <th>Nombre</th>
              <th>Sector</th>
              <th>Contacto</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 ? (
              <tr>
                <td colSpan={6}>No hay asociaciones para mostrar.</td>
              </tr>
            ) : filtradas.map(item => (
              <tr key={item.id}>
                <td>
                  {item.logo ? (
                    <img
                      src={item.logo}
                      alt={'Logo de ' + item.nombre}
                      style={{ width: 48, height: 48, objectFit: 'contain' }}
                    />
                  ) : 'Sin logo'}
                </td>
                <td>
                  <strong>{item.nombre}</strong>
                  <div>{item.descripcion}</div>
                </td>
                <td>{item.sector || 'Sin sector'}</td>
                <td>{item.contacto || 'Sin contacto'}</td>
                <td>{item.estado}</td>
                <td>
                  <div className="bora-acciones-tabla">
                    <button
                      type="button"
                      className="bora-boton-editar"
                      onClick={() => editar(item)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className={
                        item.estado === 'Activa'
                          ? 'bora-boton-eliminar'
                          : 'bora-boton-editar'
                      }
                      onClick={() => cambiarEstado(item)}
                    >
                      {item.estado === 'Activa' ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}