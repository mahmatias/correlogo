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

@CapacitorPlugin(
    name = "Tracking",
    permissions = [
        Permission(
            strings = [
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION,
                Manifest.permission.ACCESS_BACKGROUND_LOCATION,
                Manifest.permission.ACTIVITY_RECOGNITION
            ],
            alias = "location"
        )
    ]
)
class TrackingPlugin : Plugin() {

    private var lastSteps = 0

    override fun load() {
        super.load()
        TrackingService.currentPlugin = this
    }

    @PluginMethod
    fun startTracking(call: PluginCall) {
        val hasFineLocation = ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasFineLocation) {
            call.reject("Permissão de localização não concedida")
            return
        }

        val intent = Intent(context, TrackingService::class.java)
        context.startForegroundService(intent)
        call.resolve()
    }

    @PluginMethod
    fun stopTracking(call: PluginCall) {
        val intent = Intent(context, TrackingService::class.java)
        context.stopService(intent)
        call.resolve()
    }

    @PluginMethod
    fun getStepCount(call: PluginCall) {
        val ret = JSObject().apply {
            put("steps", lastSteps)
        }
        call.resolve(ret)
    }

    fun notifySteps(steps: Int) {
        lastSteps = steps
        val obj = JSObject().apply {
            put("steps", steps)
        }
        notifyListeners("stepUpdate", obj)
    }
}
