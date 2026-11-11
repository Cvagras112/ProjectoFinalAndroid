package com.esp.bora.data

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class SalesRepository(
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance(),
) {
    fun observeMySales(uid: String): Flow<List<Sale>> = callbackFlow {
        val registration = db.collection("sales")
            .whereEqualTo("ownerUid", uid)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                val sales = snapshot?.documents
                    ?.mapNotNull { doc -> doc.toObject(Sale::class.java)?.copy(id = doc.id) }
                    ?.sortedWith(
                        compareByDescending<Sale> { it.soldAt?.seconds ?: 0L }
                            .thenByDescending { it.soldAt?.nanoseconds ?: 0 },
                    )
                    ?: emptyList()
                trySend(sales)
            }
        awaitClose { registration.remove() }
    }

    /** Descuenta inventario y crea el registro en una sola transacción. */
    suspend fun registerSale(request: SaleRequest): String {
        require(request.quantity > 0) { "La cantidad debe ser mayor que cero." }
        require(request.placeType in setOf("feria", "otro")) { "Selecciona dónde se realizó la venta." }
        val ownerUid = auth.currentUser?.uid ?: error("Tu sesión expiró. Vuelve a ingresar.")
        val productRef = db.collection("products").document(request.productId)
        val saleRef = db.collection("sales").document()

        return db.runTransaction { transaction ->
            val productSnapshot = transaction.get(productRef)
            val product = productSnapshot.toObject(Product::class.java)
                ?: throw IllegalStateException("El producto ya no existe.")
            if (product.ownerUid != ownerUid) {
                throw SecurityException("Solo puedes registrar ventas de tus productos.")
            }
            if (!product.available || product.sold) {
                throw IllegalStateException("Este producto no está disponible para vender.")
            }

            val variant = if (product.variants.isNotEmpty()) {
                product.variants.firstOrNull { it.id == request.variantId }
                    ?: throw IllegalStateException("Selecciona una variante.")
            } else null

            if (product.modality == "Pieza única" && request.quantity != 1) {
                throw IllegalArgumentException("Una pieza única se registra de a una.")
            }
            val allowMadeToOrderWhenStockIsInsufficient =
                product.managesStock && product.exhaustedBehavior == "A pedido"
            if (product.managesStock && !allowMadeToOrderWhenStockIsInsufficient) {
                val availableStock = variant?.stock ?: product.stock
                if (availableStock < request.quantity) {
                    throw IllegalStateException("No hay suficientes unidades disponibles.")
                }
            }

            val updates = mutableMapOf<String, Any>(
                "updatedAt" to FieldValue.serverTimestamp(),
            )
            if (product.managesStock) {
                if (variant != null) {
                    val updatedVariants = product.variants.map {
                        if (it.id == variant.id) it.copy(stock = maxOf(0, it.stock - request.quantity)) else it
                    }
                    updates["variants"] = updatedVariants.map { it.toFirestoreMap() }
                } else {
                    updates["stock"] = maxOf(0, product.stock - request.quantity)
                }
            }
            if (product.modality == "Pieza única") {
                updates["sold"] = true
                updates["available"] = false
            }
            transaction.update(productRef, updates)

            val unitPrice = variant?.price ?: product.price
            if (request.saveHistory) {
                transaction.set(
                    saleRef,
                    mapOf(
                        "ownerUid" to ownerUid,
                        "productId" to product.id.ifBlank { request.productId },
                        "productName" to product.name,
                        "variantId" to variant?.id.orEmpty(),
                        "variantName" to variant?.name.orEmpty(),
                        "quantity" to request.quantity,
                        "unitPrice" to unitPrice,
                        "totalPrice" to unitPrice * request.quantity,
                        "placeType" to request.placeType,
                        "placeName" to request.placeName.trim().take(100),
                        "soldAt" to FieldValue.serverTimestamp(),
                    ),
                )
            }
            saleRef.id
        }.await()
    }
}

private fun ProductVariant.toFirestoreMap(): Map<String, Any> = mapOf(
    "id" to id,
    "name" to name,
    "price" to price,
    "stock" to stock,
    "imageUrl" to imageUrl,
    "imagePath" to imagePath,
)
