
import { useState } from 'react'

export default function AsociacionesAdmin({ asociaciones, setAsociaciones }) {
    const [mostrarFormulario, setMostrarFormulario] = useState(false)
    const [asociacionEditando, setAsociacionEditando] = useState(null)
    const [busqueda, setBusqueda] = useState('')

    const [formulario, setFormulario] = useState({
        nombre: '',
        descripcion: ''
    })

    const limpiarFormulario = () => {
        setFormulario({
            nombre: '',
            descripcion: ''
        })
        setAsociacionEditando(null)
        setMostrarFormulario(false)
    }

    const abrirFormulario = () => {
        setFormulario({
            nombre: '',
            descripcion: ''
        })
        setAsociacionEditando(null)
        setMostrarFormulario(true)
    }

    const editarAsociacion = (asociacion) => {
        setAsociacionEditando(asociacion)
        setFormulario({
            nombre: asociacion.nombre,
            descripcion: asociacion.descripcion || ''
        })
        setMostrarFormulario(true)
    }


    const normalizarTexto = (texto) => {
        return String(texto || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLocaleLowerCase('es')
            .trim()
    }

    const asociacionesFiltradas = asociaciones.filter((asociacion) => {
        const textoBuscado = normalizarTexto(busqueda)

        const nombre = normalizarTexto(asociacion.nombre)
        const descripcion = normalizarTexto(asociacion.descripcion)

        return (
            nombre.includes(textoBuscado) ||
            descripcion.includes(textoBuscado)
        )
    })


    const registrarAsociacion = (e) => {
        e.preventDefault()

        const nombre = formulario.nombre.trim()
        const descripcion = formulario.descripcion.trim()

        if (nombre.length < 3) {
            window.alert('El nombre debe tener al menos 3 caracteres.')
            return
        }

        const existe = asociaciones.some(
            (asociacion) =>
                asociacion.nombre.toLocaleLowerCase('es') ===
                nombre.toLocaleLowerCase('es') &&
                asociacion.id !== asociacionEditando?.id
        )

        if (existe) {
            window.alert('Ya existe una asociación con ese nombre.')
            return
        }

        if (asociacionEditando) {
            setAsociaciones((anteriores) =>
                anteriores.map((asociacion) =>
                    asociacion.id === asociacionEditando.id
                        ? {
                            ...asociacion,
                            nombre,
                            descripcion
                        }
                        : asociacion
                )
            )
        } else {
            const nuevaAsociacion = {
                id: crypto.randomUUID(),
                nombre,
                descripcion,
                estado: 'Activa'
            }

            setAsociaciones((anteriores) => [
                ...anteriores,
                nuevaAsociacion
            ])
        }

        limpiarFormulario()
    }

    const cambiarEstadoAsociacion = (id) => {
        const asociacion = asociaciones.find(
            (item) => item.id === id
        )

        if (!asociacion) return

        const nuevoEstado =
            asociacion.estado === 'Activa'
                ? 'Inactiva'
                : 'Activa'

        const confirmar = window.confirm(
            `¿Deseas cambiar el estado de "${asociacion.nombre}" a ${nuevoEstado}?`
        )

        if (!confirmar) return

        setAsociaciones((anteriores) =>
            anteriores.map((item) =>
                item.id === id
                    ? { ...item, estado: nuevoEstado }
                    : item
            )
        )
    }

    return (
        <div className="bora-seccion-admin">

            <div className="bora-emprendedoras-header">
                <div>
                    <h2>Gestión de asociaciones</h2>
                    <p>
                        Registra, administra y consulta las asociaciones
                        de emprendedoras de BORA.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={
                        mostrarFormulario
                            ? limpiarFormulario
                            : abrirFormulario
                    }
                >
                    {mostrarFormulario
                        ? 'Cancelar'
                        : '+ Nueva asociación'}
                </button>
            </div>

            {mostrarFormulario && (
                <div className="bora-formulario">
                    <h3>
                        {asociacionEditando
                            ? 'Editar asociación'
                            : 'Registrar nueva asociación'}
                    </h3>

                    <p>
                        Completa los datos de la asociación.
                    </p>

                    <form
                        className="bora-formulario-campos"
                        onSubmit={registrarAsociacion}
                    >
                        <div className="bora-campo">
                            <label htmlFor="nombre-asociacion">
                                Nombre de la asociación
                            </label>

                            <input
                                id="nombre-asociacion"
                                name="nombre"
                                type="text"
                                placeholder="Ej: Artesanas de Chiloé"
                                value={formulario.nombre}
                                onChange={(e) =>
                                    setFormulario((anterior) => ({
                                        ...anterior,
                                        nombre: e.target.value
                                    }))
                                }
                                required
                                minLength={3}
                                maxLength={100}
                            />
                        </div>

                        <div className="bora-campo">
                            <label htmlFor="descripcion-asociacion">
                                Descripción
                            </label>

                            <input
                                id="descripcion-asociacion"
                                name="descripcion"
                                type="text"
                                placeholder="Describe brevemente la asociación"
                                value={formulario.descripcion}
                                onChange={(e) =>
                                    setFormulario((anterior) => ({
                                        ...anterior,
                                        descripcion: e.target.value
                                    }))
                                }
                                maxLength={500}
                            />
                        </div>

                        <button type="submit">
                            {asociacionEditando
                                ? 'Guardar cambios'
                                : 'Registrar asociación'}
                        </button>
                    </form>
                </div>
            )}

            <div className="bora-buscador">
                <label htmlFor="buscar-asociacion">
                    Buscar asociación
                </label>

                <input
                    id="buscar-asociacion"
                    type="search"
                    placeholder="Buscar por nombre o descripción..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                />
            </div>

            <div className="bora-tabla-contenedor">
                <table className="bora-tabla">
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Descripción</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>

                    <tbody>
                        {asociacionesFiltradas.length === 0 ? (
                            <tr>
                                <td colSpan={4}>
                                    {busqueda.trim()
                                        ? 'No se encontraron asociaciones con esa búsqueda.'
                                        : 'Todavía no hay asociaciones registradas.'}
                                </td>
                            </tr>
                        ) : (
                            asociacionesFiltradas.map((asociacion) => (
                                <tr key={asociacion.id}>
                                    <td>{asociacion.nombre}</td>

                                    <td>
                                        {asociacion.descripcion || 'Sin descripción'}
                                    </td>

                                    <td>{asociacion.estado}</td>

                                    <td>
                                        <div className="bora-acciones-tabla">
                                            <button
                                                type="button"
                                                className="bora-boton-editar"
                                                onClick={() =>
                                                    editarAsociacion(asociacion)
                                                }
                                            >
                                                Editar
                                            </button>

                                            <button
                                                type="button"
                                                className={
                                                    asociacion.estado === 'Activa'
                                                        ? 'bora-boton-eliminar'
                                                        : 'bora-boton-editar'
                                                }
                                                onClick={() =>
                                                    cambiarEstadoAsociacion(asociacion.id)
                                                }
                                            >
                                                {asociacion.estado === 'Activa'
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
