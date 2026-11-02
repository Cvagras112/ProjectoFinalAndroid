
import { useEffect, useState } from 'react'

const CLAVE_FAVORITOS = 'bora-favoritos'

function obtenerFavoritos() {
  try {
    const guardados = JSON.parse(
      localStorage.getItem(CLAVE_FAVORITOS) || '[]'
    )

    return Array.isArray(guardados) ? guardados : []
  } catch {
    return []
  }
}

export default function BotonFavorito({ productoId }) {
  const [esFavorito, setEsFavorito] = useState(() =>
    obtenerFavoritos().some(
      (id) => String(id) === String(productoId)
    )
  )

  useEffect(() => {
    function sincronizarFavoritos() {
      setEsFavorito(
        obtenerFavoritos().some(
          (id) => String(id) === String(productoId)
        )
      )
    }

    window.addEventListener('storage', sincronizarFavoritos)
    window.addEventListener('bora:favoritos', sincronizarFavoritos)

    return () => {
      window.removeEventListener('storage', sincronizarFavoritos)
      window.removeEventListener('bora:favoritos', sincronizarFavoritos)
    }
  }, [productoId])

  function cambiarFavorito() {
    const favoritos = obtenerFavoritos()

    const existe = favoritos.some(
      (id) => String(id) === String(productoId)
    )

    const actualizados = existe
      ? favoritos.filter(
          (id) => String(id) !== String(productoId)
        )
      : [...favoritos, productoId]

    try {
      localStorage.setItem(
        CLAVE_FAVORITOS,
        JSON.stringify(actualizados)
      )

      setEsFavorito(!existe)
      window.dispatchEvent(new Event('bora:favoritos'))
    } catch {
      window.alert('No se pudo guardar el favorito.')
    }
  }

  return (
    <button
      type="button"
      className={`bora-boton-favorito ${
        esFavorito ? 'activo' : ''
      }`}
      onClick={cambiarFavorito}
      aria-label={
        esFavorito
          ? 'Quitar de favoritos'
          : 'Agregar a favoritos'
      }
      aria-pressed={esFavorito}
      title={
        esFavorito
          ? 'Quitar de favoritos'
          : 'Agregar a favoritos'
      }
    >
      {esFavorito ? '♥' : '♡'}
    </button>
  )
}
