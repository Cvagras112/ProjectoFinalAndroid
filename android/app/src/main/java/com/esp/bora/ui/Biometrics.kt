package com.esp.bora.ui

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity

/** Acceso con huella digital (RF-AUT-01). */
object Biometrics {
    private const val AUTHENTICATORS = BiometricManager.Authenticators.BIOMETRIC_STRONG

    /** true si el teléfono tiene sensor de huella y al menos una huella registrada. */
    fun isAvailable(activity: FragmentActivity): Boolean =
        BiometricManager.from(activity).canAuthenticate(AUTHENTICATORS) == BiometricManager.BIOMETRIC_SUCCESS

    fun authenticate(
        activity: FragmentActivity,
        onSuccess: () -> Unit,
        onUsePassword: () -> Unit,
        onError: (String) -> Unit,
    ) {
        val callback = object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                onSuccess()
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                when (errorCode) {
                    // La persona tocó "Usar contraseña": es la alternativa de acceso.
                    BiometricPrompt.ERROR_NEGATIVE_BUTTON -> onUsePassword()
                    BiometricPrompt.ERROR_USER_CANCELED,
                    BiometricPrompt.ERROR_CANCELED -> onError("Verificación cancelada. Puedes intentarlo de nuevo.")

                    else -> onError(errString.toString())
                }
            }
            // onAuthenticationFailed (huella no reconocida): el propio diálogo deja reintentar.
        }

        val info = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Ingresar a BORA")
            .setSubtitle("Confirma tu identidad con tu huella digital")
            .setAllowedAuthenticators(AUTHENTICATORS)
            .setNegativeButtonText("Usar contraseña")
            .build()

        BiometricPrompt(activity, ContextCompat.getMainExecutor(activity), callback).authenticate(info)
    }
}
