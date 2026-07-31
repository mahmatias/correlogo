package com.correlogo.app

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.util.Log
import androidx.core.content.FileProvider
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File

@CapacitorPlugin(name = "ApkInstaller")
class ApkInstallerPlugin : Plugin() {

    companion object {
        private const val TAG = "CorreLogo-ApkInstaller"
    }

    @PluginMethod
    fun canRequestPackageInstalls(call: PluginCall) {
        val can = activity.packageManager.canRequestPackageInstalls()
        call.resolve(JSObject().put("canRequestPackageInstalls", can))
    }

    @PluginMethod
    fun openInstallSettings(call: PluginCall) {
        try {
            val intent = Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:${activity.packageName}")
            ).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            activity.startActivity(intent)
            call.resolve()
        } catch (e: Exception) {
            Log.e(TAG, "openInstallSettings failed", e)
            call.reject("OPEN_SETTINGS_FAILED", e.message)
        }
    }

    @PluginMethod
    fun installApk(call: PluginCall) {
        val filePath = call.getString("filePath") ?: run {
            call.reject("filePath is required")
            return
        }
        if (!activity.packageManager.canRequestPackageInstalls()) {
            call.reject("INSTALL_BLOCKED", "Instalação de apps desconhecidos desativada para o Corre Logo")
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
            activity.startActivity(intent)
            call.resolve()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to launch APK installer", e)
            call.reject("Failed to install APK: ${e.message}")
        }
    }
}
