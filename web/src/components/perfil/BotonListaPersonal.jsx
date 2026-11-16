import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useListaPersonal } from '../../hooks/useListaPersonal'
import './ListasPersonales.css'

export default function BotonListaPersonal({ lista, id, tipo, className }) {
  const navigate = useNavigate()
  const estado = useListaPersonal(lista)
  const [fallo, setFallo] = useState(null)
  const valido = typeof id === 'string' && Boolean(id.trim()) && !id.includes('/')
  const marcado = estado.registros.some(r => r.id === id)
  const guardando = estado.pendientes.includes(id)
  const cargando = estado.estado === 'cargando'
  const permitido = ['autorizado', 'sin-sesion'].includes(estado.estado)
  const mensajeError = estado.error || (fallo?.sesion === estado.sesion && fallo?.id === id ? fallo.mensaje : '')
  const favorito = tipo === 'favorito'
  const etiqueta = !valido ? 'Este producto de muestra no se puede guardar.' : cargando ? 'Comprobando tu lista…'
    : estado.estado === 'sin-sesion' ? `Inicia sesión para ${favorito ? 'guardar favoritos' : 'seguir esta tienda'}`
      : estado.estado === 'sin-permiso' ? 'Necesitas una cuenta activa de comprador o emprendedor.'
        : guardando ? 'Guardando…' : favorito ? (marcado ? 'Quitar de favoritos' : 'Agregar a favoritos')
          : marcado ? 'Dejar de seguir tienda' : 'Seguir tienda'

  async function cambiar() {
    if (estado.estado === 'sin-sesion') { navigate('/login'); return }
    if (!valido || !permitido || cargando || guardando) return
    setFallo(null)
    try {
      await (marcado ? lista.quitar(id) : lista.agregar(id))
    } catch {
      if (lista.leerEstado().sesion === estado.sesion) setFallo({ sesion: estado.sesion, id, mensaje: 'No pudimos guardar el cambio. Inténtalo nuevamente.' })
    }
  }

  return (
    <>
      <button type="button" className={`${className} ${marcado ? 'activo' : ''}`} onClick={cambiar}
        disabled={!valido || !permitido || cargando || guardando} aria-pressed={marcado} aria-label={etiqueta} title={etiqueta}>
        {favorito ? (guardando ? '…' : marcado ? '♥' : '♡') : cargando ? 'Comprobando seguimiento…' : guardando ? 'Guardando…' : marcado ? '♥ Siguiendo' : estado.estado === 'sin-sesion' ? '♡ Inicia sesión para seguir' : '♡ Seguir tienda'}
      </button>
      {mensajeError && <span className="bora-lista-error" role="alert">{mensajeError}{' '}<button type="button" onClick={() => { setFallo(null); lista.reintentar() }}>Reintentar</button></span>}
    </>
  )
}
