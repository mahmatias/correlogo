package com.correlogo.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission

import android.os.Build
import android.util.Log

@CapacitorPlugin(
    name = "Tracking",
    permissions = [
        Permission(
            strings = [Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION],
            alias = "location"
        )
    ]
)
class TrackingPlugin : Plugin() {

    private var lastSteps = 0
    private var pendingCall: PluginCall? = null

    override fun load() {
        super.load()
        Log.d("CorreLogo", "TrackingPlugin loaded and initialized")
        TrackingService.currentPlugin = this
    }

    @PluginMethod
    fun requestLocationPermission(call: PluginCall) {
        Log.d("CorreLogo", "TrackingPlugin.requestLocationPermission called");
        val ctx = context
        val fineGranted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarseGranted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

        if (fineGranted && coarseGranted) {
            Log.d("CorreLogo", "TrackingPlugin: location already granted");
            call.resolve(JSObject().apply { put("location", "granted") })
            return
        }

        Log.d("CorreLogo", "TrackingPlugin: requesting location permission via system dialog");
        pendingCall = call
        pluginRequestPermissions(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION), 9001)
    }

    @PluginMethod
    fun checkLocationPermissions(call: PluginCall) {
        val ctx = context
        val fineGranted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarseGranted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val background = if (fineGranted) {
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED
        } else false
        val ret = JSObject()
        ret.put("location", if (fineGranted && coarseGranted) "granted" else "denied")
        ret.put("background", if (background) "granted" else "denied")
        call.resolve(ret)
    }

    @PluginMethod
    fun requestBackgroundLocationPermission(call: PluginCall) {
        val ctx = context
        // Background location can only be requested if fine/coarse are already granted
        val fineGranted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        if (!fineGranted) {
            call.reject("Fine location must be granted first")
            return
        }

        if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            call.resolve(JSObject().apply { put("background", "granted") })
            return
        }

        pendingCall = call
        pluginRequestPermissions(arrayOf(Manifest.permission.ACCESS_BACKGROUND_LOCATION), 9002)
    }

    @PluginMethod
    fun startTracking(call: PluginCall) {
        val ctx = context
        val fineGranted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

        if (!fineGranted) {
            pendingCall = call
            pluginRequestPermissions(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION), 9001)
            return
        }

        try {
            val intent = Intent(ctx, TrackingService::class.java)
            ctx.startForegroundService(intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Falha ao iniciar serviço de tracking: ${e.message}")
        }
    }

    @PluginMethod
    fun startKeepAlive(call: PluginCall) {
        try {
            val intent = Intent(context, TrackingService::class.java)
            context.startForegroundService(intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Falha ao iniciar keep-alive: ${e.message}")
        }
    }

    @PluginMethod
    fun stopKeepAlive(call: PluginCall) {
        try {
            val intent = Intent(context, TrackingService::class.java).apply {
                putExtra("action", "stop_timer")
            }
            context.startService(intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Falha ao parar keep-alive: ${e.message}")
        }
    }

    @PluginMethod
    fun startTimer(call: PluginCall) {
        val elapsed = call.getLong("elapsedSeconds", 0L)
        try {
            val intent = Intent(context, TrackingService::class.java).apply {
                putExtra("action", "start_timer")
                putExtra("elapsedSeconds", elapsed)
            }
            context.startService(intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Falha ao iniciar timer: ${e.message}")
        }
    }

    @PluginMethod
    fun pauseTimer(call: PluginCall) {
        try {
            val intent = Intent(context, TrackingService::class.java).apply {
                putExtra("action", "pause_timer")
            }
            context.startService(intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Falha ao pausar timer: ${e.message}")
        }
    }

    @PluginMethod
    fun resumeTimer(call: PluginCall) {
        try {
            val intent = Intent(context, TrackingService::class.java).apply {
                putExtra("action", "resume_timer")
            }
            context.startService(intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Falha ao retomar timer: ${e.message}")
        }
    }

    @PluginMethod
    fun stopTimer(call: PluginCall) {
        try {
            val intent = Intent(context, TrackingService::class.java).apply {
                putExtra("action", "stop_timer")
            }
            context.startService(intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Falha ao parar timer: ${e.message}")
        }
    }

    @PluginMethod
    fun stopTracking(call: PluginCall) {
        val intent = Intent(context, TrackingService::class.java)
        context.stopService(intent)
        call.resolve()
    }

    @PluginMethod
    fun openAppSettings(call: PluginCall) {
        Log.d("CorreLogo", "TrackingPlugin.openAppSettings called");
        val uri = android.net.Uri.parse("package:" + context.packageName)
        try {
            // Android 11+ (API 30): tenta abrir direto na tela de permissões
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val intent = Intent("android.settings.APPLICATION_PERMISSION_SETTINGS")
                intent.data = uri
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(intent)
                Log.d("CorreLogo", "openAppSettings: permission settings OK")
                call.resolve()
                return
            }
        } catch (e: Exception) {
            Log.w("CorreLogo", "openAppSettings: permission settings failed, falling back: ${e.message}")
        }
        // Fallback: App Info (funciona em todos os Android)
        try {
            val intent = Intent("android.settings.APPLICATION_DETAILS_SETTINGS")
            intent.data = uri
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            Log.d("CorreLogo", "openAppSettings: details settings OK")
            call.resolve()
        } catch (e: Exception) {
            Log.e("CorreLogo", "openAppSettings: both intents failed: ${e.message}")
            call.reject("Falha ao abrir configurações: ${e.message}")
        }
    }

    @PluginMethod
    fun getStepCount(call: PluginCall) {
        val ret = JSObject().apply { put("steps", lastSteps) }
        call.resolve(ret)
    }

    override fun handleRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray) {
        super.handleRequestPermissionsResult(requestCode, permissions, grantResults)
        val call = pendingCall ?: return
        pendingCall = null

        if (requestCode == 9001) {
            val allGranted = grantResults.all { it == PackageManager.PERMISSION_GRANTED }
            if (!allGranted) {
                call.reject("Permissão de localização não concedida")
                return
            }
            if (call.methodName == "requestLocationPermission") {
                call.resolve(JSObject().apply { put("location", "granted") })
            } else {
                try {
                    val intent = Intent(context, TrackingService::class.java)
                    context.startForegroundService(intent)
                    call.resolve()
                } catch (e: Exception) {
                    call.reject("Falha ao iniciar serviço de tracking: ${e.message}")
                }
            }
        } else if (requestCode == 9002) {
            val granted = grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
            if (granted) {
                call.resolve(JSObject().apply { put("background", "granted") })
            } else {
                call.reject("Permissão de localização em background não concedida")
            }
        }
    }

    fun notifySteps(steps: Int) {
        lastSteps = steps
        val obj = JSObject().apply { put("steps", steps) }
        notifyListeners("stepUpdate", obj)
    }

    fun emitLocation(data: JSObject) {
        notifyListeners("locationUpdate", data)
    }

    fun emitTimerTick(elapsedSeconds: Int) {
        val obj = JSObject().apply { put("elapsed", elapsedSeconds) }
        notifyListeners("timerTick", obj)
    }
}
