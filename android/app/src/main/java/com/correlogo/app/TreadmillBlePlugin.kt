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
                Manifest.permission.ACCESS_FINE_LOCATION,
            ],
            alias = "bluetooth",
        ),
    ],
)
class TreadmillBlePlugin : Plugin() {

    companion object {
        private const val TAG = "CorreLogo-BLE-Plugin"
        private const val BLE_PERMISSION_REQUEST_CODE = 9201
    }

    private var bleService: TreadmillBleService? = null
    private var pendingBlePermCall: PluginCall? = null

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
            service.onLogFile = { path ->
                notifyListeners("treadmillLogFile", JSObject().apply { put("path", path) })
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
        Log.d(TAG, "startBleScan called, permissions check: ${checkBlePermissions()}, SDK: ${Build.VERSION.SDK_INT}")
        if (!checkBlePermissions()) {
            call.reject("Permissão Bluetooth não concedida")
            return
        }
        startScanInternal(call)
    }

    @PluginMethod
    fun requestBlePermissions(call: PluginCall) {
        Log.d(TAG, "requestBlePermissions called")
        val ctx = context ?: run { call.reject("No context"); return }

        val toRequest = mutableListOf<String>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val scan = ContextCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_SCAN)
            val connect = ContextCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_CONNECT)
            if (scan != PackageManager.PERMISSION_GRANTED) toRequest.add(Manifest.permission.BLUETOOTH_SCAN)
            if (connect != PackageManager.PERMISSION_GRANTED) toRequest.add(Manifest.permission.BLUETOOTH_CONNECT)
        } else {
            val location = ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION)
            if (location != PackageManager.PERMISSION_GRANTED) toRequest.add(Manifest.permission.ACCESS_FINE_LOCATION)
        }

        if (toRequest.isEmpty()) {
            val ret = JSObject().apply { put("bluetooth", "granted") }
            call.resolve(ret)
            return
        }

        pendingBlePermCall = call
        pluginRequestPermissions(toRequest.toTypedArray(), BLE_PERMISSION_REQUEST_CODE)
    }

    @Suppress("DEPRECATION")
    override fun handleRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray) {
        super.handleRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != BLE_PERMISSION_REQUEST_CODE) return
        val call = pendingBlePermCall ?: return
        pendingBlePermCall = null

        val ret = JSObject().apply {
            put("bluetooth", if (checkBlePermissions()) "granted" else "denied")
        }
        call.resolve(ret)
    }

    private fun startScanInternal(call: PluginCall) {
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
        val mode = call.getString("mode") ?: "A"
        val service = ensureService() ?: run {
            call.reject("Service not initialized")
            return
        }
        try {
            service.connect(address, mode)
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
        if (service.state !is TreadmillBleService.BleState.Controlled) {
            android.util.Log.w("CorreLogo-BLE", "setTreadmillSpeed ignored: state=${service.state}, awaiting Controlled")
            call.reject("Esteira não está em modo controlado. Aguarde a conexão estabilizar.")
            return
        }
        val ftms = TreadmillFtmsManager()
        android.util.Log.d("CorreLogo-BLE", "setTreadmillSpeed: ${speed} km/h")
        service.sendCommand(ftms.encodeSetSpeed(speed))
        call.resolve()
    }

    @PluginMethod
    fun setTreadmillIncline(call: PluginCall) {
        val incline = call.getDouble("incline")
        if (incline == null) { call.reject("incline required"); return }
        val service = bleService ?: run { call.reject("Not connected"); return }
        if (service.state !is TreadmillBleService.BleState.Controlled) {
            android.util.Log.w("CorreLogo-BLE", "setTreadmillIncline ignored: state=${service.state}, awaiting Controlled")
            call.reject("Esteira não está em modo controlado. Aguarde a conexão estabilizar.")
            return
        }
        val ftms = TreadmillFtmsManager()
        android.util.Log.d("CorreLogo-BLE", "setTreadmillIncline: ${incline}%")
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
        } else {
            val location = ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION)
            return location == PackageManager.PERMISSION_GRANTED
        }
    }
}
