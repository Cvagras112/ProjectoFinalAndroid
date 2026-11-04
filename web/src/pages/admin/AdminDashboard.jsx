
import { useState } from 'react'
import './AdminDashboard.css'

import EmprendedorasAdmin from './EmprendedorasAdmin'
import AsociacionesAdmin from './AsociacionesAdmin'
import AsignacionesAdmin from './AsignacionesAdmin'
import CategoriasAdmin from './CategoriasAdmin'
import TiposProductosAdmin from './TiposProductosAdmin'

function AdminDashboard() {

    // SECCIÓN ACTUAL
    const [seccion, setSeccion] = useState('dashboard')

    // ESTADOS COMPARTIDOS
    const [emprendedoras, setEmprendedoras] = useState([])
    const [asociaciones, setAsociaciones] = useState([])
    const [asignaciones, setAsignaciones] = useState([])
    const [categorias, setCategorias] = useState([])
    const [tiposProductos, setTiposProductos] = useState([])

    // ESTADÍSTICAS DEL DASHBOARD
    const totalEmprendedoras = emprendedoras.length
    const totalAsociaciones = asociaciones.length
    const totalCategorias = categorias.length
    const totalTiposProductos = tiposProductos.length

    // OPCIONES DEL MENÚ
    const opciones = [
        { id: 'dashboard', nombre: 'Panel principal' },
        { id: 'emprendedoras', nombre: 'Emprendedoras' },
        { id: 'asociaciones', nombre: 'Asociaciones' },
        { id: 'asignaciones', nombre: 'Asignaciones' },
        { id: 'categorias', nombre: 'Categorías' },
        { id: 'tipos', nombre: 'Tipos de productos' }
    ]

    const obtenerNombreSeccion = () => {
        return opciones.find(
            (opcion) => opcion.id === seccion
        )?.nombre
    }

    return (
        <div className="bora-admin">

            {/* MENÚ LATERAL */}
            <aside className="bora-sidebar">

                <div className="bora-logo">
                    BORA
                </div>

                <p className="bora-subtitle">
                    Panel de administración
                </p>

                <nav className="bora-menu">
                    {opciones.map((opcion) => (
                        <button
                            key={opcion.id}
                            type="button"
                            className={
                                seccion === opcion.id ? 'active' : ''
                            }
                            onClick={() => setSeccion(opcion.id)}
                        >
                            {opcion.nombre}
                        </button>
                    ))}
                </nav>

            </aside>

            {/* CONTENIDO PRINCIPAL */}
            <main className="bora-content">

                {/* ENCABEZADO */}
                <header className="bora-header">

                    {seccion === 'dashboard' ? (
                        <>
                            <h1>
                                ¡Bienvenido al panel BORA!
                            </h1>

                            <p>
                                Gestiona las emprendedoras, asociaciones
                                y categorías de la plataforma desde
                                un solo lugar.
                            </p>
                        </>
                    ) : (
                        <>
                            <h1>
                                {obtenerNombreSeccion()}
                            </h1>

                            <p>
                                Administración de la plataforma BORA
                            </p>
                        </>
                    )}

                </header>

                {/* CONTENIDO SEGÚN LA SECCIÓN */}
                {seccion === 'dashboard' ? (

                    <>
                        {/* ACCESOS RÁPIDOS */}
                        <section className="bora-acciones">

                            <h2>
                                Accesos rápidos
                            </h2>

                            <div className="bora-acciones-botones">

                                <button
                                    type="button"
                                    onClick={() =>
                                        setSeccion('emprendedoras')
                                    }
                                >
                                    Gestionar emprendedoras
                                </button>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setSeccion('asociaciones')
                                    }
                                >
                                    Gestionar asociaciones
                                </button>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setSeccion('categorias')
                                    }
                                >
                                    Gestionar categorías
                                </button>

                            </div>

                        </section>

                        {/* TARJETAS DE ESTADÍSTICAS */}
                        <section className="bora-cards">

                            <article className="bora-card">
                                <h3>Emprendedoras</h3>
                                <div className="value">
                                    {totalEmprendedoras}
                                </div>
                            </article>

                            <article className="bora-card">
                                <h3>Asociaciones</h3>
                                <div className="value">
                                    {totalAsociaciones}
                                </div>
                            </article>

                            <article className="bora-card">
                                <h3>Categorías</h3>
                                <div className="value">
                                    {totalCategorias}
                                </div>
                            </article>

                            <article className="bora-card">
                                <h3>Tipos de productos</h3>
                                <div className="value">
                                    {totalTiposProductos}
                                </div>
                            </article>

                        </section>
                    </>

                ) : seccion === 'emprendedoras' ? (

                    /* MÓDULO EMPRENDEDORAS */
                    <EmprendedorasAdmin
                        emprendedoras={emprendedoras}
                        setEmprendedoras={setEmprendedoras}
                        asociaciones={asociaciones}
                        asignaciones={asignaciones}
                    />

                ) : seccion === 'asociaciones' ? (

                    /* MÓDULO ASOCIACIONES */
                    <AsociacionesAdmin
                        asociaciones={asociaciones}
                        setAsociaciones={setAsociaciones}
                    />

                ) : seccion === 'asignaciones' ? (

                    /* MÓDULO ASIGNACIONES */
                    <AsignacionesAdmin
                        emprendedoras={emprendedoras}
                        setEmprendedoras={setEmprendedoras}
                        asociaciones={asociaciones}
                        asignaciones={asignaciones}
                        setAsignaciones={setAsignaciones}
                    />

                ) : seccion === 'categorias' ? (

                    /* MÓDULO CATEGORÍAS */
                    <CategoriasAdmin
                        categorias={categorias}
                        setCategorias={setCategorias}
                    />

                ) : seccion === 'tipos' ? (

                    /* MÓDULO TIPOS DE PRODUCTOS */
                    <TiposProductosAdmin
                        tipos={tiposProductos}
                        setTipos={setTiposProductos}
                    />

                ) : (

                    <section className="bora-card">
                        <h3>
                            Gestión de {obtenerNombreSeccion()}
                        </h3>

                        <p>
                            Módulo pendiente de implementación.
                        </p>
                    </section>

                )}

            </main>
        </div>
    )
}

export default AdminDashboard
