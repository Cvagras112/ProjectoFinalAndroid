package com.esp.bora.data

import com.google.firebase.Timestamp

data class Fair(
    val id: String = "",
    val name: String = "",
    val description: String = "",
    val imageUrl: String = "",
    val address: String = "",
    val latitude: Double = 0.0,
    val longitude: Double = 0.0,
    val startsAt: Timestamp? = null,
    val endsAt: Timestamp? = null,
    val organizer: String = "",
    val published: Boolean = false,
    val cancelled: Boolean = false,
)

data class FairInvitation(
    val fairId: String = "",
    val entrepreneurUid: String = "",
    val entrepreneurName: String = "",
    val status: String = "invitada",
    val invitedBy: String = "",
    val updatedAt: Timestamp? = null,
)
