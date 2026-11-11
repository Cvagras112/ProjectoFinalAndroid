package com.esp.bora.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import java.io.ByteArrayOutputStream

/**
 * Las fotos de la cámara pesan varios MB. Antes de subirlas se reducen a un
 * máximo de 1280 px por lado y se comprimen en JPEG, respetando la orientación
 * con la que se tomó la foto.
 */
object ImageUtils {
    private const val MAX_SIDE = 1280
    private const val JPEG_QUALITY = 82

    /** Operación pesada: llamar fuera del hilo principal. */
    fun compressToJpeg(context: Context, uri: Uri): ByteArray {
        val resolver = context.contentResolver

        // 1) Leer solo las dimensiones para elegir un factor de reducción al decodificar.
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
        require(bounds.outWidth > 0 && bounds.outHeight > 0) { "No se pudo leer la foto. Intenta tomarla de nuevo." }

        var sample = 1
        while (bounds.outWidth / (sample * 2) >= MAX_SIDE && bounds.outHeight / (sample * 2) >= MAX_SIDE) {
            sample *= 2
        }

        // 2) Decodificar la imagen ya reducida.
        val decoded = resolver.openInputStream(uri)?.use {
            BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample })
        } ?: error("No se pudo leer la foto. Intenta tomarla de nuevo.")

        // 3) Corregir la rotación según los datos EXIF.
        val rotation = resolver.openInputStream(uri)?.use { stream ->
            when (
                ExifInterface(stream).getAttributeInt(
                    ExifInterface.TAG_ORIENTATION,
                    ExifInterface.ORIENTATION_NORMAL,
                )
            ) {
                ExifInterface.ORIENTATION_ROTATE_90 -> 90f
                ExifInterface.ORIENTATION_ROTATE_180 -> 180f
                ExifInterface.ORIENTATION_ROTATE_270 -> 270f
                else -> 0f
            }
        } ?: 0f

        // 4) Ajustar el tamaño final y rotar.
        val scale = minOf(1f, MAX_SIDE.toFloat() / maxOf(decoded.width, decoded.height))
        val matrix = Matrix().apply {
            postRotate(rotation)
            postScale(scale, scale)
        }
        val result = Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, matrix, true)

        val bytes = ByteArrayOutputStream().use { out ->
            result.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, out)
            out.toByteArray()
        }
        if (result !== decoded) decoded.recycle()
        result.recycle()
        return bytes
    }
}
