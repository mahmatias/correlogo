package com.correlogo.app

import android.content.ClipData
import android.content.ClipboardManager
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.util.Log
import androidx.core.content.FileProvider
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File

@CapacitorPlugin(name = "SocialShare")
class SocialSharePlugin : Plugin() {

    companion object {
        private const val TAG = "CorreLogo-SocialShare"
        private const val ACTION_INSTAGRAM_STORIES = "com.instagram.share.ADD_TO_STORY"
        private const val INSTAGRAM_PACKAGE = "com.instagram.android"
        private const val EXTRA_SOURCE_APPLICATION = "source_application"
        private const val EXTRA_BACKGROUND_ASSET = "background_image_uri"
        private const val EXTRA_STICKER_ASSET = "interactive_asset_uri"
    }

    private fun fileForPath(path: String): File? {
        val cleanPath = path.trim().removePrefix("file://")
        val direct = File(cleanPath)
        if (direct.exists()) return direct
        val inCache = File(context.cacheDir, cleanPath.removePrefix("/"))
        return if (inCache.exists()) inCache else null
    }

    private fun sourceUriForPath(path: String): Uri? {
        val trimmed = path.trim()
        if (trimmed.startsWith("content://")) return Uri.parse(trimmed)
        val file = fileForPath(trimmed) ?: return null
        return FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", file)
    }

    @PluginMethod
    fun shareToInstagram(call: PluginCall) {
        val sourceApplication = call.getString("sourceApplication").orEmpty()
        val backgroundPath = call.getString("backgroundPath")
        val stickerPath = call.getString("stickerPath")

        if (backgroundPath.isNullOrBlank() && stickerPath.isNullOrBlank()) {
            call.reject("backgroundPath or stickerPath is required")
            return
        }

        val backgroundUri: Uri? = if (!backgroundPath.isNullOrBlank()) {
            sourceUriForPath(backgroundPath)
                ?: return call.reject("background file not found: $backgroundPath")
        } else {
            null
        }

        val stickerUri: Uri? = if (!stickerPath.isNullOrBlank()) {
            sourceUriForPath(stickerPath)
                ?: return call.reject("sticker file not found: $stickerPath")
        } else {
            null
        }

        val primaryUri = backgroundUri ?: stickerUri
            ?: return call.reject("backgroundPath or stickerPath is required")

        try {
            val intent = Intent(ACTION_INSTAGRAM_STORIES).apply {
                setPackage(INSTAGRAM_PACKAGE)
                putExtra(EXTRA_SOURCE_APPLICATION, sourceApplication)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                setDataAndType(primaryUri, "image/png")
            }

            backgroundUri?.let { intent.putExtra(EXTRA_BACKGROUND_ASSET, it) }

            stickerUri?.let {
                intent.putExtra(EXTRA_STICKER_ASSET, it)
                activity.grantUriPermission(INSTAGRAM_PACKAGE, it, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            activity.startActivity(intent)
            call.resolve()
        } catch (e: Exception) {
            Log.e(TAG, "Instagram Stories intent failed", e)
            call.reject("NO_RESOLVE", e.message)
        }
    }

    @PluginMethod
    fun copyImageToClipboard(call: PluginCall) {
        val imagePath = call.getString("imagePath")
        if (imagePath.isNullOrBlank()) {
            call.reject("imagePath is required")
            return
        }
        try {
            val uri = sourceUriForPath(imagePath)
                ?: return call.reject("file not found: $imagePath")
            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            val clip = ClipData.newUri(context.contentResolver, "Corre Logo", uri)
            clipboard.setPrimaryClip(clip)
            call.resolve()
        } catch (e: Exception) {
            Log.e(TAG, "copyImageToClipboard failed", e)
            call.reject("CLIPBOARD_FAILED", e.message)
        }
    }

    @PluginMethod
    fun saveToGallery(call: PluginCall) {
        val data = call.getString("data")
        val filename = call.getString("filename") ?: "corre-logo-card.png"
        val mimeType = call.getString("mimeType") ?: "image/png"
        if (data.isNullOrBlank()) {
            call.reject("data is required")
            return
        }
        val bytes = try {
            Base64.decode(data, Base64.DEFAULT)
        } catch (e: Exception) {
            call.reject("invalid base64 data")
            return
        }
        val displayName = "${System.currentTimeMillis()}_${filename.replace(" ", "_")}"
        val values = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, displayName)
            put(MediaStore.Images.Media.MIME_TYPE, mimeType)
            put(MediaStore.Images.Media.RELATIVE_PATH, "${Environment.DIRECTORY_PICTURES}/CorreLogo")
            put(MediaStore.Images.Media.IS_PENDING, 1)
        }
        try {
            val collection = MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
            val uri = activity.contentResolver.insert(collection, values)
                ?: return call.reject("gallery insert failed")
            activity.contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
                ?: return call.reject("gallery stream failed")
            values.clear()
            values.put(MediaStore.Images.Media.IS_PENDING, 0)
            activity.contentResolver.update(uri, values, null, null)
            MediaScannerConnection.scanFile(activity, arrayOf(uri.toString()), arrayOf(mimeType), null)
            call.resolve(JSObject().apply { put("uri", uri.toString()) })
        } catch (e: Exception) {
            Log.e(TAG, "saveToGallery failed", e)
            call.reject("GALLERY_FAILED", e.message)
        }
    }

    @PluginMethod
    fun shareToWhatsApp(call: PluginCall) {
        val imagePath = call.getString("imagePath")
        if (imagePath.isNullOrBlank()) {
            call.reject("imagePath is required")
            return
        }
        val uri = sourceUriForPath(imagePath)
            ?: return call.reject("file not found: $imagePath")
        try {
            val intent = Intent(Intent.ACTION_SEND).apply {
                setPackage("com.whatsapp")
                setType("image/png")
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            activity.startActivity(intent)
            call.resolve()
        } catch (e: Exception) {
            Log.e(TAG, "WhatsApp intent failed", e)
            call.reject("NO_RESOLVE", e.message)
        }
    }
}
