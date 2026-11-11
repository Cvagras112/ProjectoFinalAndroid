package com.esp.bora.data

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.GoogleAuthProvider
import kotlinx.coroutines.tasks.await

enum class AccountMode {
    ENTREPRENEUR,
    BUYER,
}

class AuthRepository(
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
) {
    val currentUser: FirebaseUser? get() = auth.currentUser

    val currentMode: AccountMode?
        get() = auth.currentUser?.let { user ->
            if (user.providerData.any { it.providerId == GoogleAuthProvider.PROVIDER_ID }) {
                AccountMode.BUYER
            } else if (user.email != null) {
                AccountMode.ENTREPRENEUR
            } else null
        }

    suspend fun signInEntrepreneur(email: String, password: String) {
        auth.signInWithEmailAndPassword(email.trim(), password).await()
    }

    suspend fun signInBuyerWithGoogle(idToken: String) {
        val credential = GoogleAuthProvider.getCredential(idToken, null)
        auth.signInWithCredential(credential).await()
    }

    fun signOut() = auth.signOut()
}
