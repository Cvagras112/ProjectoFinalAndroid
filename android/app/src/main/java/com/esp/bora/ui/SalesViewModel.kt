package com.esp.bora.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.esp.bora.data.Product
import com.esp.bora.data.ProductRepository
import com.esp.bora.data.Sale
import com.esp.bora.data.SaleRequest
import com.esp.bora.data.SalesRepository
import com.esp.bora.data.toUserMessage
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class SalesUiState(
    val loading: Boolean = true,
    val products: List<Product> = emptyList(),
    val sales: List<Sale> = emptyList(),
    val busy: Boolean = false,
    val error: String? = null,
    val message: String? = null,
)

class SalesViewModel(
    private val productsRepo: ProductRepository = ProductRepository(),
    private val salesRepo: SalesRepository = SalesRepository(),
) : ViewModel() {
    private val _state = MutableStateFlow(SalesUiState())
    val state: StateFlow<SalesUiState> = _state.asStateFlow()
    private var productsJob: Job? = null
    private var salesJob: Job? = null
    private var currentUid: String? = null

    fun start(uid: String) {
        if (uid == currentUid && productsJob?.isActive == true && salesJob?.isActive == true) return
        currentUid = uid
        productsJob?.cancel()
        salesJob?.cancel()
        _state.value = SalesUiState()
        productsJob = viewModelScope.launch {
            productsRepo.observeMyProducts(uid)
                .catch { e -> _state.update { it.copy(loading = false, error = e.toUserMessage()) } }
                .collect { products ->
                    _state.update { it.copy(loading = false, products = products) }
                }
        }
        salesJob = viewModelScope.launch {
            salesRepo.observeMySales(uid)
                .catch { e -> _state.update { it.copy(error = e.toUserMessage()) } }
                .collect { sales -> _state.update { it.copy(sales = sales) } }
        }
    }

    fun registerSale(request: SaleRequest) {
        if (_state.value.busy) return
        viewModelScope.launch {
            _state.update { it.copy(busy = true, error = null, message = null) }
            try {
                salesRepo.registerSale(request)
                _state.update {
                    it.copy(
                        busy = false,
                        message = if (request.saveHistory) "Venta guardada en el historial."
                        else "Venta registrada y stock actualizado.",
                    )
                }
            } catch (e: Exception) {
                _state.update { it.copy(busy = false, error = e.toUserMessage()) }
            }
        }
    }

    fun clearFeedback() = _state.update { it.copy(error = null, message = null) }
}
