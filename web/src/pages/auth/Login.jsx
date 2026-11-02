
import { useState } from 'react'
import './Login.css'

function Login() {
    const [correo, setCorreo] = useState('')
    const [contrasena, setContrasena] = useState('')
    const [mostrarContrasena, setMostrarContrasena] = useState(false)
    const [error, setError] = useState('')

    const manejarIngreso = (e) => {
        e.preventDefault()
        setError('')

        if (!correo.trim() || !contrasena) {
            setError('Debes completar todos los campos.')
            return
        }

        setError('Próximamente conectaremos el inicio de sesión con Firebase.')
    }

    return (
        <main className="bora-login">
            <section className="bora-login-card">
                <div className="bora-login-presentacion">
                    <span className="bora-login-etiqueta">BIENVENIDO A BORA</span>
                    <h1>Conectamos personas, talento y emprendimientos.</h1>
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
                        <label htmlFor="login-correo">Correo electrónico</label>
                        <input
                            id="login-correo"
                            type="email"
                            placeholder="ejemplo@correo.com"
                            value={correo}
                            onChange={(e) => setCorreo(e.target.value)}
                            autoComplete="email"
                        />

                        <label htmlFor="login-contrasena">Contraseña</label>
                        <div className="bora-login-password">
                            <input
                                id="login-contrasena"
                                type={mostrarContrasena ? 'text' : 'password'}
                                placeholder="Ingresa tu contraseña"
                                value={contrasena}
                                onChange={(e) => setContrasena(e.target.value)}
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                onClick={() => setMostrarContrasena(!mostrarContrasena)}
                                aria-label={
                                    mostrarContrasena
                                        ? 'Ocultar contraseña'
                                        : 'Mostrar contraseña'
                                }
                            >
                                {mostrarContrasena ? 'Ocultar' : 'Mostrar'}
                            </button>
                        </div>

                        <a className="bora-login-recuperar" href="/recuperar">
                            ¿Olvidaste tu contraseña?
                        </a>

                        {error && <p className="bora-login-error" role="alert">{error}</p>}

                        <button className="bora-login-submit" type="submit">
                            Iniciar sesión →
                        </button>
                    </form>


                    <div className="bora-login-registro">
                        <p>¿Todavía no tienes una cuenta?</p>

                        <a
                            href="/registro"
                            className="bora-login-btn-registro"
                        >
                            Crear una cuenta
                        </a>
                    </div>

                </div>
            </section>
        </main>
    )
}

export default Login
