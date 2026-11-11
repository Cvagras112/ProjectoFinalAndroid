package com.esp.bora.data

import com.google.firebase.FirebaseNetworkException
import com.google.firebase.FirebaseTooManyRequestsException
import com.google.firebase.auth.FirebaseAuthInvalidCredentialsException
import com.google.firebase.auth.FirebaseAuthInvalidUserException
import com.google.firebase.firestore.FirebaseFirestoreException
import com.google.firebase.storage.StorageException

/** Convierte errores técnicos de Firebase en mensajes comprensibles para la emprendedora. */
fun Throwable.toUserMessage(): String = when (this) {
    is FirebaseNetworkException ->
        "Sin conexión. Revisa tu internet e inténtalo nuevamente."

    is FirebaseAuthInvalidUserException,
    is FirebaseAuthInvalidCredentialsException ->
        "Correo o contraseña incorrectos."

    is FirebaseTooManyRequestsException ->
        "Demasiados intentos. Espera unos minutos e inténtalo de nuevo."

    is StorageException -> when (errorCode) {
        StorageException.ERROR_NOT_AUTHORIZED ->
            "No tienes permiso para subir la foto. Revisa las reglas de Firebase Storage."

        StorageException.ERROR_BUCKET_NOT_FOUND,
        StorageException.ERROR_PROJECT_NOT_FOUND ->
            "Firebase Storage no está activado en el proyecto."

        else -> "No se pudo subir la foto. Inténtalo nuevamente."
    }

    is FirebaseFirestoreException -> when (code) {
        FirebaseFirestoreException.Code.PERMISSION_DENIED ->
            "No tienes permiso para guardar el producto. Revisa que tu cuenta tenga un perfil en «users» y las reglas de Firestore."

        FirebaseFirestoreException.Code.UNAVAILABLE ->
            "Sin conexión con el servidor. Inténtalo nuevamente."

        else -> "No se pudo guardar el producto. Inténtalo nuevamente."
    }

    else -> message ?: "Ocurrió un error inesperado."
}
