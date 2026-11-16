import { Link } from 'react-router-dom'

export default function AccesoListaPersonal({ estado }) {
  return (
    <main className="bora-favoritos">
      <div className="bora-favoritos-vacio">
        <h1>{estado === 'sin-sesion' ? 'Inicia sesión' : 'Acceso restringido'}</h1>
        <p>{estado === 'sin-sesion' ? 'Inicia sesión para consultar tus favoritos y tiendas seguidas.' : 'Necesitas una cuenta activa de comprador o emprendedor para usar tus listas.'}</p>
        <Link to="/login">Ir a iniciar sesión</Link>
      </div>
    </main>
  )
}
