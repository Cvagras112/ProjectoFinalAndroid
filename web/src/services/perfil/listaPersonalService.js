import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../../firebase/config'
import { observarDocumentoCuenta } from '../../repositories/auth/usuarioRepository'
import { observarLista, consultarLista, contieneReferencia, guardarReferencia, eliminarReferencia } from '../../repositories/perfil/listasPersonalesRepository'

const INICIAL = Object.freeze({ estado: 'cargando', uid: null, sesion: 0, registros: [], pendientes: [], error: '' })
const SIN_SESION = Object.freeze({ ...INICIAL, estado: 'sin-sesion' })

export function crearListaPersonal(nombre, campo) {
  let estado = INICIAL
  let version = 0
  let cancelarAuth = () => {}
  let cancelarPerfil = () => {}
  let cancelarLista = () => {}
  const oyentes = new Set()
  const operaciones = new Map()
  const publicar = cambios => {
    estado = { ...estado, ...cambios }
    oyentes.forEach(recibir => recibir())
  }
  const usuario = () => {
    if (!auth.currentUser) throw new Error('Debes iniciar sesión para continuar.')
    return auth.currentUser.uid
  }
  const validarId = id => {
    if (typeof id !== 'string' || !id.trim() || id.includes('/') || id === '.' || id === '..') throw new Error('La selección no es válida.')
    return id
  }
  function detener() {
    version++
    cancelarAuth(); cancelarPerfil(); cancelarLista()
    operaciones.clear()
    estado = INICIAL
  }
  function iniciar() {
    cancelarAuth = onAuthStateChanged(auth, cuenta => {
      cancelarPerfil(); cancelarLista()
      const actual = ++version
      operaciones.clear()
      publicar({ ...INICIAL, sesion: actual, uid: cuenta?.uid || null, estado: cuenta ? 'cargando' : 'sin-sesion' })
      if (!cuenta) return
      let versionLista = 0
      const vigente = () => actual === version && auth.currentUser?.uid === cuenta.uid
      cancelarPerfil = observarDocumentoCuenta('usuarios', cuenta.uid, perfil => {
        if (!vigente()) return
        cancelarLista()
        const lectura = ++versionLista
        const rol = String(perfil?.rol || perfil?.Rol || '').trim().toLowerCase()
        const correoCoincide = String(perfil?.email || '').trim().toLowerCase() === String(cuenta.email || '').trim().toLowerCase()
        if (perfil?.activo !== true || !correoCoincide || !['comprador', 'emprendedor', 'emprendedora'].includes(rol) || (rol === 'comprador' && !cuenta.emailVerified)) {
          publicar({ ...INICIAL, sesion: actual, uid: cuenta.uid, estado: 'sin-permiso' })
          return
        }
        publicar({ registros: [], error: '', estado: 'cargando' })
        cancelarLista = observarLista(cuenta.uid, nombre, registros => {
          if (vigente() && lectura === versionLista) publicar({ estado: 'autorizado', registros, error: '' })
        }, () => {
          if (vigente() && lectura === versionLista) publicar({ estado: 'error', registros: [], error: 'No pudimos consultar tu lista. Inténtalo nuevamente.' })
        })
      }, () => {
        if (vigente()) {
          versionLista++
          cancelarLista()
          publicar({ ...INICIAL, sesion: actual, uid: cuenta.uid, estado: 'error', error: 'No pudimos comprobar tu cuenta. Inténtalo nuevamente.' })
        }
      })
    })
  }
  async function cambiar(id, guardar) {
    const uid = usuario()
    const cuenta = auth.currentUser
    validarId(id)
    const clave = `${uid}/${id}`
    const pendiente = operaciones.get(clave)
    if (pendiente) return pendiente.guardar === guardar ? pendiente.promesa : pendiente.promesa.then(() => {
      if (auth.currentUser !== cuenta) throw new Error('La sesión cambió. Vuelve a intentarlo.')
      return cambiar(id, guardar)
    })
    const actual = version
    // Navegar o desmontar botones no cancela una escritura ya solicitada.
    // Un cambio de cuenta sí invalida la transacción antes de escribir.
    const vigente = () => auth.currentUser === cuenta && auth.currentUser?.uid === uid
    if (estado.uid === uid && estado.estado === 'sin-permiso') throw new Error('Necesitas una cuenta activa y autorizada.')
    const operacion = Promise.resolve().then(async () => {
      try {
        if (guardar) await guardarReferencia(uid, nombre, campo, id, vigente)
        else await eliminarReferencia(uid, nombre, id)
      } finally {
        if (operaciones.get(clave)?.promesa === operacion) operaciones.delete(clave)
        if (vigente() && actual === version) publicar({ pendientes: estado.pendientes.filter(p => p !== id) })
      }
    })
    operaciones.set(clave, { promesa: operacion, guardar })
    if (estado.uid === uid) publicar({ pendientes: [...estado.pendientes, id] })
    return operacion
  }
  return {
    suscribir(recibir) {
      oyentes.add(recibir)
      if (oyentes.size === 1) iniciar()
      return () => { oyentes.delete(recibir); if (!oyentes.size) detener() }
    },
    leerEstado: () => estado.uid === (auth.currentUser?.uid || null) ? estado : auth.currentUser ? INICIAL : SIN_SESION,
    leerServidor: () => INICIAL,
    reintentar() { if (oyentes.size) { detener(); iniciar() } },
    obtener: () => consultarLista(usuario(), nombre),
    comprobar: id => contieneReferencia(usuario(), nombre, validarId(id)),
    agregar: id => cambiar(id, true),
    quitar: id => cambiar(id, false),
  }
}
