import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'

export function useListaPersonal(lista) {
  return useSyncExternalStore(lista.suscribir, lista.leerEstado, lista.leerServidor)
}

export function useDetallesLista(lista, cargarDetalles) {
  const estado = useListaPersonal(lista)
  const [resultado, setResultado] = useState({ clave: '', detalles: [], error: '' })
  const [intento, setIntento] = useState(0)
  // Resolver detalles solo cuando cambia la lista de IDs, no al confirmarse su fecha.
  const firma = JSON.stringify(estado.registros.map(r => r.id))
  const ids = useMemo(() => JSON.parse(firma), [firma])
  const autorizado = estado.estado === 'autorizado'
  const clave = `${estado.uid}:${estado.sesion}:${JSON.stringify(ids)}:${intento}`
  useEffect(() => {
    if (!autorizado) return
    let vigente = true
    cargarDetalles(ids).then(detalles => {
      if (vigente) setResultado({ clave, detalles, error: '' })
    }).catch(() => {
      if (vigente) setResultado({ clave, detalles: [], error: 'No pudimos cargar los datos de tu lista. Inténtalo nuevamente.' })
    })
    return () => { vigente = false }
  }, [clave, ids, autorizado, cargarDetalles])
  return {
    ...estado,
    detalles: autorizado && resultado.clave === clave ? resultado.detalles : [],
    cargando: estado.estado === 'cargando' || (autorizado && resultado.clave !== clave),
    error: estado.error || (autorizado && resultado.clave === clave ? resultado.error : ''),
    reintentar: () => estado.estado === 'error' ? lista.reintentar() : setIntento(i => i + 1),
  }
}
