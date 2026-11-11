package com.esp.bora.data

import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class FairRepository(
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance(),
) {
    fun observeUpcomingFairs(): Flow<List<Fair>> = callbackFlow {
        val registration = db.collection("fairs")
            .whereEqualTo("published", true)
            .whereEqualTo("cancelled", false)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                val now = Timestamp.now()
                val fairs = snapshot?.documents.orEmpty()
                    .mapNotNull { document -> document.toObject(Fair::class.java)?.copy(id = document.id) }
                    .filter { it.startsAt == null || it.startsAt >= now }
                    .sortedBy { it.startsAt?.seconds ?: Long.MAX_VALUE }
                trySend(fairs)
            }
        awaitClose { registration.remove() }
    }

    fun observeMyInvitations(uid: String): Flow<List<FairInvitation>> = callbackFlow {
        val registration = db.collectionGroup("participants")
            .whereEqualTo("entrepreneurUid", uid)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                val invitations = snapshot?.documents.orEmpty().mapNotNull { document ->
                    document.toObject(FairInvitation::class.java)?.copy(
                        fairId = document.reference.parent.parent?.id.orEmpty(),
                    )
                }
                trySend(invitations)
            }
        awaitClose { registration.remove() }
    }

    suspend fun respondToInvitation(fairId: String, response: String) {
        require(response in setOf("confirmada", "rechazada"))
        val uid = auth.currentUser?.uid ?: error("Tu sesión expiró. Vuelve a ingresar.")
        val invitation = db.collection("fairs").document(fairId)
            .collection("participants").document(uid)
        db.runTransaction { transaction ->
            val snapshot = transaction.get(invitation)
            check(snapshot.exists()) { "No encontramos una invitación para esta feria." }
            check(snapshot.getString("entrepreneurUid") == uid) { "La invitación no corresponde a tu cuenta." }
            transaction.update(
                invitation,
                mapOf("status" to response, "updatedAt" to FieldValue.serverTimestamp()),
            )
        }.await()
    }
}
