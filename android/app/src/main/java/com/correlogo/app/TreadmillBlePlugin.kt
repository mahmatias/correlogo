package com.correlogo.app

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import org.json.JSONArray

@CapacitorPlugin(
    name = "TreadmillBle",
    permissions = [
        Permission(
            strings = [
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_CONNECT,
            ],
            alias = "bluetooth",
        ),
    ],
)
class TreadmillBlePlugin : Plugin() {

    companion object {
        private const val TAG = "CorreLogo-BLE-Plugin"
    }

    private var bleService: TreadmillBleService? = null

    override fun load() {
        super.load()
        Log.d(TAG, "TreadmillBlePlugin loaded")
    }

    private fun ensureService(): TreadmillBleService? {
        if (bleService != null) return bleService
        val ctx = context ?: return null
        bleService = TreadmillBleService(ctx).also { service ->
            service.onMetrics = { data ->
                val arr = JSONArray()
                data.forEach { arr.put(it.toInt() and 0xFF) }
                notifyListeners("treadmillMetrics", JSObject().apply { put("data", arr.toString()) })
            }
            service.onControlPointResponse = { data ->
                val arr = JSONArray()
                data.forEach { arr.put(it.toInt() and 0xFF) }
                notifyListeners("treadmillControlPointResponse", JSObject().apply { put("data", arr.toString()) })
            }
            service.onStateChange = { state ->
                val stateStr = when (state) {
                    is TreadmillBleService.BleState.Disconnected -> "DISCONNECTED"
                    is TreadmillBleService.BleState.Connecting -> "CONNECTING"
                    is TreadmillBleService.BleState.Discovering -> "DISCOVERING"
                    is TreadmillBleService.BleState.Ready -> "READY"
                    is TreadmillBleService.BleState.Controlled -> "CONTROLLED"
                }
                notifyListeners("treadmillState", JSObject().apply { put("state", stateStr) })
            }
            service.onDisconnect = {
                notifyListeners("treadmillState", JSObject().apply { put("state", "DISCONNECTED") })
            }
            service.onError = { msg ->
                notifyListeners("treadmillError", JSObject().apply { put("message", msg) })
            }
        }
        return bleService
    }

    @PluginMethod
    fun initBle(call: PluginCall) {
        try {
            val adapter = BluetoothAdapter.getDefaultAdapter()
            if (adapter == null) {
                call.reject("Bluetooth not supported")
                return
            }
            if (!adapter.isEnabled) {
                val enableBtIntent = Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE)
                startActivityForResult(call, enableBtIntent, "handleBtEnableResult")
                return
            }
            ensureService()
            call.resolve()
        } catch (e: Exception) {
            Log.e(TAG, "initBle error", e)
            call.reject("Init failed: ${e.message}")
        }
    }

    @PluginMethod
    fun startBleScan(call: PluginCall) {
        if (!checkBlePermissions()) {
            call.reject("BLE permissions not granted")
            return
        }
        val service = ensureService() ?: run {
            call.reject("Service not initialized")
            return
        }
        try {
            service.startScan { name, address ->
                notifyListeners("treadmillScanResult", JSObject().apply {
                    put("name", name)
                    put("address", address)
                })
            }
            call.resolve()
        } catch (e: Exception) {
            Log.e(TAG, "startBleScan error", e)
            call.reject("Scan failed: ${e.message}")
        }
    }

    @PluginMethod
    fun connectTreadmill(call: PluginCall) {
        val address = call.getString("address") ?: run {
            call.reject("address required")
            return
        }
        val service = ensureService() ?: run {
            call.reject("Service not initialized")
            return
        }
        try {
            service.connect(address)
            call.resolve()
        } catch (e: Exception) {
            Log.e(TAG, "connectTreadmill error", e)
            call.reject("Connect failed: ${e.message}")
        }
    }

    @PluginMethod
    fun disconnectTreadmill(call: PluginCall) {
        val service = bleService ?: run {
            call.resolve()
            return
        }
        service.disconnect()
        call.resolve()
    }

    @PluginMethod
    fun setTreadmillSpeed(call: PluginCall) {
        val speed = call.getDouble("speed")
        if (speed == null) { call.reject("speed required"); return }
        val service = bleService ?: run { call.reject("Not connected"); return }
        val ftms = TreadmillFtmsManager()
        service.sendCommand(ftms.encodeSetSpeed(speed))
        call.resolve()
    }

    @PluginMethod
    fun setTreadmillIncline(call: PluginCall) {
        val incline = call.getDouble("incline")
        if (incline == null) { call.reject("incline required"); return }
        val service = bleService ?: run { call.reject("Not connected"); return }
        val ftms = TreadmillFtmsManager()
        service.sendCommand(ftms.encodeSetIncline(incline))
        call.resolve()
    }

    @ActivityCallback
    fun handleBtEnableResult(call: PluginCall, result: androidx.activity.result.ActivityResult) {
        if (result.resultCode == android.app.Activity.RESULT_OK) {
            ensureService()
            call.resolve()
        } else {
            call.reject("Bluetooth not enabled")
        }
    }

    private fun checkBlePermissions(): Boolean {
        val ctx = context ?: return false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val scan = ContextCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_SCAN)
            val connect = ContextCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_CONNECT)
            return scan == PackageManager.PERMISSION_GRANTED && connect == PackageManager.PERMISSION_GRANTED
        }
        return true
    }
}
