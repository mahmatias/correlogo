package com.correlogo.app

import android.content.Intent
import androidx.core.content.FileProvider
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File

@CapacitorPlugin(name = "ApkInstaller")
class ApkInstallerPlugin : Plugin() {

    @PluginMethod
    fun installApk(call: PluginCall) {
        val filePath = call.getString("filePath") ?: run {
            call.reject("filePath is required")
            return
        }
        val cleanPath = filePath.removePrefix("file://")
        val file = File(cleanPath)
        if (!file.exists()) {
            call.reject("File not found: $filePath")
            return
        }
        try {
            val apkUri = FileProvider.getUriForFile(
                activity,
                "${activity.packageName}.fileprovider",
                file
            )
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(apkUri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to install APK: ${e.message}")
        }
    }
}
