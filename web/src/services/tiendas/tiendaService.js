
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'

export async function obtenerTiendaEmprendedor(uid) {
  if (!uid) {
    throw new Error('Debes iniciar sesión para consultar tu tienda.')
  }

  const emprendedorRef = doc(db, 'emprendedores', uid)
  const emprendedorDoc = await getDoc(emprendedorRef)

  if (!emprendedorDoc.exists()) {
    throw new Error('No encontramos tu perfil de emprendedor.')
  }

  const emprendedor = emprendedorDoc.data()

  if (emprendedor.activo !== true) {
    throw new Error('Tu perfil de emprendedor no está activo.')
  }

  const tiendaId = emprendedor.ID_Tienda

  if (!tiendaId) {
    throw new Error('Tu perfil no tiene una tienda asociada.')
  }

  const tiendaRef = doc(db, 'tiendas', tiendaId)
  const tiendaDoc = await getDoc(tiendaRef)

  if (!tiendaDoc.exists()) {
    throw new Error('No encontramos tu tienda.')
  }

  const tienda = tiendaDoc.data()

  if (tienda.activo !== true || tienda.ID_Dueno !== uid) {
    throw new Error('No tienes acceso a esta tienda.')
  }

  return {
    id: tiendaDoc.id,
    ...tienda,
  }
}

function validarUrlImagen(valor, nombreCampo) {
  const urlTexto = String(valor || '').trim()

  if (urlTexto.length > 2000) {
    throw new Error(`La URL de ${nombreCampo} es demasiado larga.`)
  }

  if (!urlTexto) return ''

  try {
    const url = new URL(urlTexto)

    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Protocolo no permitido.')
    }
  } catch {
    throw new Error(`Ingresa una URL válida para ${nombreCampo}.`)
  }

  return urlTexto
}

export async function actualizarTiendaEmprendedor(uid, datos) {
  const tienda = await obtenerTiendaEmprendedor(uid)

  const nombre = String(datos.nombre || '').trim()
  const descripcion = String(datos.descripcion || '').trim()
  const categoria = String(datos.categoria || '').trim()
  const sector = String(datos.sector || '').trim()
  const telefono = String(datos.telefono || '').trim()
  const whatsapp = String(datos.whatsapp || '').trim()
  const emailContacto = String(datos.emailContacto || '').trim()

  const imagen = validarUrlImagen(datos.imagen, 'el logo')

  // Conservar la portada existente cuando un formulario
  // anterior todavía no envía este campo.
  const portada = validarUrlImagen(
    datos.portada ?? tienda.portada ?? '',
    'la portada'
  )

  if (!nombre || nombre.length > 150) {
    throw new Error('El nombre debe tener entre 1 y 150 caracteres.')
  }

  if (!categoria || categoria.length > 100) {
    throw new Error('Selecciona una categoría válida.')
  }

  if (descripcion.length > 2000) {
    throw new Error('La descripción no puede superar 2000 caracteres.')
  }

  if (sector.length > 100) {
    throw new Error('La comuna seleccionada no es válida.')
  }

  function validarTelefono(numero, campo) {
    if (!numero) return

    const digitos = numero.replace(/\D/g, '')

    if (!/^(?:9\d{8}|56\d{9})$/.test(digitos)) {
      throw new Error(
        `Ingresa un número válido para ${campo}. Ejemplo: +56 9 1234 5678.`
      )
    }
  }

  validarTelefono(telefono, 'teléfono')
  validarTelefono(whatsapp, 'WhatsApp')

  if (
    emailContacto &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailContacto)
  ) {
    throw new Error('Ingresa un correo electrónico válido.')
  }

  if (emailContacto.length > 254) {
    throw new Error('El correo electrónico es demasiado largo.')
  }

  const datosActualizados = {
    nombre,
    descripcion,
    categoria,
    sector,
    telefono,
    whatsapp,
    emailContacto,
    imagen,
    portada,
  }

  const tiendaRef = doc(db, 'tiendas', tienda.id)

  await updateDoc(tiendaRef, datosActualizados)

  return {
    ...tienda,
    ...datosActualizados,
  }
}
