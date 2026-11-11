package com.esp.bora.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.esp.bora.data.Fair
import com.esp.bora.data.FairInvitation
import com.esp.bora.data.FairRepository
import com.esp.bora.data.toUserMessage
import com.google.firebase.Timestamp
import java.text.DateFormat
import java.util.Date
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class FairsUiState(
    val loading: Boolean = true,
    val fairs: List<Fair> = emptyList(),
    val invitations: List<FairInvitation> = emptyList(),
    val message: String? = null,
    val error: String? = null,
)

class FairsViewModel(private val repo: FairRepository = FairRepository()) : ViewModel() {
    private var fairsJob: Job? = null
    private var invitationsJob: Job? = null
    private var currentUid: String? = null
    private val _state = MutableStateFlow(FairsUiState())
    val state: StateFlow<FairsUiState> = _state

    fun start(uid: String?) {
        if (currentUid == uid && fairsJob?.isActive == true) return
        currentUid = uid
        fairsJob?.cancel()
        invitationsJob?.cancel()
        _state.update { it.copy(loading = true, error = null) }
        fairsJob = viewModelScope.launch {
            repo.observeUpcomingFairs()
                .catch { e -> _state.update { it.copy(loading = false, error = e.toUserMessage()) } }
                .collect { fairs -> _state.update { it.copy(loading = false, fairs = fairs) } }
        }
        if (uid != null) invitationsJob = viewModelScope.launch {
            repo.observeMyInvitations(uid)
                .catch { e -> _state.update { it.copy(error = e.toUserMessage()) } }
                .collect { invitations -> _state.update { it.copy(invitations = invitations) } }
        }
    }

    fun stop() {
        fairsJob?.cancel()
        invitationsJob?.cancel()
        fairsJob = null
        invitationsJob = null
    }

    fun respond(fairId: String, response: String) {
        viewModelScope.launch {
            try {
                repo.respondToInvitation(fairId, response)
                _state.update { it.copy(message = if (response == "confirmada") "Confirmaste tu participación." else "Rechazaste la invitación.") }
            } catch (e: Exception) {
                _state.update { it.copy(error = e.toUserMessage()) }
            }
        }
    }

    fun reportError(message: String) = _state.update { it.copy(error = message) }

    fun clearFeedback() = _state.update { it.copy(message = null, error = null) }
}

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun FairsScreen(
    uid: String?,
    onBack: () -> Unit,
    vm: FairsViewModel = viewModel(),
) {
    val state by vm.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    val context = LocalContext.current
    var deviceLocation by remember { mutableStateOf<Location?>(null) }
    val locationPermission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { result ->
        if (result.values.any { it }) {
            val manager = context.getSystemService(LocationManager::class.java)
            deviceLocation = runCatching {
                manager.getProviders(true)
                    .mapNotNull { provider -> manager.getLastKnownLocation(provider) }
                    .maxByOrNull { it.time }
            }.getOrNull()
        }
    }
    val orderedFairs = deviceLocation?.let { location ->
        state.fairs.sortedBy { fair -> distanceMeters(location, fair) }
    } ?: state.fairs
    DisposableEffect(uid) {
        vm.start(uid)
        onDispose { vm.stop() }
    }
    LaunchedEffect(state.message, state.error) {
        val feedback = state.message ?: state.error
        if (feedback != null) {
            snackbar.showSnackbar(feedback)
            vm.clearFeedback()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Ferias") },
                navigationIcon = { TextButton(onClick = onBack) { Text("Volver") } },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        when {
            state.loading -> CircularProgressIndicator(Modifier.padding(padding).padding(24.dp))
            state.error != null -> Text("No se pudieron cargar las ferias. Revisa tu conexión.", Modifier.padding(padding).padding(24.dp), color = MaterialTheme.colorScheme.error)
            state.fairs.isEmpty() -> Text("No hay próximas ferias publicadas.", Modifier.padding(padding).padding(24.dp))
            else -> LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                item {
                    TextButton(onClick = {
                        val fine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                        val coarse = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
                        if (fine || coarse) {
                            val manager = context.getSystemService(LocationManager::class.java)
                            deviceLocation = runCatching {
                                manager.getProviders(true)
                                    .mapNotNull { provider -> manager.getLastKnownLocation(provider) }
                                    .maxByOrNull { it.time }
                            }.getOrNull()
                        } else {
                            locationPermission.launch(arrayOf(
                                Manifest.permission.ACCESS_FINE_LOCATION,
                                Manifest.permission.ACCESS_COARSE_LOCATION,
                            ))
                        }
                    }) {
                        Text(if (deviceLocation == null) "Ordenar por cercanía (usa tu ubicación ahora)" else "Ferias ordenadas por cercanía")
                    }
                    if (deviceLocation == null) {
                        Text("Si rechazas el permiso o no hay ubicación reciente, las ferias se ordenan por fecha.", style = MaterialTheme.typography.bodySmall)
                    }
                }
                items(orderedFairs, key = { it.id }) { fair ->
                    val invitation = state.invitations.firstOrNull { it.fairId == fair.id }
                    FairCard(
                        fair = fair,
                        invitation = invitation,
                        onRespond = { response -> vm.respond(fair.id, response) },
                        onDirections = {
                            val query = Uri.encode("${fair.latitude},${fair.longitude} ${fair.address}")
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=$query"))
                            runCatching { context.startActivity(intent) }
                                .onFailure { vm.reportError("No se encontró una aplicación de mapas en este teléfono.") }
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun FairCard(
    fair: Fair,
    invitation: FairInvitation?,
    onRespond: (String) -> Unit,
    onDirections: () -> Unit,
) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(fair.name, style = MaterialTheme.typography.titleLarge)
            if (fair.description.isNotBlank()) Text(fair.description)
            Text("Lugar: ${fair.address.ifBlank { "Ubicación por confirmar" }}")
            Text("Fecha: ${fair.startsAt?.let(::formatFairDate) ?: "Por confirmar"}")
            if (fair.organizer.isNotBlank()) Text("Organiza: ${fair.organizer}")
            if (invitation != null) {
                Text("Tu invitación: ${invitation.status.replaceFirstChar(Char::uppercase)}")
                if (invitation.status == "invitada") {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(onClick = { onRespond("confirmada") }) { Text("Participo") }
                        TextButton(onClick = { onRespond("rechazada") }) { Text("No participo") }
                    }
                }
            }
            TextButton(onClick = onDirections) { Text("Cómo llegar") }
        }
    }
}

private fun distanceMeters(from: Location, fair: Fair): Float {
    val result = FloatArray(1)
    Location.distanceBetween(from.latitude, from.longitude, fair.latitude, fair.longitude, result)
    return result[0]
}

private fun formatFairDate(timestamp: Timestamp): String =
    DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT)
        .format(Date(timestamp.seconds * 1000L))
