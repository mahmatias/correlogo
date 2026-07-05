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
        TrackingService.currentPlugin = this
    }

    @PluginMethod
    fun requestLocationPermission(call: PluginCall) {
        val ctx = context
        val fineGranted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarseGranted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

        if (fineGranted && coarseGranted) {
            call.resolve(JSObject().apply { put("location", "granted") })
            return
        }

        pendingCall = call
        pluginRequestPermissions(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION), 9001)
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

        val intent = Intent(ctx, TrackingService::class.java)
        ctx.startForegroundService(intent)
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
        val ret = JSObject().apply { put("steps", lastSteps) }
        call.resolve(ret)
    }

    override fun handleRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray) {
        super.handleRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != 9001) return
        val call = pendingCall ?: return
        pendingCall = null

        val allGranted = grantResults.all { it == PackageManager.PERMISSION_GRANTED }
        if (!allGranted) {
            call.reject("Permissão de localização não concedida")
            return
        }

        if (call.methodName == "requestLocationPermission") {
            call.resolve(JSObject().apply { put("location", "granted") })
        } else {
            val intent = Intent(context, TrackingService::class.java)
            context.startForegroundService(intent)
            call.resolve()
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
}