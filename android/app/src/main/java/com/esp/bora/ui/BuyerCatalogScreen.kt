package com.esp.bora.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.esp.bora.data.Product
import com.esp.bora.data.ProductRepository
import com.esp.bora.data.FollowRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch

data class BuyerCatalogUiState(
    val loading: Boolean = true,
    val products: List<Product> = emptyList(),
    val error: String? = null,
    val followedStoreIds: Set<String> = emptySet(),
)

class BuyerCatalogViewModel(
    private val repo: ProductRepository = ProductRepository(),
    private val followRepository: FollowRepository = FollowRepository(),
) : ViewModel() {
    private var followedUid: String? = null
    private val _state = MutableStateFlow(BuyerCatalogUiState())
    val state: StateFlow<BuyerCatalogUiState> = _state

    fun startFollowing(uid: String) {
        if (followedUid == uid) return
        followedUid = uid
        viewModelScope.launch {
            followRepository.observeFollowedStores(uid)
                .catch { error -> _state.value = _state.value.copy(error = error.message) }
                .collect { ids -> _state.value = _state.value.copy(followedStoreIds = ids) }
        }
    }

    fun toggleFollow(uid: String, storeId: String, notificationsEnabled: Boolean) {
        viewModelScope.launch {
            val following = storeId !in _state.value.followedStoreIds
            runCatching {
                followRepository.setStoreFollow(uid, storeId, following, notificationsEnabled)
            }.onFailure { error -> _state.value = _state.value.copy(error = error.message) }
        }
    }

    init {
        viewModelScope.launch {
            repo.observePublicProducts()
                .catch { error -> _state.value = _state.value.copy(loading = false, error = error.message) }
                .collect { products -> _state.value = _state.value.copy(loading = false, products = products) }
        }
    }
}

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun BuyerCatalogScreen(
    uid: String,
    email: String?,
    onSignOut: () -> Unit,
    onFairs: () -> Unit,
    vm: BuyerCatalogViewModel = viewModel(),
) {
    val state by vm.state.collectAsStateWithLifecycle()
    val visible = state.products.filter { it.visibleInPublicCatalog }
    val context = androidx.compose.ui.platform.LocalContext.current
    var pendingStoreId by remember { mutableStateOf<String?>(null) }
    val notificationPermission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        pendingStoreId?.let { vm.toggleFollow(uid, it, granted) }
        pendingStoreId = null
    }
    LaunchedEffect(uid) { vm.startFollowing(uid) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Explorar BORA") },
                actions = {
                    TextButton(onClick = onFairs) { Text("Ferias") }
                    TextButton(onClick = onSignOut) { Text("Salir") }
                },
            )
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            if (!email.isNullOrBlank()) {
                Text(
                    "Sesión de comprador · $email",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                )
            }
            when {
                state.loading -> CircularProgressIndicator(Modifier.padding(24.dp))
                state.error != null -> Text(
                    "No se pudo cargar el catálogo. Revisa tu conexión.",
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(24.dp),
                )
                visible.isEmpty() -> Text(
                    "Todavía no hay productos disponibles.",
                    modifier = Modifier.padding(24.dp),
                )
                else -> LazyColumn(
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    items(visible, key = { it.id }) { product ->
                        BuyerProductCard(
                            product = product,
                            isFollowing = product.storeId in state.followedStoreIds,
                            onToggleFollow = {
                                if (product.storeId in state.followedStoreIds) {
                                    vm.toggleFollow(uid, product.storeId, notificationsEnabled = false)
                                } else if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(
                                        context,
                                        Manifest.permission.POST_NOTIFICATIONS,
                                    ) != PackageManager.PERMISSION_GRANTED
                                ) {
                                    pendingStoreId = product.storeId
                                    notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
                                } else {
                                    vm.toggleFollow(uid, product.storeId, notificationsEnabled = true)
                                }
                            },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun BuyerProductCard(product: Product, isFollowing: Boolean, onToggleFollow: () -> Unit) {
    var selectedVariantId by remember(product.id) {
        mutableStateOf(product.variants.firstOrNull()?.id.orEmpty())
    }
    val selectedVariant = product.variants.firstOrNull { it.id == selectedVariantId }
    val image = selectedVariant?.imageUrl?.takeIf(String::isNotBlank) ?: product.imageUrl
    Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp)) {
        Column {
            AsyncImage(
                model = image,
                contentDescription = product.name,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxWidth().aspectRatio(4f / 3f),
            )
            Column(Modifier.padding(16.dp)) {
                Text(product.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Text(
                    formatClp(selectedVariant?.price ?: product.price),
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    when {
                        product.isSoldOut -> "Agotado"
                        product.isMadeToOrder -> "A pedido"
                        else -> "${product.category} · ${product.productType}"
                    },
                    style = MaterialTheme.typography.bodySmall,
                )
                if (product.variants.isNotEmpty()) {
                    Spacer(Modifier.height(8.dp))
                    Text("Opciones", style = MaterialTheme.typography.labelLarge)
                    product.variants.forEach { variant ->
                        TextButton(onClick = { selectedVariantId = variant.id }) {
                            Text(
                                (if (variant.id == selectedVariantId) "✓ " else "") +
                                    "${variant.name} · ${formatClp(variant.price)}" +
                                    if (product.managesStock) " · Stock ${variant.stock}" else "",
                            )
                        }
                    }
                }
                if (!product.managesStock && product.modality == "Pieza única") {
                    Text("Pieza única", style = MaterialTheme.typography.bodySmall)
                }
                if (product.storeId.isNotBlank()) {
                    TextButton(onClick = onToggleFollow) {
                        Text(if (isFollowing) "Dejar de seguir tienda" else "Seguir tienda y recibir avisos")
                    }
                }
            }
        }
    }
}
