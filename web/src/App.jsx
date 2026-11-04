
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import Navbar from './components/Navbar'
import RutaAdmin from './components/auth/RutaAdmin'

import Home from './pages/public/Home'
import Productos from './pages/public/Productos'
import ProductoDetalle from './pages/public/ProductoDetalle'
import Ayuda from './pages/public/Ayuda'
import Emprendimientos from './pages/public/Emprendimientos'
import TiendaDetalle from './pages/public/TiendaDetalle'

import Login from './pages/auth/Login'
import Registro from './pages/auth/Registro'
import RecuperarContrasena from './pages/auth/RecuperarContrasena'

import MiPerfil from './pages/perfil/MiPerfil'

// Panel administrativo desarrollado por David
import AdminDashboard from './pages/admin/AdminDashboard'

import './App.css'

function PaginaPendiente({ titulo, descripcion }) {
  return (
    <main
      style={{
        maxWidth: '1100px',
        margin: '70px auto',
        padding: '0 24px'
      }}
    >
      <h1>{titulo}</h1>
      <p>{descripcion || 'Estamos preparando esta sección de BORA.'}</p>
    </main>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Navbar />

      <Routes>
        {/* PÁGINA PRINCIPAL */}
        <Route path="/" element={<Home />} />

        {/* PRODUCTOS */}
        <Route path="/productos" element={<Productos />} />
        <Route path="/productos/:id" element={<ProductoDetalle />} />

        {/* EMPRENDIMIENTOS */}
        <Route path="/tiendas" element={<Emprendimientos />} />
        <Route path="/tiendas/:slug" element={<TiendaDetalle />} />

        {/* AYUDA */}
        <Route path="/ayuda" element={<Ayuda />} />

        {/* AUTENTICACIÓN */}
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        <Route
          path="/recuperar"
          element={<RecuperarContrasena />}
        />

        {/* PERFIL */}
        <Route path="/perfil" element={<MiPerfil />} />

        {/* PANEL ADMINISTRATIVO PROTEGIDO */}
        <Route
          path="/admin"
          element={
            <RutaAdmin>
              <AdminDashboard />
            </RutaAdmin>
          }
        />

        {/* PANEL DE EMPRENDEDOR/A - PENDIENTE */}
        <Route
          path="/panel-emprendedora"
          element={
            <PaginaPendiente
              titulo="Panel de emprendedor/a"
              descripcion="Aquí podrás administrar tu tienda y tus productos."
            />
          }
        />

        {/* PÁGINA NO ENCONTRADA */}
        <Route
          path="*"
          element={<PaginaPendiente titulo="Página no encontrada" />}
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
