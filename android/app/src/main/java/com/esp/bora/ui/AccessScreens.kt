package com.esp.bora.ui

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialException
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.fragment.app.FragmentActivity
import com.esp.bora.R
import com.esp.bora.data.AccountMode
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import kotlinx.coroutines.launch

@Composable
fun AccountModeScreen(
    onChoose: (AccountMode) -> Unit,
) {
    Column(
        Modifier.fillMaxSize().systemBarsPadding().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Image(
            painter = painterResource(R.drawable.logo_bora),
            contentDescription = "BORA",
            modifier = Modifier.width(240.dp),
        )
        Spacer(Modifier.height(16.dp))
        Text("¿Cómo quieres usar BORA?", style = MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(24.dp))
        Button(onClick = { onChoose(AccountMode.BUYER) }, modifier = Modifier.fillMaxWidth().height(56.dp)) {
            Text("Explorar como comprador")
        }
        Spacer(Modifier.height(12.dp))
        OutlinedButton(
            onClick = { onChoose(AccountMode.ENTREPRENEUR) },
            modifier = Modifier.fillMaxWidth().height(56.dp),
        ) {
            Text("Entrar a mi tienda")
        }
        Spacer(Modifier.height(12.dp))
        Text(
            "Puedes cambiar de modo cerrando sesión.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
fun BuyerSignInScreen(
    activity: FragmentActivity,
    busy: Boolean,
    error: String?,
    onGoogleToken: (String) -> Unit,
    onBack: () -> Unit,
) {
    var requestingGoogle by remember { mutableStateOf(false) }
    var credentialError by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    Column(
        Modifier.fillMaxSize().systemBarsPadding().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Image(
            painter = painterResource(R.drawable.logo_bora),
            contentDescription = "BORA",
            modifier = Modifier.width(220.dp),
        )
        Spacer(Modifier.height(20.dp))
        Text("Modo comprador", style = MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(8.dp))
        Text(
            "Inicia sesión con Google para seguir tiendas y recibir novedades.",
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(24.dp))
        Button(
            onClick = {
                requestingGoogle = true
                credentialError = null
                scope.launch {
                    try {
                        val credentialManager = CredentialManager.create(activity)
                        val googleOption = GetSignInWithGoogleOption.Builder(
                            activity.getString(R.string.default_web_client_id),
                        ).build()
                        val request = GetCredentialRequest.Builder()
                            .addCredentialOption(googleOption)
                            .build()
                        val result = credentialManager.getCredential(activity, request)
                        val credential = result.credential
                        if (
                            credential is CustomCredential &&
                            credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
                        ) {
                            val token = GoogleIdTokenCredential.createFrom(credential.data).idToken
                            onGoogleToken(token)
                        } else {
                            credentialError = "No se recibió una cuenta de Google válida."
                        }
                    } catch (e: GetCredentialException) {
                        credentialError = "No se pudo iniciar sesión con Google. Inténtalo nuevamente."
                    } catch (e: Exception) {
                        credentialError = e.localizedMessage ?: "No se pudo iniciar sesión con Google."
                    } finally {
                        requestingGoogle = false
                    }
                }
            },
            enabled = !busy && !requestingGoogle,
            modifier = Modifier.fillMaxWidth().height(52.dp),
        ) {
            if (busy || requestingGoogle) {
                CircularProgressIndicator(
                    modifier = Modifier.size(22.dp),
                    strokeWidth = 2.dp,
                    color = MaterialTheme.colorScheme.onPrimary,
                )
                Spacer(Modifier.width(10.dp))
            }
            Text("Continuar con Google")
        }
        (credentialError ?: error)?.let {
            Spacer(Modifier.height(12.dp))
            Text(it, color = MaterialTheme.colorScheme.error, textAlign = TextAlign.Center)
        }
        Spacer(Modifier.height(12.dp))
        TextButton(onClick = onBack, enabled = !busy && !requestingGoogle) {
            Text("Volver")
        }
    }
}
