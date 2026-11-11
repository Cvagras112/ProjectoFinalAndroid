package com.esp.bora.ui

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.esp.bora.data.Product
import com.esp.bora.data.ProductOptions
import java.io.File

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NewProductScreen(
    onClose: (saved: Boolean) -> Unit,
    product: Product? = null,
    vm: NewProductViewModel = viewModel(),
) {
    val state by vm.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var pendingCameraUri by rememberSaveable { mutableStateOf<Uri?>(null) }
    var galleryVariantId by rememberSaveable { mutableStateOf<String?>(null) }

    val camera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { saved ->
        if (saved) vm.onPhotoTaken(pendingCameraUri)
    }
    val gallery = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            runCatching {
                context.contentResolver.takePersistableUriPermission(
                    uri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION,
                )
            }
            val variantId = galleryVariantId
            if (variantId == null) vm.onPhotoTaken(uri) else vm.onVariantPhotoTaken(variantId, uri)
        }
    }

    fun takePhoto() {
        val dir = File(context.filesDir, "photos").apply { mkdirs() }
        val file = File(dir, "product_${System.currentTimeMillis()}.jpg")
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        pendingCameraUri = uri
        try {
            camera.launch(uri)
        } catch (e: ActivityNotFoundException) {
            vm.showError("No se encontró una app de cámara en este teléfono.")
        }
    }

    fun chooseGallery(variantId: String? = null) {
        galleryVariantId = variantId
        gallery.launch(arrayOf("image/*"))
    }

    fun cancel() {
        onClose(false)
    }

    LaunchedEffect(product?.id) { vm.load(product) }
    BackHandler(enabled = !state.saving) { cancel() }
    LaunchedEffect(state.done) {
        if (state.done) {
            vm.reset()
            onClose(true)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (product == null) "Nuevo producto" else "Editar producto") },
                navigationIcon = {
                    TextButton(onClick = { cancel() }, enabled = !state.saving) { Text("Cancelar") }
                },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .consumeWindowInsets(padding)
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            val mainImage = state.photoUri ?: state.existingImageUrl.takeIf(String::isNotBlank)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(4f / 3f)
                    .clip(RoundedCornerShape(16.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant),
                contentAlignment = Alignment.Center,
            ) {
                if (mainImage != null) {
                    AsyncImage(
                        model = mainImage,
                        contentDescription = "Foto del producto",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                } else {
                    Text("Agrega una foto del producto", textAlign = TextAlign.Center)
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = ::takePhoto, enabled = !state.saving, modifier = Modifier.weight(1f)) {
                    Text("Tomar foto")
                }
                OutlinedButton(onClick = { chooseGallery() }, enabled = !state.saving, modifier = Modifier.weight(1f)) {
                    Text("Elegir de galería")
                }
            }

            OutlinedTextField(
                value = state.name,
                onValueChange = vm::onName,
                label = { Text("Nombre del producto") },
                singleLine = true,
                enabled = !state.saving,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = state.description,
                onValueChange = vm::onDescription,
                label = { Text("Descripción") },
                minLines = 2,
                maxLines = 5,
                enabled = !state.saving,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = state.price,
                onValueChange = vm::onPrice,
                label = { Text("Precio (pesos chilenos)") },
                prefix = { Text("$") },
                singleLine = true,
                enabled = !state.saving,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(),
            )
            DropdownChoice(
                label = "Categoría",
                selected = state.category,
                options = ProductOptions.categories,
                enabled = !state.saving,
                onSelect = vm::onCategory,
            )
            OutlinedTextField(
                value = state.productType,
                onValueChange = vm::onProductType,
                label = { Text("Tipo de producto (por ejemplo, alimento o textil)") },
                singleLine = true,
                enabled = !state.saving,
                modifier = Modifier.fillMaxWidth(),
            )
            DropdownChoice(
                label = "Modalidad",
                selected = state.modality,
                options = ProductOptions.modalities,
                enabled = !state.saving,
                onSelect = vm::onModality,
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Column(Modifier.weight(1f)) {
                    Text("Manejar stock", style = MaterialTheme.typography.titleSmall)
                    Text("Controla las unidades disponibles.", style = MaterialTheme.typography.bodySmall)
                }
                Switch(
                    checked = state.managesStock || state.variants.isNotEmpty(),
                    onCheckedChange = vm::onManagesStock,
                    enabled = state.variants.isEmpty() && !state.saving,
                )
            }
            if (state.managesStock && state.variants.isEmpty()) {
                OutlinedTextField(
                    value = state.stock,
                    onValueChange = vm::onStock,
                    label = { Text("Unidades disponibles") },
                    singleLine = true,
                    enabled = !state.saving,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth(),
                )
                DropdownChoice(
                    label = "Cuando se agote",
                    selected = state.exhaustedBehavior,
                    options = ProductOptions.exhaustedBehaviors,
                    enabled = !state.saving,
                    onSelect = vm::onExhaustedBehavior,
                )
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Checkbox(
                    checked = state.available,
                    onCheckedChange = vm::onAvailable,
                    enabled = !state.saving,
                )
                Text("Disponible en mi catálogo")
            }

            Text("Variantes", style = MaterialTheme.typography.titleMedium)
            Text(
                "Agrega opciones como talla o color. Cada variante tiene precio, foto y stock propios.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            state.variants.forEach { variant ->
                Card(Modifier.fillMaxWidth()) {
                    Column(
                        Modifier.padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        val variantImage = variant.photoUri ?: variant.existingImageUrl.takeIf(String::isNotBlank)
                        if (variantImage != null) {
                            AsyncImage(
                                model = variantImage,
                                contentDescription = "Foto de ${variant.name}",
                                contentScale = ContentScale.Crop,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(150.dp)
                                    .clip(RoundedCornerShape(12.dp)),
                            )
                        }
                        OutlinedButton(
                            onClick = { chooseGallery(variant.id) },
                            enabled = !state.saving,
                            modifier = Modifier.fillMaxWidth(),
                        ) { Text("Elegir foto de variante") }
                        OutlinedTextField(
                            value = variant.name,
                            onValueChange = { vm.updateVariantName(variant.id, it) },
                            label = { Text("Opción (por ejemplo, talla M)") },
                            singleLine = true,
                            enabled = !state.saving,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        OutlinedTextField(
                            value = variant.price,
                            onValueChange = { vm.updateVariantPrice(variant.id, it) },
                            label = { Text("Precio de la variante") },
                            prefix = { Text("$") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            enabled = !state.saving,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        OutlinedTextField(
                            value = variant.stock,
                            onValueChange = { vm.updateVariantStock(variant.id, it) },
                            label = { Text("Stock de la variante") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            enabled = !state.saving,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        TextButton(onClick = { vm.removeVariant(variant.id) }, enabled = !state.saving) {
                            Text("Quitar variante")
                        }
                    }
                }
            }
            OutlinedButton(onClick = vm::addVariant, enabled = !state.saving, modifier = Modifier.fillMaxWidth()) {
                Text("Agregar variante")
            }

            state.error?.let {
                Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
            }
            Button(
                onClick = vm::save,
                enabled = !state.saving,
                modifier = Modifier.fillMaxWidth().height(52.dp),
            ) {
                if (state.saving) {
                    CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.width(12.dp))
                    Text("Guardando…")
                } else {
                    Text(if (product == null) "Publicar producto" else "Guardar cambios")
                }
            }
        }
    }
}

@Composable
private fun DropdownChoice(
    label: String,
    selected: String,
    options: List<String>,
    enabled: Boolean,
    onSelect: (String) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    Column {
        Text(label, style = MaterialTheme.typography.labelLarge)
        Box {
            OutlinedButton(onClick = { expanded = true }, enabled = enabled, modifier = Modifier.fillMaxWidth()) {
                Text(selected)
            }
            DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                options.forEach { option ->
                    DropdownMenuItem(
                        text = { Text(option) },
                        onClick = {
                            onSelect(option)
                            expanded = false
                        },
                    )
                }
            }
        }
    }
}
