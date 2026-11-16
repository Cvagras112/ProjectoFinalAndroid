import { collection, documentId, getDocs, limit, orderBy, query, startAfter, where } from 'firebase/firestore'
import { db } from '../../firebase/config'

const camposIdentificador = ['operacionId', 'actorUid', 'elementoId', 'destinatarioUid']
const texto = valor => typeof valor === 'string' ? valor : ''

export function normalizarEventoAuditoria(documento) {
  const dato = documento.data()
  const administradorAntiguo = typeof dato.accion === 'string' && dato.accion.startsWith('administrador.')
  const fecha = dato.fecha?.toDate instanceof Function ? dato.fecha.toDate() : null
  // Proyección explícita: nunca devolver contraseñas, tokens ni payloads completos.
  return {
    id: documento.id,
    fecha: fecha instanceof Date && Number.isFinite(fecha.getTime()) ? fecha : null,
    actorUid: texto(dato.actorUid),
    accion: texto(dato.accion),
    elementoTipo: texto(dato.elementoTipo) || (administradorAntiguo ? 'administrador' : ''),
    elementoId: texto(dato.elementoId) || texto(dato.destinatarioUid),
    resultado: texto(dato.resultado),
    operacionId: texto(dato.operacionId),
    fase: texto(dato.fase),
  }
}

function fechaLimite(valor, siguienteDia = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw new Error('Fecha inválida.')
  const fecha = new Date(`${valor}T00:00:00`)
  if (!Number.isFinite(fecha.getTime()) || fecha.getFullYear() !== Number(valor.slice(0, 4)) ||
      fecha.getMonth() + 1 !== Number(valor.slice(5, 7)) || fecha.getDate() !== Number(valor.slice(8, 10))) {
    throw new Error('Fecha inválida.')
  }
  if (siguienteDia) fecha.setDate(fecha.getDate() + 1)
  return fecha
}

export async function consultarAuditoria(filtros = {}, cursor = null, tamano = 20) {
  if (!Number.isInteger(tamano) || tamano < 1 || tamano > 100) throw new Error('Tamaño de página inválido.')
  const condiciones = []
  if (filtros.accion) condiciones.push(where('accion', '==', filtros.accion.trim()))
  if (filtros.resultado) condiciones.push(where('resultado', '==', filtros.resultado))
  if (filtros.desde) condiciones.push(where('fecha', '>=', fechaLimite(filtros.desde)))
  if (filtros.hasta) condiciones.push(where('fecha', '<', fechaLimite(filtros.hasta, true)))
  if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) throw new Error('La fecha inicial debe ser anterior o igual a la final.')
  if (filtros.identificador?.trim()) {
    if (!camposIdentificador.includes(filtros.campoIdentificador)) throw new Error('Campo de búsqueda inválido.')
    condiciones.push(where(filtros.campoIdentificador, '==', filtros.identificador.trim()))
  }
  condiciones.push(orderBy('fecha', 'desc'), orderBy(documentId(), 'desc'))
  if (cursor) condiciones.push(startAfter(cursor))
  // Un documento adicional permite saber si existe otra página sin contar todo.
  condiciones.push(limit(tamano + 1))
  const resultado = await getDocs(query(collection(db, 'auditoria_administrativa'), ...condiciones))
  const documentos = resultado.docs.slice(0, tamano)
  return {
    eventos: documentos.map(normalizarEventoAuditoria),
    siguienteCursor: documentos.at(-1) || null,
    hayMas: resultado.docs.length > tamano,
  }
}
