package com.correlogo.app

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.content.FileProvider
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
        private const val EXTRA_STICKER_ASSET = "interactive_asset_uri"
    }

    private fun resolveContentUri(path: String): File? {
        val cleanPath = path.removePrefix("file://")
        val file = File(cleanPath)
        return if (file.exists()) file else null
    }

    private fun contentUriFor(file: File) =
        FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", file)

    @PluginMethod
    fun shareToInstagram(call: PluginCall) {
        val sourceApplication = call.getString("sourceApplication").orEmpty()
        val backgroundPath = call.getString("backgroundPath")
        val stickerPath = call.getString("stickerPath")

        if (backgroundPath.isNullOrBlank() && stickerPath.isNullOrBlank()) {
            call.reject("backgroundPath or stickerPath is required")
            return
        }

        try {
            val intent = Intent(ACTION_INSTAGRAM_STORIES).apply {
                putExtra(EXTRA_SOURCE_APPLICATION, sourceApplication)
            }

            if (!backgroundPath.isNullOrBlank()) {
                val file = resolveContentUri(backgroundPath)
                    ?: return call.reject("background file not found: $backgroundPath")
                val uri = contentUriFor(file)
                intent.setDataAndType(uri, "image/png")
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            if (!stickerPath.isNullOrBlank()) {
                val file = resolveContentUri(stickerPath)
                    ?: return call.reject("sticker file not found: $stickerPath")
                val uri = contentUriFor(file)
                intent.putExtra(EXTRA_STICKER_ASSET, uri)
                if (backgroundPath.isNullOrBlank()) {
                    intent.type = "image/png"
                }
                activity.grantUriPermission(INSTAGRAM_PACKAGE, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
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
            val file = resolveContentUri(imagePath)
                ?: return call.reject("file not found: $imagePath")
            val uri = contentUriFor(file)
            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            val clip = ClipData.newUri(context.contentResolver, "Corre Logo", uri)
            clipboard.setPrimaryClip(clip)
            call.resolve()
        } catch (e: Exception) {
            call.reject("CLIPBOARD_FAILED", e.message)
        }
    }
}
