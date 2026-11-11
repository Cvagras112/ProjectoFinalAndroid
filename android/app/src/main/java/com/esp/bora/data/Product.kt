package com.esp.bora.data

import com.google.firebase.Timestamp

/** Estados persistidos en Firestore. */
object ProductOptions {
    val categories = listOf(
        "Artesanía", "Alimentos", "Textil", "Joyería",
        "Hogar y decoración", "Cosmética", "Otro",
    )
    val modalities = listOf("Regular", "A pedido", "Pieza única")
    val exhaustedBehaviors = listOf("Mostrar agotado", "Ocultar", "A pedido")
}

data class ProductVariant(
    val id: String = "",
    val name: String = "",
    val price: Long = 0L,
    val stock: Int = 0,
    val imageUrl: String = "",
    val imagePath: String = "",
)

data class Product(
    val id: String = "",
    val storeId: String = "",
    val ownerUid: String = "",
    val name: String = "",
    val description: String = "",
    /** Precio en pesos chilenos, sin decimales. */
    val price: Long = 0L,
    val imageUrl: String = "",
    val imagePath: String = "",
    val category: String = "Otro",
    val productType: String = "General",
    val modality: String = "Regular",
    val managesStock: Boolean = false,
    val stock: Int = 0,
    val exhaustedBehavior: String = "Mostrar agotado",
    val available: Boolean = true,
    val sold: Boolean = false,
    val variants: List<ProductVariant> = emptyList(),
    val createdAt: Timestamp? = null,
    val updatedAt: Timestamp? = null,
) {
    val totalStock: Int
        get() = if (variants.isNotEmpty()) variants.sumOf { it.stock } else stock

    /** Regla de visibilidad para catálogos públicos y de compradores. */
    val visibleInPublicCatalog: Boolean
        get() {
            if (!available || sold) return false
            if (!managesStock || totalStock > 0) return true
            return exhaustedBehavior != "Ocultar"
        }

    val isSoldOut: Boolean
        get() = managesStock && totalStock <= 0 && exhaustedBehavior == "Mostrar agotado"

    val isMadeToOrder: Boolean
        get() = modality == "A pedido" ||
            (managesStock && totalStock <= 0 && exhaustedBehavior == "A pedido")
}

/** Datos para una línea de variante dentro del editor. */
data class ProductVariantDraft(
    val id: String = java.util.UUID.randomUUID().toString(),
    val name: String = "",
    val price: String = "",
    val stock: String = "0",
    val photoUri: android.net.Uri? = null,
    val existingImageUrl: String = "",
    val existingImagePath: String = "",
)
