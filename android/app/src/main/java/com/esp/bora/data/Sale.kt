package com.esp.bora.data

import com.google.firebase.Timestamp

data class Sale(
    val id: String = "",
    val ownerUid: String = "",
    val productId: String = "",
    val productName: String = "",
    val variantId: String = "",
    val variantName: String = "",
    val quantity: Int = 1,
    val unitPrice: Long = 0L,
    val totalPrice: Long = 0L,
    /** "feria" o "otro". */
    val placeType: String = "otro",
    val placeName: String = "",
    val soldAt: Timestamp? = null,
)

data class SaleRequest(
    val productId: String,
    val variantId: String = "",
    val quantity: Int,
    val placeType: String,
    val placeName: String = "",
    val saveHistory: Boolean = true,
)
