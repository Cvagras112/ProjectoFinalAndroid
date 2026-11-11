package com.esp.bora.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.esp.bora.data.Product
import com.esp.bora.data.Sale
import com.esp.bora.data.SaleRequest
import java.text.DateFormat
import java.util.Date

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SalesScreen(
    uid: String,
    initialProduct: Product?,
    onBack: () -> Unit,
    vm: SalesViewModel = viewModel(),
) {
    val state by vm.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    var showRegister by rememberSaveable { mutableStateOf(initialProduct != null) }
    var selectedProductId by rememberSaveable { mutableStateOf(initialProduct?.id.orEmpty()) }
    var selectedVariantId by rememberSaveable { mutableStateOf("") }
    var quantity by rememberSaveable { mutableStateOf("1") }
    var placeType by rememberSaveable { mutableStateOf("otro") }
    var placeName by rememberSaveable { mutableStateOf("") }
    var saveHistory by rememberSaveable { mutableStateOf(true) }
    var filterProductId by rememberSaveable { mutableStateOf("") }
    var filterPlaceType by rememberSaveable { mutableStateOf("") }
    var filterFairName by rememberSaveable { mutableStateOf("") }
    var startMillis by rememberSaveable { mutableStateOf<Long?>(null) }
    var endMillis by rememberSaveable { mutableStateOf<Long?>(null) }
    var datePickerTarget by remember { mutableStateOf<String?>(null) }
    val pickerState = rememberDatePickerState()

    LaunchedEffect(uid) { vm.start(uid) }
    LaunchedEffect(initialProduct?.id) {
        selectedProductId = initialProduct?.id.orEmpty()
        selectedVariantId = initialProduct?.variants?.firstOrNull()?.id.orEmpty()
        showRegister = initialProduct != null
    }
    LaunchedEffect(state.message, state.error) {
        val feedback = state.message ?: state.error
        if (feedback != null) {
            snackbar.showSnackbar(feedback)
            if (state.message != null) showRegister = false
            vm.clearFeedback()
        }
    }

    if (datePickerTarget != null) {
        DatePickerDialog(
            onDismissRequest = { datePickerTarget = null },
            confirmButton = {
                TextButton(onClick = {
                    val selected = pickerState.selectedDateMillis
                    if (datePickerTarget == "start") startMillis = selected
                    else endMillis = selected
                    datePickerTarget = null
                }) { Text("Aceptar") }
            },
            dismissButton = { TextButton(onClick = { datePickerTarget = null }) { Text("Cancelar") } },
        ) { DatePicker(state = pickerState) }
    }

    val selectedProduct = state.products.firstOrNull { it.id == selectedProductId }
    val selectedVariant = selectedProduct?.variants?.firstOrNull { it.id == selectedVariantId }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Ventas e historial") },
                navigationIcon = { TextButton(onClick = onBack) { Text("Volver") } },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            if (showRegister) {
                Text("Registrar venta", style = MaterialTheme.typography.titleLarge)
                if (state.products.isEmpty() && !state.loading) {
                    Text("Primero agrega un producto a tu catálogo.")
                } else {
                    ChoiceField(
                        "Producto",
                        selectedProduct?.name ?: "Seleccionar producto",
                        state.products.map { it.name },
                        enabled = !state.busy,
                    ) { name ->
                        selectedProductId = state.products.firstOrNull { it.name == name }?.id.orEmpty()
                        selectedVariantId = ""
                    }
                    if (selectedProduct?.variants?.isNotEmpty() == true) {
                        ChoiceField(
                            "Variante",
                            selectedVariant?.name ?: "Seleccionar variante",
                            selectedProduct.variants.map { it.name },
                            enabled = !state.busy,
                        ) { name ->
                            selectedVariantId = selectedProduct.variants.firstOrNull { it.name == name }?.id.orEmpty()
                        }
                    }
                    OutlinedTextField(
                        value = quantity,
                        onValueChange = { quantity = it.filter(Char::isDigit).take(5) },
                        label = { Text("Cantidad") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    ChoiceField(
                        "Lugar",
                        if (placeType == "feria") "Feria de la plataforma" else "Otro lugar",
                        listOf("Feria de la plataforma", "Otro lugar"),
                        enabled = !state.busy,
                    ) { placeType = if (it.startsWith("Feria")) "feria" else "otro" }
                    OutlinedTextField(
                        value = placeName,
                        onValueChange = { placeName = it.take(100) },
                        label = { Text(if (placeType == "feria") "Nombre de la feria" else "Lugar (opcional)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked = saveHistory, onCheckedChange = { saveHistory = it })
                        Text("Guardar esta venta en el historial")
                    }
                    Button(
                        onClick = {
                            val product = selectedProduct ?: return@Button
                            vm.registerSale(
                                SaleRequest(
                                    productId = product.id,
                                    variantId = selectedVariantId,
                                    quantity = quantity.toIntOrNull() ?: 0,
                                    placeType = placeType,
                                    placeName = placeName,
                                    saveHistory = saveHistory,
                                ),
                            )
                        },
                        enabled = !state.busy && selectedProduct != null,
                        modifier = Modifier.fillMaxWidth().height(52.dp),
                    ) { Text(if (state.busy) "Guardando…" else "Registrar venta") }
                }
                TextButton(onClick = { showRegister = false }) { Text("Cancelar") }
            } else {
                Button(onClick = {
                    showRegister = true
                    if (selectedProductId.isBlank()) selectedProductId = state.products.firstOrNull()?.id.orEmpty()
                }, modifier = Modifier.fillMaxWidth().height(52.dp)) {
                    Text("Registrar venta")
                }
            }

            Text("Historial", style = MaterialTheme.typography.titleLarge)
            ChoiceField(
                "Filtrar por producto",
                state.products.firstOrNull { it.id == filterProductId }?.name ?: "Todos los productos",
                listOf("Todos los productos") + state.products.map { it.name },
            ) { name ->
                filterProductId = if (name == "Todos los productos") "" else
                    state.products.firstOrNull { it.name == name }?.id.orEmpty()
            }
            ChoiceField(
                "Filtrar por lugar",
                when (filterPlaceType) { "feria" -> "Ferias"; "otro" -> "Otro lugar"; else -> "Todos los lugares" },
                listOf("Todos los lugares", "Ferias", "Otro lugar"),
            ) {
                filterPlaceType = when (it) { "Ferias" -> "feria"; "Otro lugar" -> "otro"; else -> "" }
                if (filterPlaceType != "feria") filterFairName = ""
            }
            if (filterPlaceType == "feria") {
                val fairNames = state.sales
                    .filter { it.placeType == "feria" && it.placeName.isNotBlank() }
                    .map { it.placeName }
                    .distinct()
                    .sorted()
                ChoiceField(
                    "Filtrar por feria",
                    filterFairName.ifBlank { "Todas las ferias" },
                    listOf("Todas las ferias") + fairNames,
                ) { name ->
                    filterFairName = if (name == "Todas las ferias") "" else name
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { datePickerTarget = "start" }, modifier = Modifier.weight(1f)) {
                    Text("Desde: ${startMillis?.let(::dateLabel) ?: "cualquiera"}")
                }
                OutlinedButton(onClick = { datePickerTarget = "end" }, modifier = Modifier.weight(1f)) {
                    Text("Hasta: ${endMillis?.let(::dateLabel) ?: "cualquiera"}")
                }
            }
            TextButton(onClick = {
                startMillis = null
                endMillis = null
                filterPlaceType = ""
                filterFairName = ""
                filterProductId = ""
            }) { Text("Limpiar filtros") }

            val visibleSales = state.sales.filter { sale ->
                val productMatches = filterProductId.isBlank() || sale.productId == filterProductId
                val placeMatches = filterPlaceType.isBlank() || sale.placeType == filterPlaceType
                val fairMatches = filterFairName.isBlank() || sale.placeName == filterFairName
                val time = sale.soldAt?.toDate()?.time
                val startMatches = startMillis == null || (time != null && time >= startMillis!!)
                val endMatches = endMillis == null || (time != null && time < endMillis!! + MILLIS_PER_DAY)
                productMatches && placeMatches && fairMatches && startMatches && endMatches
            }
            if (state.loading && state.sales.isEmpty()) {
                Text("Cargando historial…")
            } else if (visibleSales.isEmpty()) {
                Text("No hay ventas que coincidan con estos filtros.")
            } else {
                visibleSales.forEach { sale -> SaleCard(sale) }
            }
        }
    }
}

private const val MILLIS_PER_DAY = 86_400_000L

private fun dateLabel(millis: Long): String =
    DateFormat.getDateInstance(DateFormat.SHORT).format(Date(millis))

@Composable
private fun SaleCard(sale: Sale) {
    androidx.compose.material3.Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(sale.productName, style = MaterialTheme.typography.titleMedium)
            if (sale.variantName.isNotBlank()) Text("Variante: ${sale.variantName}")
            Text("${sale.quantity} × ${formatClp(sale.unitPrice)} = ${formatClp(sale.totalPrice)}")
            Text(
                "${if (sale.placeType == "feria") "Feria" else "Otro lugar"}: ${sale.placeName.ifBlank { "Sin especificar" }}",
                style = MaterialTheme.typography.bodySmall,
            )
            Text(sale.soldAt?.let { DateFormat.getDateTimeInstance().format(it.toDate()) } ?: "Fecha pendiente")
        }
    }
}

@Composable
private fun ChoiceField(
    label: String,
    selected: String,
    options: List<String>,
    enabled: Boolean = true,
    onSelect: (String) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    Column {
        Text(label, style = MaterialTheme.typography.labelLarge)
        androidx.compose.foundation.layout.Box {
            OutlinedButton(onClick = { expanded = true }, enabled = enabled, modifier = Modifier.fillMaxWidth()) {
                Text(selected)
            }
            DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                options.forEach { option ->
                    DropdownMenuItem(text = { Text(option) }, onClick = {
                        onSelect(option)
                        expanded = false
                    })
                }
            }
        }
    }
}
