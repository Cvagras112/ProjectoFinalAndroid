import { numeroContacto, correoContacto } from '../services/tiendas/tiendaPublicaModelo'
import './ContactosPublicos.css'

export default function ContactosPublicos({ whatsapp, correo, asunto, mensajeWhatsApp, mensajeCorreo = mensajeWhatsApp }) {
  const numero = numeroContacto(whatsapp)
  const email = correoContacto(correo)
  if (!numero && !email) return null

  return (
    <div className="bora-contactos-publicos" role="group" aria-label="Contactar al emprendimiento">
      {numero && (
        <a
          className="bora-contacto-icono"
          href={`https://wa.me/${numero}?text=${encodeURIComponent(mensajeWhatsApp)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Consultar por WhatsApp"
          title="Consultar por WhatsApp"
        >
          <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 11.5a9 9 0 0 1-13.3 7.9L3 21l1.6-4.7A9 9 0 1 1 21 11.5Z" />
            <path d="m8 7 2 3-1 1c1 2 2 3 4 4l1-1 3 2c-1 3-4 1-6 0s-4-4-4-6c0-1 0-2 1-3Z" />
          </svg>
        </a>
      )}
      {email && (
        <a
          className="bora-contacto-icono bora-contacto-icono--correo"
          href={`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensajeCorreo)}`}
          aria-label="Consultar por correo electrónico"
          title="Consultar por correo electrónico"
        >
          <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 6 9 7 9-7" />
          </svg>
        </a>
      )}
    </div>
  )
}
