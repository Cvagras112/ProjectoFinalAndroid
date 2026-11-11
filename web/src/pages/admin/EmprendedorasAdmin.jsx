import './credenciales-bora.css'

import { useEffect, useState } from 'react'
import { doc, updateDoc, writeBatch } from 'firebase/firestore'


import { db, secondaryAuth } from '../../firebase/config'
import { createUserWithEmailAndPassword, updateProfile, deleteUser, signOut } from 'firebase/auth'

function generarPasswordTemporal() {
  const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  const valores = new Uint8Array(16)
  globalThis.crypto.getRandomValues(valores)

  return Array.from(valores, (valor) => caracteres[valor % caracteres.length]).join('')
}

function EmprendedorasAdmin({
  emprendedoras,
  setEmprendedoras,
  asociaciones = [],
  asignaciones = [],
}) {
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [mensajeValidacion, setMensajeValidacion] = useState('')
  const [emprendedoraEditando, setEmprendedoraEditando] = useState(null)
  const [emprendedoraViendo, setEmprendedoraViendo] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [idProcesando, setIdProcesando] = useState(null)
  const [creandoEmprendedora, setCreandoEmprendedora] = useState(false)
  const [formularioNuevo, setFormularioNuevo] = useState(false)
  const [credencialesTemporales, setCredencialesTemporales] = useState(null)

  const normalizarTexto = (texto) =>
    String(texto || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('es')
      .trim()

  const emprendedorasFiltradas = emprendedoras.filter((emprendedora) => {
    const textoBusqueda = normalizarTexto(busqueda)

    return (
      normalizarTexto(emprendedora.nombre).includes(textoBusqueda) ||
      normalizarTexto(emprendedora.correo).includes(textoBusqueda) ||
      normalizarTexto(emprendedora.emprendimiento).includes(textoBusqueda)
    )
  })

  const obtenerAsociacion = (emprendedoraId) => {
    const asignacion = asignaciones.find(
      (item) => item.emprendedoraId === emprendedoraId
    )

    if (!asignacion) return 'Sin asignar'

    const asociacion = asociaciones.find(
      (item) => item.id === asignacion.asociacionId
    )

    return asociacion?.nombre || 'Asociación no disponible'
  }

  const cambiarEstado = async (emprendedora) => {
    if (idProcesando || guardando || creandoEmprendedora) return

    const nuevoEstado =
      emprendedora.estado === 'Inactiva' ? 'Activa' : 'Inactiva'

    const confirmar = window.confirm(
      `¿Deseas ${
        nuevoEstado === 'Activa' ? 'activar' : 'desactivar'
      } a ${emprendedora.nombre}?`
    )

    if (!confirmar) return

    setIdProcesando(emprendedora.id)
    setMensajeValidacion('')

    try {
      await updateDoc(
        doc(db, 'emprendedores', emprendedora.id),
        {
          activo: nuevoEstado === 'Activa',
        }
      )

      setEmprendedoras((anteriores) =>
        anteriores.map((item) =>
          item.id === emprendedora.id
            ? { ...item, estado: nuevoEstado }
            : item
        )
      )

      setMensajeValidacion(
        `El perfil fue ${
          nuevoEstado === 'Activa' ? 'activado' : 'desactivado'
        } correctamente en Firebase.`
      )
    } catch (error) {
      console.error('Error al cambiar el estado:', error)

      setMensajeValidacion(
        'No fue posible actualizar el estado en Firebase. Verifica los permisos.'
      )
    } finally {
      setIdProcesando(null)
    }
  }

  const abrirNuevaEmprendedora = () => {
    setCredencialesTemporales(null)
    setMostrarFormulario(false)
    setEmprendedoraEditando(null)
    setFormularioNuevo(true)
    setMensajeValidacion('')
  }

  const crearEmprendedora = async (evento) => {
    evento.preventDefault()
    if (creandoEmprendedora) return

    const formulario = evento.currentTarget
    if (!formulario.reportValidity()) return

    const datos = new FormData(formulario)

    const nombre = String(datos.get('nombre') || '').trim()
    const email = String(datos.get('email') || '').trim().toLowerCase()
    const password = generarPasswordTemporal()
    const nombreTienda = String(datos.get('nombreTienda') || '').trim()
    const categoria = String(datos.get('categoria') || '').trim()
    const telefono = String(datos.get('telefono') || '').trim()
    const descripcion = String(datos.get('descripcion') || '').trim()

    if (!window.confirm(`¿Crear la cuenta de ${nombre} y su tienda?`)) return

    setCreandoEmprendedora(true)
    setMensajeValidacion('')

    let credencial = null
    let documentosGuardados = false

    try {
      // Crear cuenta sin cerrar la sesion del administrador.
      credencial = await createUserWithEmailAndPassword(
        secondaryAuth,
        email,
        password
      )

      await updateProfile(credencial.user, {
        displayName: nombre,
      })

      const uid = credencial.user.uid

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
      documentosGuardados = true

      try {
        await signOut(secondaryAuth)
      } catch (error) {
        console.warn('No se pudo cerrar la sesion secundaria:', error)
      }

      setEmprendedoras((anteriores) => [
        ...anteriores,
        {
          id: uid,
          nombre,
          correo: email,
          telefono,
          emprendimiento: nombreTienda,
          estado: 'Activa',
        },
      ])

      setFormularioNuevo(false)
      formulario.reset()
      setCredencialesTemporales({ email, password })

      setMensajeValidacion(
        'Emprendedora, cuenta y tienda creadas correctamente.'
      )

    } catch (error) {
      console.error('Error al crear emprendedora:', error)

      // Si Firestore falla, eliminar la cuenta recien creada.
      if (credencial && !documentosGuardados) {
        try {
          await deleteUser(credencial.user)
        } catch (errorLimpieza) {
          console.error('Error al limpiar cuenta:', errorLimpieza)
        }
      }

      setMensajeValidacion(
        error.code === 'permission-denied'
          ? 'Firestore rechazo la operacion. Revisa las reglas y los permisos del administrador.'
          : error.message || 'No fue posible crear la cuenta.'
      )

    } finally {
      setCreandoEmprendedora(false)
    }
  }
  const editarEmprendedora = (emprendedora) => {
    setEmprendedoraViendo(null)
    setFormularioNuevo(false)
    setEmprendedoraEditando(emprendedora)
    setMostrarFormulario(true)
    setMensajeValidacion('')
  }

  const cerrarFormulario = () => {
    if (guardando || creandoEmprendedora) return

    setFormularioNuevo(false)
    setMostrarFormulario(false)
    setEmprendedoraEditando(null)
    setMensajeValidacion('')
  }

  const guardarCambios = async (evento) => {
    evento.preventDefault()

    if (!emprendedoraEditando || guardando) return

    const formulario = evento.currentTarget

    if (!formulario.reportValidity()) return

    const datos = new FormData(formulario)

    const nombre = String(datos.get('nombre') || '').trim()
    const telefono = String(datos.get('telefono') || '').trim()

    if (nombre.length < 3 || nombre.length > 100) {
      setMensajeValidacion(
        'El nombre debe tener entre 3 y 100 caracteres.'
      )
      return
    }

    if (telefono && !/^[0-9]{9}$/.test(telefono)) {
      setMensajeValidacion(
        'El teléfono debe tener 9 dígitos, sin espacios ni +56.'
      )
      return
    }

    setGuardando(true)
    setMensajeValidacion('')

    try {
      await updateDoc(
        doc(db, 'emprendedores', emprendedoraEditando.id),
        {
          nombre,
          telefono,
        }
      )

      setEmprendedoras((anteriores) =>
        anteriores.map((emprendedora) =>
          emprendedora.id === emprendedoraEditando.id
            ? { ...emprendedora, nombre, telefono }
            : emprendedora
        )
      )

      setMostrarFormulario(false)
      setEmprendedoraEditando(null)

      setMensajeValidacion(
        'Los cambios se guardaron correctamente en Firebase.'
      )
    } catch (error) {
      console.error('Error al guardar emprendedora:', error)

      setMensajeValidacion(
        'No fue posible guardar los cambios. Revisa los permisos de Firebase.'
      )
    } finally {
      setGuardando(false)
    }
  }

  useEffect(() => {
    if (!emprendedoraViendo) return

    const cerrarConEscape = (evento) => {
      if (evento.key === 'Escape') {
        setEmprendedoraViendo(null)
      }
    }

    window.addEventListener('keydown', cerrarConEscape)

    return () => {
      window.removeEventListener('keydown', cerrarConEscape)
    }
  }, [emprendedoraViendo])

  const emprendedoraSeleccionada = emprendedoraViendo
    ? emprendedoras.find(
        (item) => item.id === emprendedoraViendo.id
      ) || emprendedoraViendo
    : null

  return (
    <section className="bora-card">
      <div className="bora-emprendedoras-header">
        <div>
          <h2>Gestión de emprendedoras</h2>
          <p>
            Administra las emprendedoras registradas
            en la plataforma BORA.
          </p>
        </div>

        <button
          type="button"
          onClick={
            mostrarFormulario || formularioNuevo
              ? cerrarFormulario
              : abrirNuevaEmprendedora
          }
          disabled={
            guardando ||
            creandoEmprendedora
          }
        >
          {mostrarFormulario || formularioNuevo
            ? 'Cancelar'
            : '+ Nueva emprendedora'}
        </button>
      </div>

      {formularioNuevo && (
        <div className="bora-formulario">
          <h3>Crear cuenta de emprendedora</h3>
          <p>Registra una nueva emprendedora y su tienda.</p>

          <form
            className="bora-formulario-campos"
            onSubmit={crearEmprendedora}
          >
            <div className="bora-campo">
              <label>Nombre completo</label>
              <input name="nombre" type="text" maxLength={150} required disabled={creandoEmprendedora} />
            </div>

            <div className="bora-campo">
              <label>Correo electrónico</label>
              <input name="email" type="email" maxLength={254} required disabled={creandoEmprendedora} />
            </div>



            <div className="bora-campo">
              <label>Nombre de la tienda</label>
              <input name="nombreTienda" type="text" maxLength={150} required disabled={creandoEmprendedora} />
            </div>

            <div className="bora-campo">
              <label>Categoría</label>
              <select name="categoria" defaultValue="" required disabled={creandoEmprendedora}>
                <option value="" disabled>Selecciona una categoría</option>
                {[
                  'Artesanía',
                  'Textiles y tejidos',
                  'Gastronomía',
                  'Belleza y bienestar',
                  'Decoración',
                  'Otros',
                ].map((categoria) => (
                  <option key={categoria} value={categoria}>{categoria}</option>
                ))}
              </select>
            </div>

            <div className="bora-campo">
              <label>Teléfono (opcional)</label>
              <input name="telefono" type="tel" pattern="[0-9]{9}" maxLength={9} placeholder="912345678" disabled={creandoEmprendedora} />
            </div>

            <div className="bora-campo">
              <label>Descripción</label>
              <textarea name="descripcion" maxLength={2000} rows={3} disabled={creandoEmprendedora} />
            </div>

            <button type="submit" disabled={creandoEmprendedora}>
              {creandoEmprendedora ? 'Creando cuenta...' : 'Crear emprendedora'}
            </button>
          </form>
        </div>
      )}
      {mostrarFormulario && emprendedoraEditando && (
        <div className="bora-formulario">
          <h3>Editar emprendedora</h3>

          <p>
            Actualiza los datos del perfil.
            Los cambios se guardarán en Firebase.
          </p>

          <form
            key={emprendedoraEditando.id}
            id="formulario-emprendedora"
            className="bora-formulario-campos"
            onSubmit={guardarCambios}
          >
            <div className="bora-campo">
              <label htmlFor="nombre-emprendedora">
                Nombre de la emprendedora
              </label>

              <input
                type="text"
                id="nombre-emprendedora"
                name="nombre"
                defaultValue={emprendedoraEditando.nombre}
                minLength={3}
                maxLength={100}
                autoComplete="name"
                required
              />
            </div>

            <div className="bora-campo">
              <label htmlFor="correo-emprendedora">
                Correo electrónico
              </label>

              <input
                type="email"
                id="correo-emprendedora"
                value={emprendedoraEditando.correo || ''}
                placeholder="No disponible"
                readOnly
              />
            </div>

            <div className="bora-campo">
              <label htmlFor="telefono-emprendedora">
                Teléfono de contacto
              </label>

              <input
                type="tel"
                id="telefono-emprendedora"
                name="telefono"
                defaultValue={emprendedoraEditando.telefono || ''}
                placeholder="Ejemplo: 912345678"
                pattern="[0-9]{9}"
                title="Ingresa 9 dígitos, sin espacios ni +56"
                maxLength={9}
                autoComplete="tel"
              />
            </div>

            <div className="bora-campo">
              <label htmlFor="emprendimiento-nombre">
                Nombre del emprendimiento
              </label>

              <input
                type="text"
                id="emprendimiento-nombre"
                value={emprendedoraEditando.emprendimiento || ''}
                readOnly
              />
            </div>

            <button type="submit" disabled={guardando}>
              {guardando
                ? 'Guardando cambios...'
                : 'Guardar cambios'}
            </button>
          </form>
        </div>
      )}

      {mensajeValidacion && (
        <p
          className="bora-mensaje-validacion"
          role="status"
          style={{ marginTop: '15px' }}
        >
          {mensajeValidacion}
        </p>
      )}

      {credencialesTemporales && (
        <div className="bora-formulario" style={{ marginTop: '16px' }}>
          <h3>Credenciales de acceso creadas</h3>
          <p>Entrega estos datos de forma privada a la emprendedora. La contraseña no se guarda en Firestore.</p>

          <div className="bora-campo">
            <label>Correo de acceso</label>
            <input
              type="text"
              readOnly
              value={credencialesTemporales.email}
            />
          </div>

          <div className="bora-campo">
            <label>Contraseña temporal</label>
            <input
              type="text"
              readOnly
              value={credencialesTemporales.password}
            />
          </div>

          <button
            className="bora-btn-credenciales-copiar"
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  `Correo: ${credencialesTemporales.email}\nContraseña: ${credencialesTemporales.password}`
                )
                window.alert('Credenciales copiadas.')
              } catch {
                window.alert('No se pudo copiar. Copia los datos manualmente.')
              }
            }}
          >
            Copiar credenciales
          </button>

          <button
            type="button"
            onClick={() => setCredencialesTemporales(null)}
            className="bora-btn-credenciales-ocultar"
          >
            Ocultar credenciales
          </button>
        </div>
      )}

      <div className="bora-buscador">
        <label htmlFor="buscar-emprendedora">
          Buscar emprendedora
        </label>

        <input
          type="search"
          id="buscar-emprendedora"
          placeholder="Buscar por nombre, correo o emprendimiento..."
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
        />
      </div>

      <div className="bora-tabla-contenedor">
        <table className="bora-tabla">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Asociación</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {emprendedorasFiltradas.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  {emprendedoras.length === 0
                    ? 'Todavía no hay emprendedoras registradas.'
                    : 'No se encontraron emprendedoras que coincidan con la búsqueda.'}
                </td>
              </tr>
            ) : (
              emprendedorasFiltradas.map((emprendedora) => (
                <tr key={emprendedora.id}>
                  <td>
                    <strong>{emprendedora.nombre}</strong>
                    <div>{emprendedora.emprendimiento}</div>
                  </td>

                  <td>
                    {obtenerAsociacion(emprendedora.id)}
                  </td>

                  <td>{emprendedora.estado}</td>

                  <td>
                    <div className="bora-acciones-tabla">
                      <button
                        type="button"
                        className="bora-boton-editar"
                        onClick={() =>
                          setEmprendedoraViendo(emprendedora)
                        }
                      >
                        Ver
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          editarEmprendedora(emprendedora)
                        }
                        className="bora-boton-editar"
                        disabled={
                          guardando ||
                          creandoEmprendedora ||
                          Boolean(idProcesando)
                        }
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          cambiarEstado(emprendedora)
                        }
                        className={
                          emprendedora.estado === 'Inactiva'
                            ? 'bora-boton-editar'
                            : 'bora-boton-eliminar'
                        }
                        disabled={
                          guardando ||
                          creandoEmprendedora ||
                          Boolean(idProcesando)
                        }
                      >
                        {idProcesando === emprendedora.id
                          ? 'Guardando...'
                          : emprendedora.estado === 'Inactiva'
                            ? 'Activar'
                            : 'Desactivar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {emprendedoraSeleccionada && (
        <div
          role="presentation"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) {
              setEmprendedoraViendo(null)
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(20, 39, 29, 0.62)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bora-ficha-titulo"
            style={{
              background: '#FFFFFF',
              borderRadius: '20px',
              padding: '30px',
              width: '100%',
              maxWidth: '540px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 24px 70px rgba(0,0,0,0.2)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '15px',
                marginBottom: '24px',
              }}
            >
              <div>
                <p style={{ color: '#B97426', fontSize: '12px' }}>
                  ✦ FICHA DE EMPRENDEDORA
                </p>

                <h2
                  id="bora-ficha-titulo"
                  style={{
                    color: '#236B4B',
                    margin: '8px 0',
                  }}
                >
                  {emprendedoraSeleccionada.nombre}
                </h2>
              </div>

              <button
                type="button"
                aria-label="Cerrar ficha"
                onClick={() => setEmprendedoraViendo(null)}
                style={{
                  border: 'none',
                  background: '#EEF4EF',
                  color: '#236B4B',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            {[
              ['Nombre', emprendedoraSeleccionada.nombre],
              ['Correo electrónico', emprendedoraSeleccionada.correo],
              ['Teléfono', emprendedoraSeleccionada.telefono],
              ['Emprendimiento', emprendedoraSeleccionada.emprendimiento],
              [
                'Asociación',
                obtenerAsociacion(emprendedoraSeleccionada.id),
              ],
              ['Estado', emprendedoraSeleccionada.estado],
            ].map(([etiqueta, valor]) => (
              <div
                key={etiqueta}
                style={{
                  padding: '13px 0',
                  borderBottom: '1px solid #E9EEE9',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    color: '#7D8980',
                    marginBottom: '5px',
                  }}
                >
                  {etiqueta}
                </div>

                <div
                  style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    color: '#293B30',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {valor || 'No registrado'}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setEmprendedoraViendo(null)}
              style={{
                display: 'block',
                margin: '25px 0 0 auto',
                padding: '12px 30px',
                border: 'none',
                borderRadius: '10px',
                background: '#236B4B',
                color: '#FFFFFF',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

export default EmprendedorasAdmin

