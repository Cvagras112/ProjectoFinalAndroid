package com.esp.bora.data

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import java.security.MessageDigest

class FollowRepository(
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance(),
    private val messaging: FirebaseMessaging = FirebaseMessaging.getInstance(),
) {
    fun observeFollowedStores(uid: String): Flow<Set<String>> = callbackFlow {
        val registration = db.collection("users").document(uid).collection("follows")
            .whereEqualTo("targetType", "store")
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                trySend(snapshot?.documents.orEmpty().mapNotNull { it.getString("targetId") }.toSet())
            }
        awaitClose { registration.remove() }
    }

    suspend fun setStoreFollow(uid: String, storeId: String, following: Boolean, notificationsEnabled: Boolean) {
        require(auth.currentUser?.uid == uid) { "Inicia sesión para seguir una tienda." }
        require(storeId.isNotBlank())
        val follow = db.collection("users").document(uid).collection("follows")
            .document("store_$storeId")
        if (!following) {
            follow.delete().await()
            val remainingAlerts = db.collection("users").document(uid).collection("follows")
                .whereEqualTo("notificationsEnabled", true)
                .limit(1)
                .get()
                .await()
            if (remainingAlerts.isEmpty) {
                val devices = db.collection("users").document(uid).collection("devices").get().await()
                devices.documents.chunked(400).forEach { page ->
                    db.batch().apply { page.forEach { delete(it.reference) } }.commit().await()
                }
            }
            return
        }
        follow.set(
            mapOf(
                "targetId" to storeId,
                "targetType" to "store",
                "notificationsEnabled" to notificationsEnabled,
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp(),
            ),
        ).await()
        if (notificationsEnabled) registerCurrentDevice(uid)
    }

    suspend fun registerCurrentDevice(uid: String) {
        require(auth.currentUser?.uid == uid)
        registerTokenIfOptedIn(uid, messaging.token.await())
    }

    suspend fun registerTokenIfOptedIn(uid: String, token: String) {
        require(auth.currentUser?.uid == uid)
        val optedIn = db.collection("users").document(uid).collection("follows")
            .whereEqualTo("notificationsEnabled", true)
            .limit(1)
            .get()
            .await()
            .isEmpty.not()
        if (!optedIn || token.isBlank()) return
        val tokenId = MessageDigest.getInstance("SHA-256")
            .digest(token.toByteArray())
            .joinToString("") { "%02x".format(it) }
        db.collection("users").document(uid).collection("devices").document(tokenId)
            .set(mapOf("token" to token, "updatedAt" to FieldValue.serverTimestamp()))
            .await()
    }
}
