import { useState } from 'react'

const RESPALDO_LOCAL = '/imagenes/Icono_BORA.png'

export default function ImagenPublica({ src, respaldo = RESPALDO_LOCAL, alt, ...props }) {
  const [fallida, setFallida] = useState(null)
  const origen = src || respaldo
  const actual = fallida === origen ? respaldo : origen

  return (
    <img
      {...props}
      src={actual}
      alt={alt}
      onError={() => {
        if (actual !== respaldo) setFallida(origen)
      }}
    />
  )
}
