
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
    GoogleAuthProvider,
    signInWithPopup,
    signInWithEmailAndPassword,
    signOut
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../../firebase/config'
import './Login.css'

const proveedorGoogle = new GoogleAuthProvider()
proveedorGoogle.setCustomParameters({ prompt: 'select_account' })

function Login() {
    const navigate = useNavigate()

    const [correo, setCorreo] = useState('')
    const [contrasena, setContrasena] = useState('')
    const [mostrarContrasena, setMostrarContrasena] = useState(false)
    const [error, setError] = useState('')
    const [cargando, setCargando] = useState(false)

    const verificarUsuario = async (usuario, ingresoGoogle = false) => {
        try {
            const usuarioRef = doc(db, 'usuarios', usuario.uid)
            const usuarioSnap = await getDoc(usuarioRef)

            if (!usuarioSnap.exists()) {
                throw new Error(
                    'Tu cuenta no tiene un perfil autorizado en BORA. Contacta al administrador.'
                )
            }

            const datos = usuarioSnap.data()

            if (datos.activo === false) {
                throw new Error(
                    'Tu cuenta está desactivada. Contacta al administrador.'
                )
            }

            const rol = String(datos.rol || datos.Rol || '')
                .trim()
                .toLowerCase()

            if (rol === 'administrador' ||
                rol === 'emprendedora' ||
                rol === 'emprendedor') {

                if (!ingresoGoogle) {
                    throw new Error(
                        'Los administradores y emprendedoras deben ingresar con Google.'
                    )
                }

                const correoAutorizado = String(datos.email || '')
                    .trim()
                    .toLowerCase()

                if (
                    !correoAutorizado ||
                    correoAutorizado !== (usuario.email || '').toLowerCase()
                ) {
                    throw new Error(
                        'Tu correo de Google no coincide con el correo autorizado.'
                    )
                }

                if (rol === 'administrador') {
                    navigate('/admin', { replace: true })
                } else {
                    navigate('/panel-emprendedora', { replace: true })
                }

            } else if (rol === 'comprador') {
                navigate('/', { replace: true })
            } else {
                throw new Error(
                    'Tu cuenta no tiene un rol válido. Contacta al administrador.'
                )
            }
        } catch (err) {
            await signOut(auth)
            throw err
        }
    }

    const mostrarError = (err) => {
        console.error('Error de autenticación:', err.code || err.message)

        if (
            err.code === 'auth/invalid-credential' ||
            err.code === 'auth/wrong-password' ||
            err.code === 'auth/user-not-found'
        ) {
            setError('Correo o contraseña incorrectos.')
        } else if (err.code === 'auth/invalid-email') {
            setError('Ingresa un correo electrónico válido.')
        } else if (err.code === 'auth/too-many-requests') {
            setError('Demasiados intentos. Inténtalo más tarde.')
        } else if (err.code === 'auth/popup-blocked') {
            setError('Tu navegador bloqueó la ventana de Google.')
        } else if (err.code === 'auth/account-exists-with-different-credential') {
            setError('Este correo ya utiliza otro método de acceso.')
        } else if (err.code === 'permission-denied') {
            setError('No tienes permisos para consultar tu perfil.')
        } else {
            setError(err.message || 'No fue posible iniciar sesión.')
        }
    }

    const manejarIngreso = async (e) => {
        e.preventDefault()
        setError('')

        if (!correo.trim() || !contrasena) {
            setError('Debes completar todos los campos.')
            return
        }

        setCargando(true)

        try {
            const credencial = await signInWithEmailAndPassword(
                auth,
                correo.trim(),
                contrasena
            )

            await verificarUsuario(credencial.user, false)
        } catch (err) {
            mostrarError(err)
        } finally {
            setCargando(false)
        }
    }

    const manejarIngresoGoogle = async () => {
        setError('')
        setCargando(true)

        try {
            const resultado = await signInWithPopup(
                auth,
                proveedorGoogle
            )

            await verificarUsuario(resultado.user, true)
        } catch (err) {
            if (err.code !== 'auth/popup-closed-by-user') {
                mostrarError(err)
            }
        } finally {
            setCargando(false)
        }
    }

    return (
        <main className="bora-login">
            <section className="bora-login-card">
                <div className="bora-login-presentacion">
                    <span className="bora-login-etiqueta">
                        BIENVENIDO A BORA
                    </span>

                    <h1>
                        Conectamos personas, talento y emprendimientos.
                    </h1>

                    <p>
                        Descubre productos únicos, apoya a emprendedoras
                        y forma parte de nuestra comunidad.
                    </p>

                    <div className="bora-login-decoracion">
                        <span>✦</span>
                        <span>✿</span>
                        <span>✦</span>
                    </div>
                </div>

                <div className="bora-login-formulario">
                    <div className="bora-login-icono">🛍️</div>

                    <h2>Iniciar sesión</h2>

                    <p>Ingresa tus datos para acceder a tu cuenta.</p>

                    <form onSubmit={manejarIngreso} noValidate>
                        <label htmlFor="login-correo">
                            Correo electrónico
                        </label>

                        <input
                            id="login-correo"
                            type="email"
                            placeholder="ejemplo@correo.com"
                            value={correo}
                            onChange={(e) => setCorreo(e.target.value)}
                            autoComplete="email"
                            disabled={cargando}
                        />

                        <label htmlFor="login-contrasena">
                            Contraseña
                        </label>

                        <div className="bora-login-password">
                            <input
                                id="login-contrasena"
                                type={mostrarContrasena ? 'text' : 'password'}
                                placeholder="Ingresa tu contraseña"
                                value={contrasena}
                                onChange={(e) => setContrasena(e.target.value)}
                                autoComplete="current-password"
                                disabled={cargando}
                            />

                            <button
                                type="button"
                                onClick={() => setMostrarContrasena(!mostrarContrasena)}
                                disabled={cargando}
                            >
                                {mostrarContrasena ? 'Ocultar' : 'Mostrar'}
                            </button>
                        </div>

                        <Link
                            className="bora-login-recuperar"
                            to="/recuperar"
                        >
                            ¿Olvidaste tu contraseña?
                        </Link>

                        {error && (
                            <p className="bora-login-error" role="alert">
                                {error}
                            </p>
                        )}

                        <button
                            className="bora-login-submit"
                            type="submit"
                            disabled={cargando}
                        >
                            {cargando ? 'Ingresando...' : 'Iniciar sesión →'}
                        </button>
                    </form>

                    <div className="bora-login-separador">
                        <span>o continúa con</span>
                    </div>

                    <button
                        type="button"
                        className="bora-login-google"
                        onClick={manejarIngresoGoogle}
                        disabled={cargando}
                    >
                        <svg
                            width="21"
                            height="21"
                            viewBox="0 0 48 48"
                            aria-hidden="true"
                        >
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.03 46.98 31.87 46.98 24.55z"/>
                            <path fill="#FBBC05" d="M10.53 28.59A14.41 14.41 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.2A23.87 23.87 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19z"/>
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                        </svg>

                        {cargando
                            ? 'Conectando...'
                            : 'Continuar con Google'}
                    </button>

                    <div className="bora-login-registro">
                        <p>¿Todavía no tienes una cuenta?</p>

                        <Link
                            to="/registro"
                            className="bora-login-btn-registro"
                        >
                            Crear una cuenta
                        </Link>
                    </div>
                </div>
            </section>
        </main>
    )
}

export default Login
