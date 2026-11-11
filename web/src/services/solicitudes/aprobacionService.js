
import { auth } from '../../firebase/config'
import { supabase } from '../../supabase/config'

export async function aprobarSolicitudEmprendedor(usuarioId) {
  if (!supabase) {
    throw new Error(
      'Supabase no está configurado correctamente.'
    )
  }

  const administrador = auth.currentUser

  if (!administrador) {
    throw new Error(
      'Debes iniciar sesión como administrador.'
    )
  }

  if (typeof usuarioId !== 'string' || !usuarioId.trim()) {
    throw new Error(
      'El identificador de la solicitud no es válido.'
    )
  }

  // Obtener un token válido de Firebase Authentication.
  const token = await administrador.getIdToken()

  // Invocar la función protegida en Supabase.
  const { data, error } = await supabase.functions.invoke(
    'aprobar-solicitud-bora',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: {
        usuarioId: usuarioId.trim(),
      },
    }
  )

  if (error) {
    const respuesta = error.context

    if (respuesta && typeof respuesta.json === 'function') {
      try {
        const detalle = await respuesta.json()

        throw new Error(
          detalle.mensaje ||
          'No fue posible aprobar la solicitud.'
        )
      } catch (err) {
        if (err instanceof SyntaxError) {
          throw new Error('La función de aprobación devolvió una respuesta inválida.', { cause: err })
        }

        throw err
      }
    }

    throw new Error(
      'No fue posible conectar con la función de aprobación.'
    )
  }

  if (!data?.exito) {
    throw new Error(
      data?.mensaje || 'La solicitud no pudo aprobarse.'
    )
  }

  return data
}
