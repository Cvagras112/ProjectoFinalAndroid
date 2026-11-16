import BotonListaPersonal from './perfil/BotonListaPersonal'
import { listaFavoritos } from '../services/productos/favoritosService'

export default function BotonFavorito({ productoId, className = 'bora-boton-favorito' }) {
  return <BotonListaPersonal lista={listaFavoritos} id={productoId} tipo="favorito" className={className} />
}
