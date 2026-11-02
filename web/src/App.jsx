
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import Navbar from './components/Navbar'

import Home from './pages/public/Home'
import Productos from './pages/public/Productos'
import ProductoDetalle from './pages/public/ProductoDetalle'
import Ayuda from './pages/public/Ayuda'

import Login from './pages/auth/Login'
import Registro from './pages/auth/Registro'
import RecuperarContrasena from './pages/auth/RecuperarContrasena'

import './App.css'

function PaginaPendiente({ titulo }) {
  return (
    <main>
      <h1>{titulo}</h1>
      <p>Estamos preparando esta sección de BORA.</p>
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

        {/* CATÁLOGO DE PRODUCTOS */}
        <Route path="/productos" element={<Productos />} />

        {/* DETALLE INDIVIDUAL DE CADA PRODUCTO */}
        <Route
          path="/productos/:id"
          element={<ProductoDetalle />}
        />

        {/* EMPRENDIMIENTOS */}
        <Route
          path="/tiendas"
          element={<PaginaPendiente titulo="Emprendimientos" />}
        />

        {/* AYUDA */}
        <Route path="/ayuda" element={<Ayuda />} />

        {/* AUTENTICACIÓN */}
        <Route path="/login" element={<Login />} />

        <Route path="/registro" element={<Registro />} />

        <Route
          path="/recuperar"
          element={<RecuperarContrasena />}
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
