
import { auth, db } from '../../firebase/config'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'

export async function enviarSolicitudEmprendedor(datos) {
  const usuario = auth.currentUser

  if (!usuario) {
    throw new Error(
      'Debes iniciar sesión para enviar una solicitud.'
    )
  }

  const nombre = String(datos.nombre || '').trim()
  const telefono = String(datos.telefono || '').trim()
  const emprendimiento = String(datos.emprendimiento || '').trim()
  const categoria = String(datos.categoria || '').trim()
  const descripcion = String(datos.descripcion || '').trim()

  if (
    !nombre ||
    !telefono ||
    !emprendimiento ||
    !categoria ||
    !descripcion
  ) {
    throw new Error('Completa todos los campos.')
  }

  if (nombre.length > 150 || descripcion.length > 1000) {
    throw new Error('Uno de los campos supera el límite permitido.')
  }

  if (!usuario.emailVerified) {
    throw new Error(
      'Debes verificar tu correo electrónico antes de enviar la solicitud.'
    )
  }

  const referencia = doc(
    db,
    'solicitudes_emprendedores',
    usuario.uid
  )

  await setDoc(referencia, {
    usuarioId: usuario.uid,
    email: usuario.email,
    nombre,
    telefono,
    emprendimiento,
    categoria,
    descripcion,
    estado: 'pendiente',
    fechaSolicitud: serverTimestamp(),
  })

  return {
    mensaje: 'Tu solicitud fue enviada correctamente.',
  }
}
