import { useEffect, useState } from 'react'
import { consultarAuditoria } from '../../repositories/admin/auditoriaRepository'
import './BitacoraAdmin.css'

const filtrosVacios = { accion: '', resultado: '', desde: '', hasta: '', campoIdentificador: 'operacionId', identificador: '' }
const acciones = {
  'administrador.cambiar_password': 'Cambio de contraseña de administrador',
}
const resultados = {
  exito: 'Éxito', iniciado: 'Iniciado', rechazado: 'Rechazado', fallo: 'Fallo',
  incierto: 'Incierto', password_cambiada_revocacion_pendiente: 'Contraseña cambiada; revocación pendiente',
}
const etiqueta = (opciones, valor, vacio) => Object.hasOwn(opciones, valor) ? opciones[valor] : valor || vacio
const formatearFecha = fecha => fecha && Number.isFinite(fecha.getTime())
  ? new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'medium' }).format(fecha) : 'Sin fecha válida'

function BitacoraAdmin() {
  const [borrador, setBorrador] = useState(filtrosVacios)
  const [consulta, setConsulta] = useState({ filtros: filtrosVacios, cursor: null, pagina: 0 })
  const [cursores, setCursores] = useState([null])
  const [datos, setDatos] = useState({ eventos: [], hayMas: false, siguienteCursor: null })
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let vigente = true
    consultarAuditoria(consulta.filtros, consulta.cursor).then(resultado => {
      if (vigente) setDatos(resultado)
    }).catch(fallo => {
      if (!vigente) return
      setDatos({ eventos: [], hayMas: false, siguienteCursor: null })
      setError(fallo.code === 'permission-denied'
        ? 'Acceso denegado. Solo los administradores activos pueden consultar la bitácora.'
        : fallo.code === 'failed-precondition'
          ? 'Esta combinación de filtros requiere un índice de Firestore que aún no está disponible. Prueba con menos filtros.'
          : 'No se pudo consultar la bitácora. Revisa la conexión, las fechas y vuelve a intentarlo.')
    }).finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
  }, [consulta])

  const cambiarFiltro = e => setBorrador(anterior => ({ ...anterior, [e.target.name]: e.target.value }))
  const cargar = (filtros, cursor, pagina) => {
    setCargando(true)
    setError('')
    setDatos({ eventos: [], hayMas: false, siguienteCursor: null })
    setConsulta({ filtros, cursor, pagina })
  }
  const aplicar = e => {
    e.preventDefault()
    if (borrador.desde && borrador.hasta && borrador.desde > borrador.hasta) {
      setError('La fecha inicial debe ser anterior o igual a la final.')
      return
    }
    setCursores([null])
    cargar({ ...borrador, accion: borrador.accion.trim(), identificador: borrador.identificador.trim() }, null, 0)
  }
  const siguiente = () => {
    const pagina = consulta.pagina + 1
    setCursores(anterior => [...anterior.slice(0, pagina), datos.siguienteCursor])
    cargar(consulta.filtros, datos.siguienteCursor, pagina)
  }

  return (
    <section className="bora-bitacora" aria-labelledby="bitacora-titulo" aria-busy={cargando}>
      <header className="bora-bitacora__cabecera">
        <div><span className="bora-bitacora__etiqueta">ACTIVIDAD ADMINISTRATIVA</span>
          <h2 id="bitacora-titulo">Bitácora</h2>
          <p>Consulta los eventos registrados por el backend. Cada intento y resultado se muestra por separado.</p>
        </div>
        <button type="button" disabled={cargando} onClick={() => { setCursores([null]); cargar(consulta.filtros, null, 0) }}>Actualizar</button>
      </header>

      <form className="bora-bitacora__filtros" onSubmit={aplicar}>
        <div><label htmlFor="bitacora-accion">Acción</label>
          <input id="bitacora-accion" name="accion" list="bitacora-acciones" value={borrador.accion} onChange={cambiarFiltro} placeholder="Todas las acciones" maxLength={150} />
          <datalist id="bitacora-acciones">{Object.entries(acciones).map(([codigo, nombre]) => <option key={codigo} value={codigo}>{nombre}</option>)}</datalist>
        </div>
        <div><label htmlFor="bitacora-resultado">Resultado</label>
          <select id="bitacora-resultado" name="resultado" value={borrador.resultado} onChange={cambiarFiltro}>
            <option value="">Todos los resultados</option>
            {Object.entries(resultados).map(([codigo, nombre]) => <option key={codigo} value={codigo}>{nombre}</option>)}
          </select>
        </div>
        <div><label htmlFor="bitacora-desde">Desde</label><input id="bitacora-desde" name="desde" type="date" value={borrador.desde} onChange={cambiarFiltro} /></div>
        <div><label htmlFor="bitacora-hasta">Hasta</label><input id="bitacora-hasta" name="hasta" type="date" value={borrador.hasta} onChange={cambiarFiltro} /></div>
        <div><label htmlFor="bitacora-campo">Buscar por</label>
          <select id="bitacora-campo" name="campoIdentificador" value={borrador.campoIdentificador} onChange={cambiarFiltro}>
            <option value="operacionId">ID de operación</option><option value="actorUid">UID del administrador</option>
            <option value="elementoId">ID de elemento</option><option value="destinatarioUid">UID del destinatario (registros anteriores)</option>
          </select>
        </div>
        <div><label htmlFor="bitacora-identificador">Identificador exacto</label><input id="bitacora-identificador" name="identificador" value={borrador.identificador} onChange={cambiarFiltro} placeholder="Coincidencia exacta" maxLength={150} /></div>
        <div className="bora-bitacora__botones">
          <button type="submit" disabled={cargando}>Aplicar filtros</button>
          <button type="button" className="bora-bitacora__secundario" disabled={cargando} onClick={() => { setBorrador(filtrosVacios); setCursores([null]); cargar(filtrosVacios, null, 0) }}>Limpiar filtros</button>
        </div>
      </form>
      <p className="bora-bitacora__nota">Fechas en tu zona horaria local. Los filtros se aplican a toda la colección. Para eventos anteriores usa la búsqueda por destinatario.</p>
      {cargando && <p className="bora-bitacora__estado" role="status">Consultando actividad…</p>}
      {error && <p className="bora-bitacora__error" role="alert">{error}</p>}
      {!cargando && !error && datos.eventos.length === 0 && <p className="bora-bitacora__estado" role="status">No hay registros para esta consulta.</p>}
      {!cargando && !error && datos.eventos.length > 0 && (
        <div className="bora-bitacora__tabla" role="region" aria-label="Eventos administrativos" tabIndex={0}>
          <table><caption>Eventos registrados, del más reciente al más antiguo</caption>
            <thead><tr><th scope="col">Fecha y hora</th><th scope="col">Administrador</th><th scope="col">Acción</th><th scope="col">Elemento afectado</th><th scope="col">Resultado</th><th scope="col">Operación</th></tr></thead>
            <tbody>{datos.eventos.map(evento => (
              <tr key={evento.id}>
                <td>{evento.fecha ? <time dateTime={evento.fecha.toISOString()}>{formatearFecha(evento.fecha)}</time> : 'Sin fecha válida'}</td>
                <td><code>{evento.actorUid || 'Identidad no verificada'}</code></td>
                <td>{etiqueta(acciones, evento.accion, 'Sin acción')}{evento.fase && <small>{evento.fase === 'intento' ? 'Intento' : evento.fase === 'resultado' ? 'Resultado' : evento.fase}</small>}</td>
                <td>{evento.elementoTipo || 'Sin tipo'}<code>{evento.elementoId || 'Sin identificador'}</code></td>
                <td><span className={`bora-bitacora__resultado ${evento.resultado === 'exito' ? 'bora-bitacora__resultado--exito' : ''}`}>{etiqueta(resultados, evento.resultado, 'Sin resultado')}</span></td>
                <td><code>{evento.operacionId || 'Sin identificador'}</code></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <nav className="bora-bitacora__paginacion" aria-label="Páginas de la bitácora">
        <button type="button" disabled={cargando || consulta.pagina === 0} onClick={() => cargar(consulta.filtros, cursores[consulta.pagina - 1], consulta.pagina - 1)}>Anterior</button>
        <span aria-live="polite">Página {consulta.pagina + 1}{!cargando && !error ? ` · ${datos.eventos.length} eventos` : ''}</span>
        <button type="button" disabled={cargando || Boolean(error) || !datos.hayMas} onClick={siguiente}>Siguiente</button>
      </nav>
    </section>
  )
}

export default BitacoraAdmin
