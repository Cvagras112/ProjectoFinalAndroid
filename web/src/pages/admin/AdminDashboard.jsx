
import { useState } from 'react'
import './AdminDashboard.css'

function AdminDashboard() {
  const [seccion, setSeccion] = useState('dashboard')

  const opciones = [
    { id: 'dashboard', nombre: 'Panel principal' },
    { id: 'emprendedoras', nombre: 'Emprendedoras' },
    { id: 'asociaciones', nombre: 'Asociaciones' },
    { id: 'asignaciones', nombre: 'Asignaciones' },
    { id: 'categorias', nombre: 'Categorías' },
    { id: 'tipos', nombre: 'Tipos de productos' }
  ]

  return (
    <div className="bora-admin">

      <aside className="bora-sidebar">
        <div className="bora-logo">BORA</div>
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

      <main className="bora-content">
        <header className="bora-header">
          <h1>
            {opciones.find(
              (opcion) => opcion.id === seccion
            )?.nombre}
          </h1>
          <p>
            Administración de la plataforma BORA
          </p>
        </header>

        {seccion === 'dashboard' ? (
          <section className="bora-cards">
            <article className="bora-card">
              <h3>Emprendedoras</h3>
              <div className="value">—</div>
            </article>

            <article className="bora-card">
              <h3>Asociaciones</h3>
              <div className="value">—</div>
            </article>

            <article className="bora-card">
              <h3>Categorías</h3>
              <div className="value">—</div>
            </article>

            <article className="bora-card">
              <h3>Tipos de productos</h3>
              <div className="value">—</div>
            </article>
          </section>
        ) : (
          <section className="bora-card">
            <h3>
              Gestión de {
                opciones.find(
                  (opcion) => opcion.id === seccion
                )?.nombre
              }
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
