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

@CapacitorPlugin(
    name = "HrBle",
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
class HrBlePlugin : Plugin() {

    companion object {
        private const val TAG = "CorreLogo-HR-Plugin"
        private const val BLE_PERMISSION_REQUEST_CODE = 9202
    }

    private var hrService: HrBleService? = null
    private var pendingBlePermCall: PluginCall? = null

    override fun load() {
        super.load()
        Log.d(TAG, "HrBlePlugin loaded")
    }

    private fun ensureService(): HrBleService? {
        if (hrService != null) return hrService
        val ctx = context ?: return null
        hrService = HrBleService(ctx).also { service ->
            service.onSample = { bpm, ts ->
                notifyListeners("hrSample", JSObject().apply { put("bpm", bpm); put("timestamp", ts) })
            }
            service.onStateChange = { state ->
                val stateStr = when (state) {
                    is HrBleService.HrState.Disconnected -> "DISCONNECTED"
                    is HrBleService.HrState.Connecting -> "CONNECTING"
                    is HrBleService.HrState.Ready -> "CONNECTED"
                }
                notifyListeners("hrState", JSObject().apply { put("state", stateStr) })
            }
            service.onDisconnect = {
                notifyListeners("hrState", JSObject().apply { put("state", "DISCONNECTED") })
            }
            service.onError = { msg ->
                notifyListeners("hrError", JSObject().apply { put("message", msg) })
            }
        }
        return hrService
    }

    @PluginMethod
    fun initHr(call: PluginCall) {
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
            Log.e(TAG, "initHr error", e)
            call.reject("Init failed: ${e.message}")
        }
    }

    @PluginMethod
    fun startHrScan(call: PluginCall) {
        if (!checkBlePermissions()) {
            call.reject("Permissão Bluetooth não concedida")
            return
        }
        val service = ensureService() ?: run {
            call.reject("Service not initialized")
            return
        }
        try {
            service.startScan { name, address ->
                notifyListeners("hrScanResult", JSObject().apply { put("name", name); put("address", address) })
            }
            call.resolve()
        } catch (e: Exception) {
            Log.e(TAG, "startHrScan error", e)
            call.reject("Scan failed: ${e.message}")
        }
    }

    @PluginMethod
    fun connectHr(call: PluginCall) {
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
            Log.e(TAG, "connectHr error", e)
            call.reject("Connect failed: ${e.message}")
        }
    }

    @PluginMethod
    fun disconnectHr(call: PluginCall) {
        val service = hrService ?: run {
            call.resolve()
            return
        }
        service.disconnect()
        call.resolve()
    }

    @PluginMethod
    fun requestHrBlePermissions(call: PluginCall) {
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
            call.resolve(JSObject().apply { put("bluetooth", "granted") })
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
        call.resolve(JSObject().apply { put("bluetooth", if (checkBlePermissions()) "granted" else "denied") })
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
