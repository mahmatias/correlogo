package com.correlogo.app

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothProfile
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import java.util.UUID
import kotlinx.coroutines.*

class HrBleService(private val context: Context) {

    companion object {
        private const val TAG = "CorreLogo-HR"
        val HR_SERVICE_UUID: UUID = UUID.fromString("0000180d-0000-1000-8000-00805f9b34fb")
        val HR_MEASUREMENT_CHAR: UUID = UUID.fromString("00002a37-0000-1000-8000-00805f9b34fb")
        val CLIENT_CHARACTERISTIC_CONFIG_DESCRIPTOR: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
        private const val VALID_MIN_BPM = 30
        private const val VALID_MAX_BPM = 240
    }

    sealed class HrState {
        object Disconnected : HrState()
        object Connecting : HrState()
        object Ready : HrState()
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var gatt: BluetoothGatt? = null
    private var hrChar: BluetoothGattCharacteristic? = null
    private var _state: HrState = HrState.Disconnected
    val state: HrState get() = _state
    private val handler = Handler(Looper.getMainLooper())
    private var connectionTimeoutRunnable: Runnable? = null
    private var discoveryTimeoutRunnable: Runnable? = null

    var onSample: ((bpm: Int, timestamp: Long) -> Unit)? = null
    var onStateChange: ((HrState) -> Unit)? = null
    var onDisconnect: (() -> Unit)? = null
    var onError: ((String) -> Unit)? = null

    private val gattCallback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
            when (newState) {
                BluetoothProfile.STATE_CONNECTED -> {
                    connectionTimeoutRunnable?.let { handler.removeCallbacks(it) }
                    connectionTimeoutRunnable = null
                    _state = HrState.Connecting
                    onStateChange?.invoke(state)
                    handler.post { gatt.discoverServices() }
                    discoveryTimeoutRunnable = Runnable {
                        if (state is HrState.Connecting) {
                            Log.e(TAG, "Service discovery timeout (5s)")
                            onError?.invoke("Falha ao descobrir serviços após 5s")
                            cleanup()
                        }
                    }
                    handler.postDelayed(discoveryTimeoutRunnable!!, 5000)
                }
                BluetoothProfile.STATE_DISCONNECTED -> {
                    Log.d(TAG, "HR device disconnected")
                    cleanup()
                    onDisconnect?.invoke()
                }
            }
        }

        override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
            discoveryTimeoutRunnable?.let { handler.removeCallbacks(it) }
            discoveryTimeoutRunnable = null

