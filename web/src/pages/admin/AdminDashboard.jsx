
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listarCategorias, listarTiposEmprendimiento, listarTiposProductos } from '../../repositories/admin/catalogosRepository'
import { listarAsociaciones } from '../../repositories/admin/asociacionesRepository'
import { listarAsignaciones } from '../../repositories/admin/asignacionesRepository'
import { listarEmprendedoras } from '../../repositories/admin/emprendedorasRepository'

import './AdminDashboard.css'

import EmprendedorasAdmin from './EmprendedorasAdmin'
import SolicitudesAdmin from './SolicitudesAdmin'
import AsociacionesAdmin from './AsociacionesAdmin'
import AsignacionesAdmin from './AsignacionesAdmin'
import CategoriasAdmin from './CategoriasAdmin'
import TiposProductosAdmin from './TiposProductosAdmin'
import TiposEmprendimientoAdmin from './TiposEmprendimientoAdmin'
import AdministradoresAdmin from './AdministradoresAdmin'
import BitacoraAdmin from './BitacoraAdmin'

function AdminDashboard() {
  const [seccion, setSeccion] = useState('dashboard')

  const [emprendedoras, setEmprendedoras] = useState([])
  const [asociaciones, setAsociaciones] = useState([])
  const [asignaciones, setAsignaciones] = useState([])
  const [categorias, setCategorias] = useState([])

  // CARGA FIREBASE CATEGORIAS
  useEffect(() => {
    let activo = true

    async function cargarCategorias() {
      try {
        const datos = await listarCategorias()

        if (activo) {
          setCategorias(datos)
        }
      } catch (error) {
        console.error('Error cargando categorías:', error)
      }
    }

    cargarCategorias()

    return () => {
      activo = false
    }
  }, [])
  const [tiposProductos, setTiposProductos] = useState([])
  const [tiposEmprendimiento, setTiposEmprendimiento] = useState([])

  useEffect(() => {
    let activo = true

    async function cargarTiposEmprendimiento() {
      try {
        const datos = await listarTiposEmprendimiento()

        if (activo) {
          setTiposEmprendimiento(datos)
        }
      } catch (error) {
        console.error('Error cargando tipos de emprendimiento:', error)
      }
    }

    cargarTiposEmprendimiento()

    return () => {
      activo = false
    }
  }, [])

  // CARGA FIREBASE TIPOS PRODUCTOS
  useEffect(() => {
    let activo = true

    async function cargarTiposProductos() {
      try {
        const datos = await listarTiposProductos()

        if (activo) {
          setTiposProductos(datos)
        }
      } catch (error) {
        console.error('Error cargando tipos de productos:', error)
      }
    }

    cargarTiposProductos()

    return () => {
      activo = false
    }
  }, [])

  useEffect(() => {
    let activo = true

    async function cargarDatosAdministrativos() {
      try {
        const [resultadoAsociaciones, resultadoAsignaciones] =
          await Promise.all([
            listarAsociaciones(),
            listarAsignaciones()
          ])

        if (!activo) return

        setAsociaciones(resultadoAsociaciones)
        setAsignaciones(resultadoAsignaciones)
      } catch (error) {
        console.error('Error cargando asociaciones y asignaciones:', error)
      }
    }

    cargarDatosAdministrativos()

    return () => {
      activo = false
    }
  }, [seccion])

  const [cargandoEmprendedoras, setCargandoEmprendedoras] =
    useState(true)
  const [errorEmprendedoras, setErrorEmprendedoras] = useState('')

  useEffect(() => {
    let activo = true

    async function cargarEmprendedoras() {
      try {
        setCargandoEmprendedoras(true)
        setErrorEmprendedoras('')

        const datos = await listarEmprendedoras()

        if (activo) {
          setEmprendedoras(datos)
        }
      } catch (error) {
        console.error('Error al cargar emprendedoras:', error)

        if (activo) {
          setErrorEmprendedoras(
            'No fue posible cargar los emprendedores o usuarios desde Firebase.'
          )
        }
      } finally {
        if (activo) {
          setCargandoEmprendedoras(false)
        }
      }
    }

    cargarEmprendedoras()

    return () => {
      activo = false
    }
  }, [seccion])

  const opciones = [
    {
      id: 'dashboard',
      nombre: 'Panel principal',
      icono: '🏠',
    },
    {
      id: 'emprendedoras',
      nombre: 'Emprendedores/as',
      icono: '👩‍💼',
    },
    {
      id: 'solicitudes',
      nombre: 'Solicitudes de emprendedores',
      icono: '📩',
    },
    {
      id: 'asociaciones',
      nombre: 'Asociaciones',
      icono: '🤝',
    },
    {
      id: 'categorias',
      nombre: 'Categorías',
      icono: '🏷️',
    },
    {
      id: 'asignaciones',
      nombre: 'Asignaciones',
      icono: '🔗',
    },
    {
      id: 'tipos-emprendimiento',
      nombre: 'Tipos de emprendimiento',
      icono: '🏪',
    },
    {
      id: 'administradores',
      nombre: 'Administradores',
      icono: '🛡️',
    },
    {
      id: 'bitacora',
      nombre: 'Bitácora',
      icono: '▤',
    },
    {
      id: 'tipos',
      nombre: 'Tipos de productos',
      icono: '📦',
    },
  ]

  const obtenerNombreSeccion = () =>
    opciones.find((opcion) => opcion.id === seccion)?.nombre ||
    'Administración'

  const estadisticas = [
    {
      titulo: 'Emprendedores/as',
      valor: cargandoEmprendedoras
        ? '...'
        : emprendedoras.length,
      icono: '🧑‍🎨',
      descripcion: 'Perfiles registrados',
    },
    {
      titulo: 'Asociaciones',
      valor: asociaciones.length,
      icono: '🤝',
      descripcion: 'Organizaciones registradas',
    },
    {
      titulo: 'Categorías',
      valor: categorias.length,
      icono: '🏷️',
      descripcion: 'Categorías disponibles',
    },
    {
      titulo: 'Tipos de productos',
      valor: tiposProductos.length,
      icono: '📦',
      descripcion: 'Tipos registrados',
    },
  ]

  return (
    <div className="bora-admin">
      {/* MENÚ LATERAL */}
      <aside className="bora-sidebar">
        <div className="bora-logo">🛍️ BORA</div>

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

        <Link to="/" className="bora-volver-inicio">
          <span aria-hidden="true">🏠</span>
          Volver al inicio
        </Link>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="bora-content">
        <header className="bora-header">
          {seccion === 'dashboard' ? (
            <>
              <h1>✨ ¡Bienvenido al panel BORA!</h1>
              <p>
                Administra tu comunidad de emprendedores,
                asociaciones y productos desde un solo lugar. 💚
              </p>
            </>
          ) : (
            <>
              <h1>
                {
                  opciones.find(
                    (opcion) => opcion.id === seccion
                  )?.icono
                }{' '}
                {obtenerNombreSeccion()}
              </h1>
              <p>🛠️ Gestión y administración de BORA</p>
            </>
          )}
        </header>

        {errorEmprendedoras && (
          <p
            role="alert"
            style={{
              padding: '14px',
              background: '#fff1e9',
              borderRadius: '10px',
              color: '#a43d25',
              marginBottom: '20px',
            }}
          >
            ⚠️ {errorEmprendedoras}
          </p>
        )}

        {seccion === 'dashboard' ? (
          <>
            {/* ACCESOS RÁPIDOS */}
            <section className="bora-acciones">
              <h2>🚀 Accesos rápidos</h2>

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
                    setSeccion('solicitudes')
                  }
                >
                  📩 Revisar solicitudes
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

            {/* ESTADÍSTICAS */}
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
                      marginBottom: '12px',
                    }}
                    aria-hidden="true"
                  >
                    {estadistica.icono}
                  </div>

                  <h3>{estadistica.titulo}</h3>

                  <div className="value">
                    {estadistica.valor}
                  </div>

                  <p
                    style={{
                      fontSize: '12px',
                      color: '#69736D',
                      marginTop: '8px',
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
                border: '1px solid #DCEBDD',
              }}
            >
              <h2
                style={{
                  color: '#194C36',
                  fontSize: '18px',
                  marginBottom: '10px',
                }}
              >
                🌿 Una comunidad que crece
              </h2>

              <p
                style={{
                  color: '#52665B',
                  lineHeight: '1.7',
                  fontSize: '14px',
                }}
              >
                BORA conecta a emprendedores y
                emprendedoras con nuevas oportunidades.
                Desde este espacio podrás organizar la
                información de la plataforma y apoyar el
                crecimiento de la comunidad. 💚🧡
              </p>
            </section>
          </>
        ) : seccion === 'emprendedoras' ? (
          <EmprendedorasAdmin
            emprendedoras={emprendedoras}
            setEmprendedoras={setEmprendedoras}
            asociaciones={asociaciones}
            asignaciones={asignaciones}
          />
        ) : seccion === 'solicitudes' ? (
          <SolicitudesAdmin />
        ) : seccion === 'asociaciones' ? (
          <AsociacionesAdmin
            asociaciones={asociaciones}
            setAsociaciones={setAsociaciones}
          />
        ) : seccion === 'asignaciones' ? (
          <AsignacionesAdmin
            emprendedoras={emprendedoras}
            setEmprendedoras={setEmprendedoras}
            asociaciones={asociaciones}
            asignaciones={asignaciones}
            setAsignaciones={setAsignaciones}
          />
        ) : seccion === 'categorias' ? (
          <CategoriasAdmin
            categorias={categorias}
            setCategorias={setCategorias}
          />
        ) : seccion === 'tipos-emprendimiento' ? (
          <TiposEmprendimientoAdmin
            categorias={tiposEmprendimiento}
            setCategorias={setTiposEmprendimiento}
          />
        ) : seccion === 'tipos' ? (
          <TiposProductosAdmin
            categorias={tiposProductos}
            setCategorias={setTiposProductos}
          />
        ) : seccion === 'bitacora' ? (
          <BitacoraAdmin />
        ) : seccion === 'administradores' ? (
          <AdministradoresAdmin />
        ) : (
          <section className="bora-card">
            <h3>Gestión de {obtenerNombreSeccion()}</h3>
            <p>Módulo pendiente de implementación.</p>
          </section>
        )}
      </main>
    </div>
  )
}

export default AdminDashboard
