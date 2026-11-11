package com.esp.bora.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.esp.bora.data.AccountMode
import com.esp.bora.data.AuthRepository
import com.esp.bora.data.toUserMessage
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class AuthUiState(
    val uid: String? = null,
    val email: String? = null,
    val mode: AccountMode? = null,
    val selectedMode: AccountMode? = null,
    val guest: Boolean = false,
    val unlocked: Boolean = false,
    val busy: Boolean = false,
    val error: String? = null,
) {
    val signedIn: Boolean get() = uid != null
}

class AuthViewModel(
    private val repo: AuthRepository = AuthRepository(),
) : ViewModel() {
    private val _state = MutableStateFlow(
        AuthUiState(
            uid = repo.currentUser?.uid,
            email = repo.currentUser?.email,
            mode = repo.currentMode,
            unlocked = repo.currentMode == AccountMode.BUYER,
        ),
    )
    val state: StateFlow<AuthUiState> = _state.asStateFlow()

    fun selectMode(mode: AccountMode) {
        if (_state.value.uid != null) return
        _state.update { it.copy(selectedMode = mode, error = null) }
    }

    fun backToModeSelection() {
        if (_state.value.uid == null && !_state.value.busy) {
            _state.update { it.copy(selectedMode = null, error = null) }
        }
    }

    fun signInEntrepreneur(email: String, password: String) {
        if (_state.value.busy) return
        if (email.isBlank() || password.isEmpty()) {
            _state.update { it.copy(error = "Ingresa tu correo y tu contraseña.") }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(busy = true, error = null) }
            try {
                repo.signInEntrepreneur(email, password)
                val user = repo.currentUser
                _state.value = AuthUiState(
                    uid = user?.uid,
                    email = user?.email,
                    mode = AccountMode.ENTREPRENEUR,
                    selectedMode = AccountMode.ENTREPRENEUR,
                    unlocked = true,
                )
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                _state.update { it.copy(busy = false, error = e.toUserMessage()) }
            }
        }
    }

    fun signInBuyerWithGoogle(idToken: String) {
        if (_state.value.busy) return
        viewModelScope.launch {
            _state.update { it.copy(busy = true, error = null) }
            try {
                repo.signInBuyerWithGoogle(idToken)
                val user = repo.currentUser
                _state.value = AuthUiState(
                    uid = user?.uid,
                    email = user?.email,
                    mode = AccountMode.BUYER,
                    selectedMode = AccountMode.BUYER,
                    unlocked = true,
                )
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                _state.update { it.copy(busy = false, error = e.toUserMessage()) }
            }
        }
    }

    fun showError(message: String) {
        _state.update { it.copy(error = message) }
    }

    fun unlock() {
        _state.update { it.copy(unlocked = true, error = null) }
    }

    fun signOut() {
        repo.signOut()
        _state.value = AuthUiState()
    }
}
