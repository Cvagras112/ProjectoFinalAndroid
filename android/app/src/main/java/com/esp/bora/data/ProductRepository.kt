package com.esp.bora.data

import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.storage.FirebaseStorage
import com.google.firebase.storage.StorageMetadata
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeoutOrNull

class ProductRepository(
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance(),
    private val storage: FirebaseStorage = FirebaseStorage.getInstance(),
) {
    private companion object {
        const val PRODUCTS = "products"
        const val USERS = "users"
        const val UPLOAD_TIMEOUT_MS = 120_000L
    }

    fun observeMyProducts(uid: String): Flow<List<Product>> = observeProducts(
        db.collection(PRODUCTS).whereEqualTo("ownerUid", uid),
    )

    /** El catálogo público se filtra de nuevo en el cliente por disponibilidad y stock. */
    fun observePublicProducts(): Flow<List<Product>> = observeProducts(db.collection(PRODUCTS))

    private fun observeProducts(query: com.google.firebase.firestore.Query): Flow<List<Product>> =
        callbackFlow {
            val registration = query.addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                val products = snapshot?.documents
                    ?.mapNotNull { doc -> doc.toObject(Product::class.java)?.copy(id = doc.id) }
                    ?.sortedWith(
                        compareByDescending<Product> { it.createdAt?.seconds ?: Long.MAX_VALUE }
                            .thenByDescending { it.createdAt?.nanoseconds ?: 0 },
                    )
                    ?: emptyList()
                trySend(products)
            }
            awaitClose { registration.remove() }
        }

    suspend fun saveProduct(
        product: Product,
        mainImageBytes: ByteArray?,
        variantImageBytes: Map<String, ByteArray>,
    ): String {
        val user = auth.currentUser ?: error("Tu sesión expiró. Vuelve a ingresar.")
        val storeId = resolveStoreId(user.uid)
        val document = if (product.id.isBlank()) db.collection(PRODUCTS).document()
        else db.collection(PRODUCTS).document(product.id)

        val previous = if (product.id.isBlank()) null else document.get().await()
            .toObject(Product::class.java)?.copy(id = document.id)
        if (product.id.isNotBlank() && previous?.ownerUid != user.uid) {
            error("Solo puedes editar tus propios productos.")
        }
        val uploadedPaths = mutableListOf<String>()
        val photoRevision = System.currentTimeMillis()

        try {
            val imagePath = if (mainImageBytes != null) {
                "products/${user.uid}/${document.id}_$photoRevision.jpg".also { path ->
                    upload(path, mainImageBytes)
                    uploadedPaths += path
                }
            } else {
                previous?.imagePath.orEmpty()
            }
            val imageUrl = if (mainImageBytes != null) {
                storage.reference.child(imagePath).downloadUrl.await().toString()
            } else previous?.imageUrl.orEmpty()

            val variants = product.variants.map { variant ->
                val bytes = variantImageBytes[variant.id]
                if (bytes == null) variant
                else {
                    val path = "products/${user.uid}/${document.id}/variants/${variant.id}_$photoRevision.jpg"
                    upload(path, bytes)
                    uploadedPaths += path
                    variant.copy(
                        imagePath = path,
                        imageUrl = storage.reference.child(path).downloadUrl.await().toString(),
                    )
                }
            }
            val saved = product.copy(
                id = document.id,
                ownerUid = user.uid,
                storeId = storeId,
                imageUrl = imageUrl,
                imagePath = imagePath,
                variants = variants,
                createdAt = previous?.createdAt ?: product.createdAt ?: Timestamp.now(),
            )
            val data = saved.toFirestoreMap().toMutableMap().apply {
                put("createdAt", previous?.createdAt ?: FieldValue.serverTimestamp())
                put("updatedAt", FieldValue.serverTimestamp())
            }
            withTimeoutOrNull(UPLOAD_TIMEOUT_MS) { document.set(data).await() }
                ?: error("Tiempo de espera agotado. Revisa tu conexión e inténtalo de nuevo.")

            val retainedPaths = (listOf(saved.imagePath) + variants.map { it.imagePath }).toSet()
            val replacedPaths = (listOfNotNull(previous?.imagePath) + previous?.variants.orEmpty().map { it.imagePath })
                .filter { it.isNotBlank() && it !in retainedPaths }
            replacedPaths.distinct().forEach { path -> runCatching { storage.reference.child(path).delete().await() } }
            document.id
        } catch (error: Exception) {
            uploadedPaths.distinct().forEach { path -> runCatching { storage.reference.child(path).delete().await() } }
            throw error
        }
    }

    suspend fun deleteProduct(product: Product) {
        val uid = auth.currentUser?.uid ?: error("Tu sesión expiró. Vuelve a ingresar.")
        require(product.ownerUid == uid) { "Solo puedes eliminar tus propios productos." }
        db.collection(PRODUCTS).document(product.id).delete().await()
        (listOf(product.imagePath) + product.variants.map { it.imagePath })
            .filter(String::isNotBlank)
            .distinct()
            .forEach { path -> runCatching { storage.reference.child(path).delete().await() } }
    }

    private suspend fun upload(path: String, bytes: ByteArray) {
        val ref = storage.reference.child(path)
        ref.putBytes(
            bytes,
            StorageMetadata.Builder().setContentType("image/jpeg").build(),
        ).await()
    }

    private suspend fun resolveStoreId(uid: String): String =
        runCatching { db.collection(USERS).document(uid).get().await().getString("storeId") }
            .getOrNull()?.takeIf(String::isNotBlank) ?: uid
}

private fun Product.toFirestoreMap(): Map<String, Any> = mapOf(
    "storeId" to storeId,
    "ownerUid" to ownerUid,
    "name" to name,
    "description" to description,
    "price" to price,
    "imageUrl" to imageUrl,
    "imagePath" to imagePath,
    "category" to category,
    "productType" to productType,
    "modality" to modality,
    "managesStock" to managesStock,
    "stock" to stock,
    "exhaustedBehavior" to exhaustedBehavior,
    "available" to available,
    "sold" to sold,
    "variants" to variants.map { variant ->
        mapOf(
            "id" to variant.id,
            "name" to variant.name,
            "price" to variant.price,
            "stock" to variant.stock,
            "imageUrl" to variant.imageUrl,
            "imagePath" to variant.imagePath,
        )
    },
)
