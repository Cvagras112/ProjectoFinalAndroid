import { collection, addDoc, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'

import { useState } from 'react'

export default function TiposEmprendimientoAdmin({
  categorias,
  setCategorias,
  titulo = 'Gestión de tipos de emprendimiento',
  descripcion = 'Registra y administra los tipos de emprendimiento de BORA.',
  nombreElemento = 'tipo de emprendimiento'
}) {
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [categoriaEditando, setCategoriaEditando] = useState(null)
  const [nombre, setNombre] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [guardando, setGuardando] = useState(false)

  const normalizarTexto = (texto) =>
    String(texto || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('es')
      .trim()

  const categoriasFiltradas = categorias.filter((categoria) =>
    normalizarTexto(categoria.nombre).includes(normalizarTexto(busqueda))
  )

  const cerrarFormulario = () => {
    setMostrarFormulario(false)
    setCategoriaEditando(null)
    setNombre('')
  }

  const abrirFormulario = () => {
    setCategoriaEditando(null)
    setNombre('')
    setMostrarFormulario(true)
  }

  const editarCategoria = (categoria) => {
    setCategoriaEditando(categoria)
    setNombre(categoria.nombre)
    setMostrarFormulario(true)
  }

  const guardarCategoria = async (e) => {
    e.preventDefault()
    if (guardando) return

    const nombreLimpio = nombre.trim()

    if (nombreLimpio.length < 3 || nombreLimpio.length > 100) {
      window.alert('El nombre debe tener entre 3 y 100 caracteres.')
      return
    }

    const duplicada = categorias.some(
      (categoria) =>
        normalizarTexto(categoria.nombre) === normalizarTexto(nombreLimpio) &&
        categoria.id !== categoriaEditando?.id
    )

    if (duplicada) {
      window.alert('Ya existe una categoría con ese nombre.')
      return
    }

    setGuardando(true)

    try {
      if (categoriaEditando) {
        const referencia = doc(db, 'tipos_emprendimiento', categoriaEditando.id)

        await updateDoc(referencia, {
          nombre: nombreLimpio
        })

        setCategorias((anteriores) =>
          anteriores.map((categoria) =>
            categoria.id === categoriaEditando.id
              ? { ...categoria, nombre: nombreLimpio }
              : categoria
          )
        )
      } else {
        const nueva = {
          nombre: nombreLimpio,
          estado: 'Activa'
        }

        const referencia = await addDoc(
          collection(db, 'tipos_emprendimiento'),
          nueva
        )

        setCategorias((anteriores) => [
          ...anteriores,
          { id: referencia.id, ...nueva }
        ])
      }

      cerrarFormulario()
    } catch (error) {
      console.error('Error guardando categoría:', error)
      window.alert('No se pudo guardar en Firebase: ' + error.message)
    } finally {
      setGuardando(false)
    }
  }
  const cambiarEstado = async (categoria) => {
    if (guardando) return

    const nuevoEstado =
      categoria.estado === 'Activa' ? 'Inactiva' : 'Activa'

    const confirmar = window.confirm(
      `¿Deseas cambiar el estado de "${categoria.nombre}" a ${nuevoEstado}?`
    )

    if (!confirmar) return

    setGuardando(true)

    try {
      await updateDoc(doc(db, 'tipos_emprendimiento', categoria.id), {
        estado: nuevoEstado
      })

      setCategorias((anteriores) =>
        anteriores.map((item) =>
          item.id === categoria.id
            ? { ...item, estado: nuevoEstado }
            : item
        )
      )
    } catch (error) {
      console.error('Error cambiando estado:', error)
      window.alert('No se pudo actualizar en Firebase: ' + error.message)
    } finally {
      setGuardando(false)
    }
  }
  return (
    <div className="bora-seccion-admin">

      <div className="bora-emprendedoras-header">
        <div>
          <h2>{titulo}</h2>
          <p>{descripcion}</p>
        </div>

        <button
          type="button"
          onClick={
            mostrarFormulario
              ? cerrarFormulario
              : abrirFormulario
          }
        >
          {mostrarFormulario
            ? 'Cancelar'
            : `+ Nuevo registro de ${nombreElemento}`}
        </button>
      </div>

      {mostrarFormulario && (
        <div className="bora-formulario">
          <h3>
            {categoriaEditando
              ? `Editar ${nombreElemento}`
              : `Registrar ${nombreElemento}`}
          </h3>

          <p>
            Completa la información del registro.
          </p>

          <form
            className="bora-formulario-campos"
            onSubmit={guardarCategoria}
          >
            <div className="bora-campo">
              <label htmlFor="nombre-categoria">
                Nombre de {nombreElemento}
              </label>

              <input
                id="nombre-categoria"
                type="text"
                placeholder={`Ingresa el nombre de ${nombreElemento}`}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                minLength={3}
                maxLength={100}
                required
              />
            </div>

            <button type="submit">
              {categoriaEditando
                ? 'Guardar cambios'
                : `Registrar ${nombreElemento}`}
            </button>
          </form>
        </div>
      )}

      <div className="bora-buscador">
        <label htmlFor="buscar-categoria">
          Buscar {nombreElemento}
        </label>

        <input
          id="buscar-categoria"
          type="search"
          placeholder="Buscar por nombre..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="bora-tabla-contenedor">
        <table className="bora-tabla">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {categoriasFiltradas.length === 0 ? (
              <tr>
                <td colSpan={3}>
                  {busqueda.trim()
                    ? `No se encontraron registros de ${nombreElemento}.`
                    : `Todavía no hay registros de ${nombreElemento}.`}
                </td>
              </tr>
            ) : (
              categoriasFiltradas.map((categoria) => (
                <tr key={categoria.id}>
                  <td>{categoria.nombre}</td>
                  <td>{categoria.estado}</td>

                  <td>
                    <div className="bora-acciones-tabla">
                      <button
                        type="button"
                        className="bora-boton-editar"
                        onClick={() => editarCategoria(categoria)}
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        className={
                          categoria.estado === 'Activa'
                            ? 'bora-boton-eliminar'
                            : 'bora-boton-editar'
                        }
                        onClick={() => cambiarEstado(categoria)}
                      >
                        {categoria.estado === 'Activa'
                          ? 'Desactivar'
                          : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  )
}
