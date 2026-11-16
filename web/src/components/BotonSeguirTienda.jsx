import BotonListaPersonal from './perfil/BotonListaPersonal'
import { listaSeguimientos } from '../services/tiendas/seguimientoService'

export default function BotonSeguirTienda({ tiendaId }) {
  return <BotonListaPersonal lista={listaSeguimientos} id={tiendaId} tipo="tienda" className="bora-tienda-compartir" />
}
