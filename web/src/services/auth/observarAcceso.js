import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../../firebase/config'
import { observarDocumentoCuenta } from '../../repositories/auth/usuarioRepository'

// Cada cambio de sesión cancela los observadores de la cuenta anterior.
export function observarAcceso(recibir, { emprendedor = false, comprador = false } = {}) {
  let cancelarDocumentos = () => {}
  let version = 0
  const cancelarAuth = onAuthStateChanged(auth, (usuario) => {
    cancelarDocumentos()
    const actual = ++version
    if (!usuario) {
      recibir('sin-sesion')
      return
    }
    recibir('cargando')
    let fallo = false
    let perfil
    let negocio
    const cancelaciones = []
    const vigente = () => actual === version
    const evaluar = () => {
      if (fallo || !vigente() || perfil === undefined || (emprendedor && negocio === undefined)) return
      const rol = String(perfil?.rol || perfil?.Rol || '').trim().toLowerCase()
      const correoCoincide = String(perfil?.email || '').trim().toLowerCase() ===
        String(usuario.email || '').trim().toLowerCase()
      const permitido = perfil?.activo === true && correoCoincide &&
        (emprendedor ? rol === 'emprendedor' && negocio?.activo === true :
          comprador ? rol === 'comprador' && usuario.emailVerified :
            ['comprador', 'emprendedor', 'administrador'].includes(rol) &&
              (rol !== 'comprador' || usuario.emailVerified))
      recibir(permitido ? 'autorizado' : 'sin-permiso')
    }
    const error = () => {
      fallo = true
      if (vigente()) recibir('error')
    }
    cancelaciones.push(observarDocumentoCuenta('usuarios', usuario.uid, (datos) => {
      perfil = datos
      evaluar()
    }, error))
    if (emprendedor) {
      cancelaciones.push(observarDocumentoCuenta('emprendedores', usuario.uid, (datos) => {
        negocio = datos
        evaluar()
      }, error))
    }
    cancelarDocumentos = () => cancelaciones.forEach((cancelar) => cancelar())
  })
  return () => {
    version++
    cancelarAuth()
    cancelarDocumentos()
  }
}
