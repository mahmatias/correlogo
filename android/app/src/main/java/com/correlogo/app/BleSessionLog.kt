package com.correlogo.app

import android.content.ContentValues
import android.content.Context
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Log de sessão BLE em arquivo, salvo em `Download/CorreLogo/` via MediaStore.
 * Acessível pelo app Arquivos do telefone sem necessidade de logcat.
 * minSdk 29 => inserção em MediaStore.Downloads não exige permissão.
 */
class BleSessionLog(private val context: Context) {

    companion object {
        private const val TAG = "CorreLogo-BleLog"
        private val FILE_FMT = SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US)
        private val LINE_FMT = SimpleDateFormat("HH:mm:ss.SSS", Locale.US)
    }

    private val buffer = StringBuilder()
    private var uri: android.net.Uri? = null
    private var lineCount = 0
    var mode: String = "A"
        private set
    var path: String? = null
        private set

    fun start(mode: String): String? {
        this.mode = mode
        synchronized(buffer) { buffer.setLength(0) }
        lineCount = 0
        val name = "ftms-modo$mode-${FILE_FMT.format(Date())}.log"
        return try {
            val values = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, name)
                put(MediaStore.MediaColumns.MIME_TYPE, "text/plain")
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/CorreLogo")
                }
            }
            val collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
            val u = context.contentResolver.insert(collection, values)
                ?: run { Log.w(TAG, "MediaStore insert falhou"); return null }
            uri = u
            path = "Download/CorreLogo/$name"
            append("=== CorreLogo FTMS session (modo $mode) ===")
            append("arquivo: $path")
            u.toString()
        } catch (e: Exception) {
            Log.e(TAG, "start falhou", e)
            null
        }
    }

    fun append(msg: String) {
        val u = uri ?: return
        synchronized(buffer) {
            buffer.append(LINE_FMT.format(Date())).append("  ").append(msg).append('\n')
            lineCount++
        }
        if (lineCount >= 25) flush()
    }

    fun flush() {
        val u = uri ?: return
        val chunk: String = synchronized(buffer) {
            if (buffer.isEmpty()) return
            val s = buffer.toString()
            buffer.setLength(0)
            s
        }
        if (chunk.isEmpty()) return
        try {
            context.contentResolver.openOutputStream(u, "wa")?.use { out -> out.write(chunk.toByteArray()) }
        } catch (e: Exception) {
            Log.e(TAG, "flush falhou", e)
        }
    }

    fun finish() {
        flush()
        uri = null
    }
}
