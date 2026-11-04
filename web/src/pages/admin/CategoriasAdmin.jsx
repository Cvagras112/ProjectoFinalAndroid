
import { useState } from 'react'

export default function CategoriasAdmin({
  categorias,
  setCategorias,
  titulo = 'Gestión de categorías',
  descripcion = 'Registra y administra las categorías de BORA.',
  nombreElemento = 'categoría'
}) {
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [categoriaEditando, setCategoriaEditando] = useState(null)
  const [nombre, setNombre] = useState('')
  const [busqueda, setBusqueda] = useState('')

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

  const guardarCategoria = (e) => {
    e.preventDefault()

    const nombreLimpio = nombre.trim()

    if (nombreLimpio.length < 3) {
      window.alert('El nombre debe tener al menos 3 caracteres.')
      return
    }

    const duplicada = categorias.some(
      (categoria) =>
        normalizarTexto(categoria.nombre) === normalizarTexto(nombreLimpio) &&
        categoria.id !== categoriaEditando?.id
    )

    if (duplicada) {
      window.alert(`Ya existe un registro de ${nombreElemento} con ese nombre.`)
      return
    }

    if (categoriaEditando) {
      setCategorias((anteriores) =>
        anteriores.map((categoria) =>
          categoria.id === categoriaEditando.id
            ? { ...categoria, nombre: nombreLimpio }
            : categoria
        )
      )
    } else {
      setCategorias((anteriores) => [
        ...anteriores,
        {
          id: crypto.randomUUID(),
          nombre: nombreLimpio,
          estado: 'Activa'
        }
      ])
    }

    cerrarFormulario()
  }

  const cambiarEstado = (categoria) => {
    const nuevoEstado =
      categoria.estado === 'Activa' ? 'Inactiva' : 'Activa'

    const confirmar = window.confirm(
      `¿Deseas cambiar el estado de "${categoria.nombre}" a ${nuevoEstado}?`
    )

    if (!confirmar) return

    setCategorias((anteriores) =>
      anteriores.map((item) =>
        item.id === categoria.id
          ? { ...item, estado: nuevoEstado }
          : item
      )
    )
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
