
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../firebase/config'

import './AdminDashboard.css'

import EmprendedorasAdmin from './EmprendedorasAdmin'
import SolicitudesAdmin from './SolicitudesAdmin'
import AsociacionesAdmin from './AsociacionesAdmin'
import AsignacionesAdmin from './AsignacionesAdmin'
import CategoriasAdmin from './CategoriasAdmin'
import TiposProductosAdmin from './TiposProductosAdmin'

function AdminDashboard() {
  const [seccion, setSeccion] = useState('dashboard')

  const [emprendedoras, setEmprendedoras] = useState([])
  const [asociaciones, setAsociaciones] = useState([])
  const [asignaciones, setAsignaciones] = useState([])
  const [categorias, setCategorias] = useState([])
  const [tiposProductos, setTiposProductos] = useState([])

  const [cargandoEmprendedoras, setCargandoEmprendedoras] =
    useState(true)
  const [errorEmprendedoras, setErrorEmprendedoras] = useState('')

  useEffect(() => {
    let activo = true

    async function cargarEmprendedoras() {
      try {
        setCargandoEmprendedoras(true)
        setErrorEmprendedoras('')

        const [
          resultadoEmprendedores,
          resultadoTiendas,
          resultadoUsuarios,
        ] = await Promise.all([
          getDocs(collection(db, 'emprendedores')),
          getDocs(collection(db, 'tiendas')),
          getDocs(collection(db, 'usuarios')),
        ])

        const tiendas = {}

        resultadoTiendas.docs.forEach((documento) => {
          tiendas[documento.id] = documento.data()
        })

        const usuarios = {}

        resultadoUsuarios.docs.forEach((documento) => {
          usuarios[documento.id] = documento.data()
        })

        const datos = resultadoEmprendedores.docs.map((documento) => {
          const emprendedora = documento.data()
          const usuario = usuarios[documento.id]

          const tiendaId =
            emprendedora.ID_Tienda ||
            emprendedora.idTienda ||
            ''

          const tienda = tiendas[tiendaId]

          return {
            id: documento.id,
            nombre: emprendedora.nombre || 'Sin nombre',

            correo:
              usuario?.email ||
              emprendedora.email ||
              '',

            telefono: emprendedora.telefono || '',

            emprendimiento:
              tienda?.nombre || 'Sin tienda asociada',

            tiendaId,

            estado:
              emprendedora.activo === false
                ? 'Inactiva'
                : 'Activa',
          }
        })

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
  }, [])

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
      id: 'asignaciones',
      nombre: 'Asignaciones',
      icono: '📋',
    },
    {
      id: 'categorias',
      nombre: 'Categorías',
      icono: '🏷️',
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
        ) : seccion === 'tipos' ? (
          <TiposProductosAdmin
            tipos={tiposProductos}
            setTipos={setTiposProductos}
          />
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
