package com.esp.bora.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.esp.bora.data.AccountMode
import com.esp.bora.data.Product
import kotlinx.coroutines.launch

@Composable
fun BoraApp(
    activity: FragmentActivity,
    authVm: AuthViewModel = viewModel(),
) {
    val auth by authVm.state.collectAsStateWithLifecycle()
    val biometricAvailable = remember(activity) { Biometrics.isAvailable(activity) }
    val credentialManager = remember(activity) { CredentialManager.create(activity) }
    val scope = rememberCoroutineScope()
    val signOut: () -> Unit = {
        authVm.signOut()
        scope.launch {
            runCatching { credentialManager.clearCredentialState(ClearCredentialStateRequest()) }
        }
        Unit
    }
    val uid = auth.uid

    LaunchedEffect(uid, auth.mode) {
        if (uid != null && auth.mode == null) authVm.signOut()
    }

    when {
        uid == null && auth.selectedMode == null -> AccountModeScreen(authVm::selectMode)
        uid == null && auth.selectedMode == AccountMode.BUYER -> BuyerSignInScreen(
            activity = activity,
            busy = auth.busy,
            error = auth.error,
            onGoogleToken = authVm::signInBuyerWithGoogle,
            onBack = authVm::backToModeSelection,
        )
        uid == null -> LoginScreen(
            busy = auth.busy,
            error = auth.error,
            onSignIn = authVm::signInEntrepreneur,
            onBackToModes = authVm::backToModeSelection,
        )
        auth.mode == AccountMode.BUYER -> BuyerHomeHost(uid, auth.email, signOut)
        auth.mode == AccountMode.ENTREPRENEUR && !auth.unlocked && biometricAvailable -> {
            val askFingerprint = {
                Biometrics.authenticate(
                    activity = activity,
                    onSuccess = authVm::unlock,
                    onUsePassword = signOut,
                    onError = authVm::showError,
                )
            }
            var prompted by rememberSaveable(uid) { mutableStateOf(false) }
            LaunchedEffect(uid) {
                if (!prompted) {
                    prompted = true
                    askFingerprint()
                }
            }
            LockScreen(
                error = auth.error,
                onUseFingerprint = askFingerprint,
                onUsePassword = signOut,
            )
        }
        auth.mode == AccountMode.ENTREPRENEUR -> HomeHost(uid = uid, onSignOut = signOut)
        else -> AccountModeScreen(authVm::selectMode)
    }
}

@Composable
private fun BuyerHomeHost(uid: String, email: String?, onSignOut: () -> Unit) {
    var page by rememberSaveable { mutableStateOf("catalog") }
    if (page == "fairs") {
        FairsScreen(uid = uid, onBack = { page = "catalog" })
    } else {
        BuyerCatalogScreen(uid = uid, email = email, onSignOut = onSignOut, onFairs = { page = "fairs" })
    }
}

@Composable
private fun HomeHost(uid: String, onSignOut: () -> Unit) {
    var page by rememberSaveable { mutableStateOf("products") }
    var editingProduct by remember { mutableStateOf<Product?>(null) }
    var saleProduct by remember { mutableStateOf<Product?>(null) }
    var message by rememberSaveable { mutableStateOf<String?>(null) }

    when (page) {
        "editor" -> NewProductScreen(
            product = editingProduct,
            onClose = { saved ->
                page = "products"
                if (saved) message = if (editingProduct == null) "Producto publicado." else "Cambios guardados."
                editingProduct = null
            },
        )
        "sales" -> SalesScreen(
            uid = uid,
            initialProduct = saleProduct,
            onBack = {
                page = "products"
                saleProduct = null
            },
        )
        "fairs" -> FairsScreen(uid = uid, onBack = { page = "products" })
        else -> ProductsScreen(
            uid = uid,
            message = message,
            onMessageShown = { message = null },
            onNewProduct = {
                editingProduct = null
                page = "editor"
            },
            onEditProduct = { product ->
                editingProduct = product
                page = "editor"
            },
            onRecordSale = { product ->
                saleProduct = product
                page = "sales"
            },
            onSales = { page = "sales" },
            onFairs = { page = "fairs" },
            onSignOut = onSignOut,
        )
    }
}
