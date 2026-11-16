function texto(valor) {
  return typeof valor === 'string' ? valor.trim() : ''
}

function imagenPublica(valor) {
  const url = texto(valor)
  try {
    return ['https:', 'http:'].includes(new URL(url).protocol) ? url : ''
  } catch {
    return ''
  }
}

export function normalizarTiendaPublica(datos) {
  if (!datos || datos.activo !== true) return null
  return {
    id: datos.id,
    nombre: texto(datos.nombre) || 'Emprendimiento BORA',
    imagen: imagenPublica(datos.imagen),
    portada: imagenPublica(datos.portada),
    descripcion: texto(datos.descripcion) || 'Descripción no disponible.',
    categoria: texto(datos.categoria) || 'Tipo de emprendimiento no informado',
    sector: texto(datos.sector) || 'Sector no informado',
    telefono: texto(datos.telefono),
    whatsapp: texto(datos.whatsapp),
    emailContacto: texto(datos.emailContacto),
  }
}

export function numeroContacto(valor) {
  const digitos = texto(valor).replace(/\D/g, '')
  if (/^9\d{8}$/.test(digitos)) return `56${digitos}`
  return /^56\d{9}$/.test(digitos) ? digitos : ''
}

export function correoContacto(valor) {
  const correo = texto(valor)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) ? correo : ''
}
