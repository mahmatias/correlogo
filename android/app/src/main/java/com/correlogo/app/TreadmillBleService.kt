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
import java.util.concurrent.ConcurrentLinkedQueue
import kotlinx.coroutines.*

class TreadmillBleService(private val context: Context) {

    companion object {
        private const val TAG = "CorreLogo-BLE"
        val FTMS_SERVICE_UUID: UUID = UUID.fromString("00001826-0000-1000-8000-00805f9b34fb")
        val FTMS_MEASUREMENT_CHAR: UUID = UUID.fromString("00002a63-0000-1000-8000-00805f9b34fb")
        val FTMS_CONTROL_POINT_CHAR: UUID = UUID.fromString("00002ad9-0000-1000-8000-00805f9b34fb")
        val CLIENT_CHARACTERISTIC_CONFIG_DESCRIPTOR: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
        private const val KEEP_ALIVE_INTERVAL_MS = 3000L
    }

    sealed class BleState {
        object Disconnected : BleState()
        object Connecting : BleState()
        object Discovering : BleState()
        object Ready : BleState()
        object Controlled : BleState()
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var gatt: BluetoothGatt? = null
    private var ftmsMeasurementChar: BluetoothGattCharacteristic? = null
    private var ftmsControlPointChar: BluetoothGattCharacteristic? = null
    private var state: BleState = BleState.Disconnected
    private var keepAliveJob: Job? = null
    private var lastCommand: ByteArray? = null
    private val handler = Handler(Looper.getMainLooper())
    private val ftms = TreadmillFtmsManager()

    var onMetrics: ((ByteArray) -> Unit)? = null
    var onControlPointResponse: ((ByteArray) -> Unit)? = null
    var onStateChange: ((BleState) -> Unit)? = null
    var onDisconnect: (() -> Unit)? = null
    var onError: ((String) -> Unit)? = null

    private val requestQueue = ConcurrentLinkedQueue<ByteArray>()
    private var isWriting = false

    private val gattCallback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
            when (newState) {
                BluetoothProfile.STATE_CONNECTED -> {
                    Log.d(TAG, "Connected to GATT server")
                    state = BleState.Discovering
                    onStateChange?.invoke(state)
                    handler.post { gatt.discoverServices() }
                }
                BluetoothProfile.STATE_DISCONNECTED -> {
                    Log.d(TAG, "Disconnected from GATT server")
                    cleanup()
                    onDisconnect?.invoke()
                }
            }
        }

        override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
            if (status != BluetoothGatt.GATT_SUCCESS) {
                Log.e(TAG, "Service discovery failed: $status")
                onError?.invoke("Service discovery failed")
                gatt.disconnect()
                return
            }
            val service = gatt.getService(FTMS_SERVICE_UUID) ?: run {
                Log.e(TAG, "FTMS service not found")
                onError?.invoke("FTMS service not found on device")
                gatt.disconnect()
                return
            }

            ftmsMeasurementChar = service.getCharacteristic(FTMS_MEASUREMENT_CHAR)
            ftmsControlPointChar = service.getCharacteristic(FTMS_CONTROL_POINT_CHAR)

            if (ftmsMeasurementChar == null || ftmsControlPointChar == null) {
                Log.e(TAG, "Required FTMS characteristics not found")
                onError?.invoke("Required FTMS characteristics not found")
                gatt.disconnect()
                return
            }

            Log.d(TAG, "FTMS service and characteristics found")
            state = BleState.Ready
            onStateChange?.invoke(state)

            enableNotifications()
        }

        override fun onCharacteristicChanged(
            gatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
            value: ByteArray,
        ) {
            when (characteristic.uuid) {
                FTMS_MEASUREMENT_CHAR -> {
                    onMetrics?.invoke(value)
                }
                FTMS_CONTROL_POINT_CHAR -> {
                    onControlPointResponse?.invoke(value)
                }
            }
        }

        override fun onCharacteristicWrite(
            gatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
            status: Int,
        ) {
            isWriting = false
            if (status != BluetoothGatt.GATT_SUCCESS) {
                Log.w(TAG, "Characteristic write failed: $status")
                onError?.invoke("Write failed: $status")
            }
            processNextCommand()
        }

        override fun onDescriptorWrite(
            gatt: BluetoothGatt,
            descriptor: BluetoothGattDescriptor,
            status: Int,
        ) {
            if (status != BluetoothGatt.GATT_SUCCESS) {
                Log.w(TAG, "Descriptor write failed: $status")
                onError?.invoke("Notification enable failed")
            }
        }
    }

    private fun enableNotifications() {
        val measurementChar = ftmsMeasurementChar ?: return
        val controlPointChar = ftmsControlPointChar ?: return

        gatt?.setCharacteristicNotification(measurementChar, true)
        val descMeasurement = measurementChar.getDescriptor(CLIENT_CHARACTERISTIC_CONFIG_DESCRIPTOR)
        descMeasurement?.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
        gatt?.writeDescriptor(descMeasurement)

        gatt?.setCharacteristicNotification(controlPointChar, true)
        val descControl = controlPointChar.getDescriptor(CLIENT_CHARACTERISTIC_CONFIG_DESCRIPTOR)
        descControl?.value = BluetoothGattDescriptor.ENABLE_INDICATION_VALUE
        gatt?.writeDescriptor(descControl)

        sendCommand(ftms.encodeRequestControl())
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
                    .setServiceUuid(android.os.ParcelUuid(FTMS_SERVICE_UUID))
                    .build()

                leScanner.startScan(listOf(scanFilter), scanSettings, scanCallback)

                delay(10000)
                leScanner.stopScan(scanCallback)
            } catch (e: Exception) {
                Log.e(TAG, "Scan error", e)
                onError?.invoke("Scan error: ${e.message}")
            }
        }
    }

    fun connect(address: String) {
        if (state !is BleState.Disconnected) {
            Log.w(TAG, "Already connecting/connected")
            return
        }
        state = BleState.Connecting
        onStateChange?.invoke(state)

        val device = BluetoothAdapter.getDefaultAdapter()?.getRemoteDevice(address) ?: run {
            onError?.invoke("Device not found: $address")
            state = BleState.Disconnected
            onStateChange?.invoke(state)
            return
        }

        gatt = device.connectGatt(context, false, gattCallback, BluetoothDevice.TRANSPORT_LE)
    }

    fun disconnect() {
        keepAliveJob?.cancel()
        keepAliveJob = null
        gatt?.disconnect()
        gatt?.close()
        gatt = null
        state = BleState.Disconnected
        onStateChange?.invoke(state)
    }

    fun sendCommand(data: ByteArray) {
        requestQueue.add(data)
        if (!isWriting) {
            processNextCommand()
        }
    }

    private fun processNextCommand() {
        val data = requestQueue.poll() ?: return
        val char = ftmsControlPointChar ?: return
        val g = gatt ?: return

        isWriting = true
        gatt?.let {
            char.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
            it.writeCharacteristic(char)
        }
    }

    fun startKeepAlive() {
        keepAliveJob?.cancel()
        keepAliveJob = scope.launch {
            while (isActive) {
                delay(KEEP_ALIVE_INTERVAL_MS)
                val cmd = lastCommand ?: continue
                if (state is BleState.Controlled) {
                    sendCommand(cmd)
                }
            }
        }
    }

    private fun cleanup() {
        keepAliveJob?.cancel()
        keepAliveJob = null
        gatt?.close()
        gatt = null
        ftmsMeasurementChar = null
        ftmsControlPointChar = null
        requestQueue.clear()
        isWriting = false
        state = BleState.Disconnected
        onStateChange?.invoke(state)
    }
}
