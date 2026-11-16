import { collection, getDocs, doc, writeBatch } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { ejecutarOperacionEmprendedoras } from '../../services/admin/asignacionesEmprendedorasService'

export async function listarEmprendedoras() {
  const [
    resultadoEmprendedores,
    resultadoTiendas,
    resultadoUsuarios,
  ] = await Promise.all([
    getDocs(collection(db, 'emprendedores')),
    getDocs(collection(db, 'tiendas')),
    getDocs(collection(db, 'usuarios')),
  ])

  const tiendas = {}

  resultadoTiendas.docs.forEach((documento) => {
    tiendas[documento.id] = documento.data()
  })

  const usuarios = {}

  resultadoUsuarios.docs.forEach((documento) => {
    usuarios[documento.id] = documento.data()
  })

  const datos = resultadoEmprendedores.docs.map((documento) => {
    const emprendedora = documento.data()
    const usuario = usuarios[documento.id]

    const tiendaId =
      emprendedora.ID_Tienda ||
      emprendedora.idTienda ||
      ''

    const tienda = tiendas[tiendaId]

    return {
      id: documento.id,
      nombre: emprendedora.nombre || 'Sin nombre',

      correo:
        usuario?.email ||
        emprendedora.email ||
        '',

      telefono: emprendedora.telefono || '',

      emprendimiento:
        tienda?.nombre || 'Sin tienda asociada',

      tiendaId,

      estado:
        usuario?.activo === true && emprendedora.activo === true
          ? 'Activa'
          : 'Inactiva',
    }
  })
  return datos
}

export async function crearDocumentosEmprendedora(uid, { nombre, email, telefono, nombreTienda, categoria, descripcion }) {
  // Los tres documentos utilizan el mismo UID.
  const lote = writeBatch(db)

  lote.set(doc(db, 'usuarios', uid), {
    ID: uid,
    nombre,
    email,
    rol: 'emprendedor',
    activo: true,
  })

  lote.set(doc(db, 'emprendedores', uid), {
    ID_Tienda: uid,
    activo: true,
    nombre,
    telefono,
    descripcion: '',
    direccion: '',
  })

  lote.set(doc(db, 'tiendas', uid), {
    ID_Dueno: uid,
    activo: true,
    nombre: nombreTienda,
    categoria,
    descripcion,
    sector: '',
    telefono,
    whatsapp: '',
    emailContacto: email,
    imagen: '',
  })

  // Escritura atomica protegida por las reglas Firestore.
  await lote.commit()

}

export async function cambiarEstadoEmprendedora(uid, activo) {
  return ejecutarOperacionEmprendedoras('cambiarEstadoEmprendedoraAdministrativa', { id: uid, activo })
}

export function editarPerfilEmprendedora(uid, { nombre, telefono }) {
  return ejecutarOperacionEmprendedoras('editarPerfilEmprendedoraAdministrativa', { id: uid, nombre, telefono })
}
