import { useState } from 'react'
import {
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  deleteUser
} from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { secondaryAuth, auth, db } from '../../firebase/config'

function AdministradoresAdmin() {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmarPassword, setConfirmarPassword] = useState('')
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  const crearAdministrador = async (e) => {
    e.preventDefault()
    setMensaje('')
    setError('')

    if (!auth.currentUser) {
      setError('Debes iniciar sesión como administrador.')
      return
    }

    if (!nombre.trim() || password.length < 8 || password.length > 128) {
      setError('Revisa el nombre y la contraseña.')
      return
    }

    if (password !== confirmarPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setCargando(true)
    let nuevaCuenta = null
    let creado = false

    try {
      const correo = email.trim().toLowerCase()

      const credencial = await createUserWithEmailAndPassword(
        secondaryAuth,
        correo,
        password
      )

      nuevaCuenta = credencial.user

      await updateProfile(nuevaCuenta, {
        displayName: nombre.trim()
      })

      // Firestore utiliza la sesión del administrador principal.
      await setDoc(doc(db, 'usuarios', nuevaCuenta.uid), {
        ID: nuevaCuenta.uid,
        nombre: nombre.trim(),
        email: correo,
        rol: 'administrador',
        activo: true
      })

      creado = true

      setMensaje('Administrador creado correctamente.')
      setNombre('')
      setEmail('')
      setPassword('')
      setConfirmarPassword('')

    } catch (err) {
      console.error('Error creando administrador:', err)

      if (nuevaCuenta && !creado) {
        try {
          await deleteUser(nuevaCuenta)
        } catch (limpieza) {
          console.error('Error limpiando cuenta:', limpieza)
        }
      }

      const mensajes = {
        'auth/email-already-in-use': 'Este correo ya está registrado.',
        'auth/invalid-email': 'El correo no es válido.',
        'auth/weak-password': 'La contraseña es demasiado débil.',
        'permission-denied': 'No tienes permisos para crear administradores.'
      }

      setError(mensajes[err.code] || err.message || 'Error al crear administrador.')

    } finally {
      if (secondaryAuth.currentUser) {
        await signOut(secondaryAuth).catch(console.error)
      }

      setCargando(false)
    }
  }

  return (
    <section className="bora-card" style={{ maxWidth: 750 }}>
      <h2 style={{ color: '#194C36' }}>Crear administrador</h2>
      <p>Registra nuevos administradores de BORA.</p>

      {mensaje && <p role="status" style={estiloMensaje}>{mensaje}</p>}
      {error && <p role="alert" style={estiloError}>{error}</p>}

      <form onSubmit={crearAdministrador}>
        <Campo label="Nombre completo" value={nombre} change={setNombre} />
        <Campo label="Correo electrónico" value={email} change={setEmail} type="email" />
        <Campo label="Contraseña" value={password} change={setPassword} type="password" />
        <Campo label="Confirmar contraseña" value={confirmarPassword} change={setConfirmarPassword} type="password" />

        <button type="submit" disabled={cargando} style={estiloBoton}>
          {cargando ? 'Creando...' : 'Crear administrador'}
        </button>
      </form>
    </section>
  )
}

function Campo({ label, value, change, type = 'text' }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => change(e.target.value)}
        minLength={type === 'password' ? 8 : undefined}
        maxLength={type === 'password' ? 128 : 254}
        required
        style={estiloInput}
      />
    </div>
  )
}

const estiloInput = {
  display: 'block',
  width: '100%',
  padding: 12,
  marginTop: 8,
  border: '1px solid #DCE3DD',
  borderRadius: 8,
  boxSizing: 'border-box'
}

const estiloMensaje = {
  padding: 14,
  background: '#E8F5E9',
  color: '#236B4B',
  borderRadius: 10
}

const estiloError = {
  padding: 14,
  background: '#FFF1E9',
  color: '#A43D25',
  borderRadius: 10
}

const estiloBoton = {
  background: '#236B4B',
  color: 'white',
  border: 'none',
  padding: '14px 24px',
  borderRadius: 10,
  cursor: 'pointer'
}

export default AdministradoresAdmin
