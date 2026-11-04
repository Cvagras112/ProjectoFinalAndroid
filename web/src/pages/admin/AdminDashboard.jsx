
import { useState } from 'react'
import { Link } from 'react-router-dom'
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

    // ESTADÍSTICAS
    const totalEmprendedoras = emprendedoras.length
    const totalAsociaciones = asociaciones.length
    const totalCategorias = categorias.length
    const totalTiposProductos = tiposProductos.length

    // MENÚ ADMINISTRATIVO
    const opciones = [
        {
            id: 'dashboard',
            nombre: 'Panel principal',
            icono: '🏠'
        },
        {
            id: 'emprendedoras',
            nombre: 'Emprendedores/as',
            icono: '👩‍💼'
        },
        {
            id: 'asociaciones',
            nombre: 'Asociaciones',
            icono: '🤝'
        },
        {
            id: 'asignaciones',
            nombre: 'Asignaciones',
            icono: '📋'
        },
        {
            id: 'categorias',
            nombre: 'Categorías',
            icono: '🏷️'
        },
        {
            id: 'tipos',
            nombre: 'Tipos de productos',
            icono: '📦'
        }
    ]

    const obtenerNombreSeccion = () => {
        return opciones.find(
            (opcion) => opcion.id === seccion
        )?.nombre || 'Administración'
    }

    const estadisticas = [
        {
            titulo: 'Emprendedores/as',
            valor: totalEmprendedoras,
            icono: '🧑‍🎨',
            descripcion: 'Perfiles registrados'
        },
        {
            titulo: 'Asociaciones',
            valor: totalAsociaciones,
            icono: '🤝',
            descripcion: 'Organizaciones registradas'
        },
        {
            titulo: 'Categorías',
            valor: totalCategorias,
            icono: '🏷️',
            descripcion: 'Categorías disponibles'
        },
        {
            titulo: 'Tipos de productos',
            valor: totalTiposProductos,
            icono: '📦',
            descripcion: 'Tipos registrados'
        }
    ]

    return (
        <div className="bora-admin">

            {/* MENÚ LATERAL */}
            <aside className="bora-sidebar">

                <div className="bora-logo">
                    🛍️ BORA
                </div>

                <p className="bora-subtitle">
                    ✨ Panel de administración
                </p>

                <nav
                    className="bora-menu"
                    aria-label="Menú administrativo"
                >
                    {opciones.map((opcion) => (
                        <button
                            key={opcion.id}
                            type="button"
                            className={
                                seccion === opcion.id ? 'active' : ''
                            }
                            onClick={() => setSeccion(opcion.id)}
                        >
                            <span aria-hidden="true">
                                {opcion.icono}{' '}
                            </span>
                            {opcion.nombre}
                        </button>
                    ))}
                </nav>

                {/* BOTÓN VOLVER AL INICIO */}
                <Link
                    to="/"
                    className="bora-volver-inicio"
                >
                    <span aria-hidden="true">🏠</span>
                    Volver al inicio
                </Link>

            </aside>

            {/* CONTENIDO PRINCIPAL */}
            <main className="bora-content">

                {/* ENCABEZADO */}
                <header className="bora-header">

                    {seccion === 'dashboard' ? (
                        <>
                            <h1>
                                ✨ ¡Bienvenido al panel BORA!
                            </h1>

                            <p>
                                Administra tu comunidad de emprendedores,
                                asociaciones y productos desde un solo lugar.
                                💚
                            </p>
                        </>
                    ) : (
                        <>
                            <h1>
                                {opciones.find(
                                    (opcion) => opcion.id === seccion
                                )?.icono}{' '}
                                {obtenerNombreSeccion()}
                            </h1>

                            <p>
                                🛠️ Gestión y administración de BORA
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
                                🚀 Accesos rápidos
                            </h2>

                            <div className="bora-acciones-botones">

                                <button
                                    type="button"
                                    onClick={() =>
                                        setSeccion('emprendedoras')
                                    }
                                >
                                    🧑‍🎨 Gestionar emprendedores/as
                                </button>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setSeccion('asociaciones')
                                    }
                                >
                                    🤝 Gestionar asociaciones
                                </button>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setSeccion('categorias')
                                    }
                                >
                                    🏷️ Gestionar categorías
                                </button>

                            </div>

                        </section>

                        {/* TARJETAS DE ESTADÍSTICAS */}
                        <section
                            className="bora-cards"
                            aria-label="Resumen de la plataforma"
                        >
                            {estadisticas.map((estadistica) => (
                                <article
                                    key={estadistica.titulo}
                                    className="bora-card"
                                >
                                    <div
                                        style={{
                                            fontSize: '30px',
                                            marginBottom: '12px'
                                        }}
                                        aria-hidden="true"
                                    >
                                        {estadistica.icono}
                                    </div>

                                    <h3>
                                        {estadistica.titulo}
                                    </h3>

                                    <div className="value">
                                        {estadistica.valor}
                                    </div>

                                    <p
                                        style={{
                                            fontSize: '12px',
                                            color: '#69736D',
                                            marginTop: '8px'
                                        }}
                                    >
                                        {estadistica.descripcion}
                                    </p>
                                </article>
                            ))}
                        </section>

                        {/* MENSAJE DE BIENVENIDA */}
                        <section
                            style={{
                                marginTop: '30px',
                                padding: '24px',
                                background: '#F0F7F1',
                                borderRadius: '18px',
                                border: '1px solid #DCEBDD'
                            }}
                        >
                            <h2
                                style={{
                                    color: '#194C36',
                                    fontSize: '18px',
                                    marginBottom: '10px'
                                }}
                            >
                                🌿 Una comunidad que crece
                            </h2>

                            <p
                                style={{
                                    color: '#52665B',
                                    lineHeight: '1.7',
                                    fontSize: '14px'
                                }}
                            >
                                BORA conecta a emprendedores y
                                emprendedoras con nuevas oportunidades.
                                Desde este espacio podrás organizar
                                la información de la plataforma y
                                apoyar el crecimiento de la comunidad.
                                💚🧡
                            </p>
                        </section>
                    </>

                ) : seccion === 'emprendedoras' ? (

                    /* MÓDULO EMPRENDEDORES/AS */
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