            if (status != BluetoothGatt.GATT_SUCCESS) {
                Log.e(TAG, "Service discovery failed: $status")
                onError?.invoke("Service discovery failed")
                gatt.disconnect()
                return
            }
            val service = gatt.getService(HR_SERVICE_UUID) ?: run {
                Log.e(TAG, "Heart Rate service not found")
                onError?.invoke("Heart Rate service not found on device")
                gatt.disconnect()
                return
            }
            val char = service.getCharacteristic(HR_MEASUREMENT_CHAR) ?: run {
                Log.e(TAG, "Heart Rate Measurement characteristic not found")
                onError?.invoke("Heart Rate Measurement characteristic not found")
                gatt.disconnect()
                return
            }
            hrChar = char
            gatt.setCharacteristicNotification(char, true)
            val desc = char.getDescriptor(CLIENT_CHARACTERISTIC_CONFIG_DESCRIPTOR)
            desc?.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
            handler.postDelayed({ desc?.let { gatt.writeDescriptor(it) } }, 100)
        }

        override fun onDescriptorWrite(gatt: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) {
            if (status != BluetoothGatt.GATT_SUCCESS) {
                Log.w(TAG, "Descriptor write failed: $status")
                onError?.invoke("Notification enable failed")
                return
            }
            _state = HrState.Ready
            onStateChange?.invoke(state)
        }

        override fun onCharacteristicChanged(
            gatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
            value: ByteArray,
        ) {
            if (characteristic.uuid != HR_MEASUREMENT_CHAR) return
            val bpm = parseHeartRate(value) ?: return
            onSample?.invoke(bpm, System.currentTimeMillis())
        }
    }

    private fun parseHeartRate(value: ByteArray): Int? {
        if (value.isEmpty()) return null
        val flags = value[0].toInt() and 0xFF
        var offset = 1
        val is16Bit = (flags and 0x01) != 0
        val bpm = if (is16Bit) {
            if (value.size < offset + 2) return null
            (value[offset].toInt() and 0xFF) or ((value[offset + 1].toInt() and 0xFF) shl 8)
        } else {
            if (value.size < offset + 1) return null
            value[offset].toInt() and 0xFF
        }
        if (bpm < VALID_MIN_BPM || bpm > VALID_MAX_BPM) return null
        return bpm
    }

    fun startScan(onDeviceFound: (name: String, address: String) -> Unit) {
        scope.launch {
            try {
                val adapter = BluetoothAdapter.getDefaultAdapter()
                if (adapter == null || !adapter.isEnabled) {
                    onError?.invoke("Bluetooth not enabled")
                    return@launch
                }
                val leScanner = adapter.bluetoothLeScanner ?: run {
                    onError?.invoke("BLE not supported")
                    return@launch
                }
                val scanCallback = object : android.bluetooth.le.ScanCallback() {
                    override fun onScanResult(callbackType: Int, result: android.bluetooth.le.ScanResult?) {
                        val device = result?.device ?: return
                        val name = device.name ?: return
                        if (name.isNotEmpty()) {
                            onDeviceFound(name, device.address)
                        }
                    }
                    override fun onScanFailed(errorCode: Int) {
                        onError?.invoke("Scan failed: $errorCode")
                    }
                }
                val scanSettings = android.bluetooth.le.ScanSettings.Builder()
                    .setScanMode(android.bluetooth.le.ScanSettings.SCAN_MODE_LOW_LATENCY)
                    .build()
                val scanFilter = android.bluetooth.le.ScanFilter.Builder()
                    .setServiceUuid(android.os.ParcelUuid(HR_SERVICE_UUID))
                    .build()
                leScanner.startScan(listOf(scanFilter), scanSettings, scanCallback)
                delay(15000)
                leScanner.stopScan(scanCallback)
            } catch (e: Exception) {
                Log.e(TAG, "Scan error", e)
                onError?.invoke("Scan error: ${e.message}")
            }
        }
    }

    fun connect(address: String) {
        if (state !is HrState.Disconnected) {
            Log.w(TAG, "Already connecting/connected")
            return
        }
        _state = HrState.Connecting
        onStateChange?.invoke(state)

        val device = BluetoothAdapter.getDefaultAdapter()?.getRemoteDevice(address) ?: run {
            onError?.invoke("Device not found: $address")
            _state = HrState.Disconnected
            onStateChange?.invoke(state)
            return
        }

        connectionTimeoutRunnable = Runnable {
            if (state is HrState.Connecting) {
                Log.e(TAG, "Connection timeout (10s)")
                onError?.invoke("Conexão expirada após 10s")
                cleanup()
            }
        }
        handler.postDelayed(connectionTimeoutRunnable!!, 10000)

        gatt = device.connectGatt(context, false, gattCallback, BluetoothDevice.TRANSPORT_LE)
    }

    fun disconnect() {
        connectionTimeoutRunnable?.let { handler.removeCallbacks(it) }
        connectionTimeoutRunnable = null
        discoveryTimeoutRunnable?.let { handler.removeCallbacks(it) }
        discoveryTimeoutRunnable = null
        gatt?.disconnect()
        gatt?.close()
        gatt = null
        hrChar = null
        _state = HrState.Disconnected
        onStateChange?.invoke(state)
    }

    private fun cleanup() {
        connectionTimeoutRunnable?.let { handler.removeCallbacks(it) }
        connectionTimeoutRunnable = null
        discoveryTimeoutRunnable?.let { handler.removeCallbacks(it) }
        discoveryTimeoutRunnable = null
        gatt?.close()
        gatt = null
        hrChar = null
        _state = HrState.Disconnected
        onStateChange?.invoke(state)
    }
}
