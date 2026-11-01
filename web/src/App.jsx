
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/public/Home'
import Ayuda from './pages/public/Ayuda'
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
        <Route path="/" element={<Home />} />

        <Route
          path="/productos"
          element={<PaginaPendiente titulo="Explorar productos" />}
        />

        <Route
          path="/tiendas"
          element={<PaginaPendiente titulo="Emprendimientos" />}
        />

        <Route path="/ayuda" element={<Ayuda />} />

        <Route
          path="/login"
          element={<PaginaPendiente titulo="Iniciar sesión" />}
        />

        <Route
          path="*"
          element={<PaginaPendiente titulo="Página no encontrada" />}
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
