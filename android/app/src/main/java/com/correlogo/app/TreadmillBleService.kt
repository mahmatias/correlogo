package com.correlogo.app

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothProfile
import android.bluetooth.BluetoothStatusCodes
import android.content.Context
import android.os.Build
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
        val FTMS_MEASUREMENT_CHAR: UUID = UUID.fromString("00002acd-0000-1000-8000-00805f9b34fb")
        val FTMS_STATUS_CHAR: UUID = UUID.fromString("00002ada-0000-1000-8000-00805f9b34fb")
        val FTMS_CONTROL_POINT_CHAR: UUID = UUID.fromString("00002ad9-0000-1000-8000-00805f9b34fb")
        val CLIENT_CHARACTERISTIC_CONFIG_DESCRIPTOR: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
        val VENDOR_PREAMBLE_UUID: UUID = UUID.fromString("d18d2c10-c44c-11e8-a355-529269fb1459")
        val VENDOR_PREAMBLE_PAYLOAD = byteArrayOf(0x01, 0x00, 0x0d, 0x00, 0x06, 0x0b, 0x0f, 0x0d)
        private const val KEEP_ALIVE_CHECK_INTERVAL_MS = 5000L
        private const val KEEP_ALIVE_RENEW_AFTER_IDLE_MS = 25000L
        private const val MAX_GATT_WRITE_ATTEMPTS = 10

        // Result codes conforme a spec Bluetooth SIG (Fitness Machine Service).
        // Firmwares legadas respondem 0x00 como sucesso — aceitamos 0x00 e 0x01.
        fun ftmsResultCodeToString(code: Int): String = when (code) {
            0x01 -> "Success"
            0x02 -> "Op Code Not Supported"
            0x03 -> "Invalid Parameter"
            0x04 -> "Operation Failed"
            0x05 -> "Control Not Permitted"
            0x00 -> "Success (legacy 0x00)"
            else -> "Unknown (0x${code.toString(16)})"
        }
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
    private var _state: BleState = BleState.Disconnected
    val state: BleState get() = _state
    private var keepAliveJob: Job? = null
    private var lastCommand: ByteArray? = null
    private var lastWriteKeepAlive = false
    private var keepAliveFailures = 0
    private var lastSuccessfulWriteMs = 0L
    private val handler = Handler(Looper.getMainLooper())
    private var connectionTimeoutRunnable: Runnable? = null
    private var discoveryTimeoutRunnable: Runnable? = null
    private var requestControlAttempts = 0
    private var requestControlRetryRunnable: Runnable? = null
    private var controlPointNotificationsEnabled = false
    private val ftms = TreadmillFtmsManager()

    private var sessionLog: BleSessionLog? = null
    var controlStrategy: String = "A"
        private set
    val logFilePath: String?
        get() = sessionLog?.path
    private var ftmsStatusChar: BluetoothGattCharacteristic? = null
    private var preambleChar: BluetoothGattCharacteristic? = null
    private var autoStarted = false
    private var metricsReceived = false
    private var pendingSetCommand: ByteArray? = null
    private var pendingSetRunnable: Runnable? = null
    private val readQueue = ArrayDeque<BluetoothGattCharacteristic>()
    private var isReading = false

    var onMetrics: ((ByteArray) -> Unit)? = null
    var onControlPointResponse: ((ByteArray) -> Unit)? = null
    var onStateChange: ((BleState) -> Unit)? = null
    var onDisconnect: (() -> Unit)? = null
    var onError: ((String) -> Unit)? = null
    var onLogFile: ((String) -> Unit)? = null

    private class QueuedCommand(val data: ByteArray, val isKeepAlive: Boolean, val attempts: Int = 0)
    private val requestQueue = ConcurrentLinkedQueue<QueuedCommand>()
    private var pendingRetry: QueuedCommand? = null
    private var isWriting = false

    private val gattCallback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
            when (newState) {
                BluetoothProfile.STATE_CONNECTED -> {
                    Log.d(TAG, "Connected to GATT server")
                    connectionTimeoutRunnable?.let { handler.removeCallbacks(it) }
                    connectionTimeoutRunnable = null

                    _state = BleState.Discovering
                    onStateChange?.invoke(state)
                    handler.post { gatt.discoverServices() }

                    discoveryTimeoutRunnable = Runnable {
                        if (state is BleState.Discovering) {
                            Log.e(TAG, "Service discovery timeout (5s)")
                            onError?.invoke("Falha ao descobrir serviços após 5s")
                            cleanup()
                        }
                    }
                    handler.postDelayed(discoveryTimeoutRunnable!!, 5000)
                }
                BluetoothProfile.STATE_DISCONNECTED -> {
                    Log.d(TAG, "Disconnected from GATT server")
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

            ftmsStatusChar = service.getCharacteristic(FTMS_STATUS_CHAR)

            if (controlStrategy == "C") {
                val sb = StringBuilder("modo C — dump do serviço FTMS:")
                service.characteristics.forEach { c ->
                    sb.append("\n  ${c.uuid} props=0x${c.properties.toString(16)}")
                }
                sLog(sb.toString())
                preambleChar = service.getCharacteristic(VENDOR_PREAMBLE_UUID)?.also {
                    sLog("modo C — característica vendor preamble encontrada: ${it.uuid}")
                }
            }

            val cp = ftmsControlPointChar
            val meas = ftmsMeasurementChar
            val cpProps = cp?.properties ?: 0
            val measProps = meas?.properties ?: 0
            sLog(
                "FTMS chars — CP props=0x${cpProps.toString(16)} " +
                    "(WRITE=${cpProps and BluetoothGattCharacteristic.PROPERTY_WRITE != 0}, " +
                    "WRITE_NO_RESPONSE=${cpProps and BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE != 0}, " +
                    "INDICATE=${cpProps and BluetoothGattCharacteristic.PROPERTY_INDICATE != 0}); " +
                    "Measurement props=0x${measProps.toString(16)}"
            )
            _state = BleState.Ready
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
                    metricsReceived = true
                    flushPendingSet()
                    if (controlStrategy == "B" && state is BleState.Ready) {
                        requestControlRetryRunnable?.let { handler.removeCallbacks(it) }
                        requestControlRetryRunnable = null
                        sLog("modo B — dados de esteira chegando: concedendo controle otimista")
                        enterControlled()
                    }
                    onMetrics?.invoke(value)
                }
                FTMS_STATUS_CHAR -> {
                    val hex = value.joinToString(" ") { "%02x".format(it) }
                    val opcode = if (value.isNotEmpty()) (value[0].toInt() and 0xFF) else -1
                    val label = when (opcode) {
                        0x01 -> "Stopped/Paused by User"
                        0x02 -> "Stopped by Safety Key"
                        0x04 -> "Started/Resumed by User"
                        0x05 -> "Target Speed Changed"
                        0x06 -> "Target Incline Changed"
                        0x07 -> "Target Resistance Level Changed"
                        0x08 -> "Target Power Changed"
                        0x09 -> "Target Heart Rate Changed"
                        0x0A -> "Targeted Expended Energy Changed"
                        0x0B -> "Targeted Number of Steps Changed"
                        0x0C -> "Targeted Number of Strides Changed"
                        0x0D -> "Targeted Distance Changed"
                        0x0E -> "Targeted Training Time Changed"
                        0x15 -> "Targeted Cadence Changed"
                        0xFF -> "Control Permission Lost"
                        else -> "?"
                    }
                    sLog("Fitness Machine Status: 0x${opcode.toString(16)} ($label) bytes=[$hex]")
                }
                FTMS_CONTROL_POINT_CHAR -> {
                    if (value.isNotEmpty() && value[0] == 0x80.toByte() && value.size > 1) {
                        val requestedOpcode = value[1].toInt() and 0xFF
                        val resultCode = if (value.size > 2) (value[2].toInt() and 0xFF) else -1
                        sLog("Control Point response: opcode=0x${requestedOpcode.toString(16)} resultCode=0x${resultCode.toString(16)} (${ftmsResultCodeToString(resultCode)}) modo=$controlStrategy")
                        when {
                            controlStrategy == "B" -> {
                                sLog("modo B — resposta do CP é apenas informativa (otimista)")
                            }
                            isControlSuccess(resultCode) -> {
                                requestControlRetryRunnable?.let { handler.removeCallbacks(it) }
                                requestControlRetryRunnable = null
                                if (state !is BleState.Controlled) enterControlled()
                            }
                            requestedOpcode == 0x00 && resultCode == 0x04 -> {
                                // WiLinktech/KingSmith: rejeita Request Control com Operation Failed
                                // de propósito e ainda assim obedece comandos seguintes.
                                sLog("Request Control com Operation Failed (0x04) — comportamento conhecido da família WiLinktech, seguindo com controle")
                                requestControlRetryRunnable?.let { handler.removeCallbacks(it) }
                                requestControlRetryRunnable = null
                                if (state !is BleState.Controlled) enterControlled()
                            }
                            else -> {
                                sLog("Control Point command não aprovado: resultCode=0x${resultCode.toString(16)} (${ftmsResultCodeToString(resultCode)})")
                                if ((requestedOpcode == 0x02 || requestedOpcode == 0x03) && resultCode == 0x05) {
                                    sLog("hint: esteira não está em estado Started — Start/Resume (0x07) já foi enviado antes deste Set; se continuar 0x05, a esteira provavelmente exige partida manual no console (ou safety key não encaixado)")
                                }
                            }
                        }
                    } else {
                        sLog("Control Point indication (não-resposta): ${value.joinToString(" ") { "%02x".format(it) }}")
                    }
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
            val wasKeepAlive = lastWriteKeepAlive
            val hex = lastCommand?.joinToString(" ") { "%02x".format(it) }
            Log.d(
                TAG,
                "Write result${if (wasKeepAlive) " [keep-alive]" else ""}: status=$status (0x${status.toString(16)}) " +
                    "cmd=[$hex] thread=${Thread.currentThread().name}"
            )
            if (status != BluetoothGatt.GATT_SUCCESS) {
                Log.w(TAG, "Characteristic write failed: $status")
                if (wasKeepAlive) {
                    keepAliveFailures++
                    if (keepAliveFailures >= 2) {
                        Log.w(TAG, "Keep-alive renewal failing ($keepAliveFailures consecutive) — stopping keep-alive to avoid poisoning the GATT link")
                        stopKeepAlive()
                    }
                } else {
                    keepAliveFailures = 0
                    onError?.invoke("Write failed: $status")
                }
            } else {
                keepAliveFailures = 0
                lastSuccessfulWriteMs = System.currentTimeMillis()
                if (controlStrategy == "B" && !wasKeepAlive && state is BleState.Ready &&
                    lastCommand?.size == 1 && (lastCommand!![0].toInt() and 0xFF) == 0x00
                ) {
                    sLog("modo B — write-ack do Request Control: concedendo controle otimista")
                    enterControlled()
                }
            }
            handler.post { processNextCommand() }
        }

        override fun onCharacteristicRead(
            gatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
            value: ByteArray,
            status: Int,
        ) {
            isReading = false
            sLog("Read ${characteristic.uuid} (status=$status): [${value.joinToString(" ") { "%02x".format(it) }}]")
            handler.post { processNextRead() }
        }

        override fun onDescriptorWrite(
            gatt: BluetoothGatt,
            descriptor: BluetoothGattDescriptor,
            status: Int,
        ) {
            val isControlCccd = descriptor.characteristic.uuid == FTMS_CONTROL_POINT_CHAR
            if (status != BluetoothGatt.GATT_SUCCESS) {
                Log.w(TAG, "Descriptor write failed (${descriptor.characteristic.uuid}): $status")
                if (isControlCccd) {
                    pendingDescriptorWrite = null
                    onError?.invoke("Notification enable failed")
                }
                return
            }
            if (isControlCccd) {
                controlPointNotificationsEnabled = true
                val p = preambleChar
                if (p != null) {
                    sLog("modo C — escrevendo vendor preamble ${VENDOR_PREAMBLE_PAYLOAD.joinToString(" ") { "%02x".format(it) }} antes do Request Control")
                    val result = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        gatt.writeCharacteristic(p, VENDOR_PREAMBLE_PAYLOAD, BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT)
                    } else {
                        @Suppress("DEPRECATION")
                        p.value = VENDOR_PREAMBLE_PAYLOAD
                        if (gatt.writeCharacteristic(p)) BluetoothStatusCodes.SUCCESS else BluetoothStatusCodes.ERROR_UNKNOWN
                    }
                    sLog("vendor preamble write result: $result")
                }
                requestControlWithRetry()
                return
            }
            val next = pendingDescriptorWrite
            if (next != null) {
                pendingDescriptorWrite = null
                next.run()
            }
        }
    }

    private var pendingDescriptorWrite: Runnable? = null

    private fun enableNotifications() {
        val measurementChar = ftmsMeasurementChar ?: return
        val controlPointChar = ftmsControlPointChar ?: return

        gatt?.setCharacteristicNotification(measurementChar, true)
        val descMeasurement = measurementChar.getDescriptor(CLIENT_CHARACTERISTIC_CONFIG_DESCRIPTOR)
        descMeasurement?.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE

        val statusChar = ftmsStatusChar
        if (statusChar != null) {
            sLog("Inscrevendo no Fitness Machine Status (2ADA)")
            gatt?.setCharacteristicNotification(statusChar, true)
            val descStatus = statusChar.getDescriptor(CLIENT_CHARACTERISTIC_CONFIG_DESCRIPTOR)
            descStatus?.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
        }

        pendingDescriptorWrite = Runnable {
            gatt?.setCharacteristicNotification(controlPointChar, true)
            val descControl = controlPointChar.getDescriptor(CLIENT_CHARACTERISTIC_CONFIG_DESCRIPTOR)
            val cpUsesIndicate = controlPointChar.properties and BluetoothGattCharacteristic.PROPERTY_INDICATE != 0
            sLog("Control Point CCCD: ${if (cpUsesIndicate) "INDICATION (0x0002)" else "NOTIFICATION (0x0001)"} (props=0x${controlPointChar.properties.toString(16)})")
            descControl?.value = if (cpUsesIndicate) {
                BluetoothGattDescriptor.ENABLE_INDICATION_VALUE
            } else {
                BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
            }
            gatt?.writeDescriptor(descControl)
        }

        handler.postDelayed({
            gatt?.writeDescriptor(descMeasurement)
        }, 100)
        handler.postDelayed({
            if (statusChar != null) {
                statusChar.getDescriptor(CLIENT_CHARACTERISTIC_CONFIG_DESCRIPTOR)?.let { gatt?.writeDescriptor(it) }
            }
        }, 250)
        handler.postDelayed({
            pendingDescriptorWrite?.run()
        }, 450)
    }

    private fun requestControlWithRetry(maxAttempts: Int = 3) {
        requestControlAttempts = 0

        fun attempt() {
            if (requestControlAttempts >= maxAttempts) {
                sLog("Request Control falhou após $maxAttempts tentativas (modo $controlStrategy)")
                requestControlRetryRunnable = null
                if (controlStrategy == "B") {
                    sLog("modo B — concedendo controle otimista mesmo sem resposta")
                    enterControlled()
                } else {
                    onError?.invoke("Falha ao assumir controle da esteira (modo $controlStrategy). Log: ${logFilePath ?: "indisponível"}")
                    cleanup()
                }
                return
            }

            requestControlAttempts++
            sLog("Request Control tentativa $requestControlAttempts/$maxAttempts (modo $controlStrategy)")
            sendCommand(ftms.encodeRequestControl())

            requestControlRetryRunnable = Runnable {
                if (state !is BleState.Controlled) {
                    attempt()
                }
            }
            handler.postDelayed(requestControlRetryRunnable!!, 500)
        }

        attempt()
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

                delay(15000)
                leScanner.stopScan(scanCallback)
            } catch (e: Exception) {
                Log.e(TAG, "Scan error", e)
                onError?.invoke("Scan error: ${e.message}")
            }
        }
    }

    fun connect(address: String, mode: String = "A") {
        if (state !is BleState.Disconnected) {
            Log.w(TAG, "Already connecting/connected")
            return
        }
        controlStrategy = if (mode in listOf("A", "B", "C")) mode else "A"
        val log = BleSessionLog(context)
        sessionLog = log
        val path = log.start(controlStrategy)
        if (path != null) onLogFile?.invoke(path)
        sLog("connect($address) modo=$controlStrategy")
        _state = BleState.Connecting
        onStateChange?.invoke(state)

        val device = BluetoothAdapter.getDefaultAdapter()?.getRemoteDevice(address) ?: run {
            onError?.invoke("Device not found: $address")
            _state = BleState.Disconnected
            onStateChange?.invoke(state)
            return
        }

        connectionTimeoutRunnable = Runnable {
            if (state is BleState.Connecting) {
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
        requestControlRetryRunnable?.let { handler.removeCallbacks(it) }
        requestControlRetryRunnable = null
        stopKeepAlive()
        keepAliveFailures = 0
        sessionLog?.flush()
        gatt?.disconnect()
        gatt?.close()
        gatt = null
        _state = BleState.Disconnected
        onStateChange?.invoke(state)
    }

    fun sendCommand(data: ByteArray, isKeepAlive: Boolean = false) {
        val isSet = !isKeepAlive && data.isNotEmpty() &&
            (data[0] == 0x02.toByte() || data[0] == 0x03.toByte())
        if (isSet) {
            if (!autoStarted) {
                autoStarted = true
                sLog("auto-Start (0x07 Start/Resume) antes do primeiro Set (modo $controlStrategy)")
                requestQueue.add(QueuedCommand(ftms.encodeStart(), false))
                handler.post { processNextCommand() }
            }
        }
        if (controlStrategy == "B" && isSet && !metricsReceived && pendingSetCommand == null) {
            pendingSetCommand = data
            pendingSetRunnable = Runnable {
                pendingSetRunnable = null
                val cmd = pendingSetCommand
                pendingSetCommand = null
                if (cmd != null) {
                    sLog("modo B — timeout de métricas (2s): enviando Set pendente [${cmd.joinToString(" ") { "%02x".format(it) }}]")
                    requestQueue.add(QueuedCommand(cmd, false))
                    handler.post { processNextCommand() }
                }
            }
            handler.postDelayed(pendingSetRunnable!!, 2000)
            return
        }
        requestQueue.add(QueuedCommand(data, isKeepAlive))
        handler.post { processNextCommand() }
    }

    private fun processNextCommand() {
        if (isWriting) return
        val cmd = pendingRetry ?: requestQueue.poll() ?: return
        pendingRetry = null
        val char = ftmsControlPointChar ?: run {
            Log.w(TAG, "processNextCommand: control point char not ready — dropping [${cmd.data.joinToString(" ") { "%02x".format(it) }}]")
            return
        }
        val g = gatt ?: run {
            Log.w(TAG, "processNextCommand: gatt is null — dropping [${cmd.data.joinToString(" ") { "%02x".format(it) }}]")
            return
        }

        val writeType = if (char.properties and BluetoothGattCharacteristic.PROPERTY_WRITE != 0) {
            BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
        } else {
            BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
        }

        isWriting = true
        lastCommand = cmd.data
        lastWriteKeepAlive = cmd.isKeepAlive

        Log.d(
            TAG,
            "Writing${if (cmd.isKeepAlive) " [keep-alive]" else ""}: ${cmd.data.joinToString(" ") { "%02x".format(it) }} " +
                "writeType=$writeType thread=${Thread.currentThread().name}"
        )

        val result = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            g.writeCharacteristic(char, cmd.data, writeType)
        } else {
            @Suppress("DEPRECATION")
            char.value = cmd.data
            if (g.writeCharacteristic(char)) BluetoothStatusCodes.SUCCESS else BluetoothStatusCodes.ERROR_UNKNOWN
        }

        if (result != BluetoothStatusCodes.SUCCESS) {
            isWriting = false
            if (cmd.attempts < MAX_GATT_WRITE_ATTEMPTS) {
                Log.w(
                    TAG,
                    "writeCharacteristic() returned $result (0x${result.toString(16)}) — retrying (attempt ${cmd.attempts + 1}/$MAX_GATT_WRITE_ATTEMPTS) in 200ms"
                )
                pendingRetry = QueuedCommand(cmd.data, cmd.isKeepAlive, cmd.attempts + 1)
                handler.postDelayed({ processNextCommand() }, 200)
            } else {
                Log.e(
                    TAG,
                    "writeCharacteristic() gave up after $MAX_GATT_WRITE_ATTEMPTS attempts — dropping ${if (cmd.isKeepAlive) "[keep-alive] " else ""}[${cmd.data.joinToString(" ") { "%02x".format(it) }}]"
                )
                if (!cmd.isKeepAlive) onError?.invoke("Falha ao enviar comando à esteira (fila GATT ocupada)")
            }
        }
    }

    fun startKeepAlive() {
        stopKeepAlive()
        keepAliveJob = scope.launch {
            while (isActive) {
                try {
                    delay(KEEP_ALIVE_CHECK_INTERVAL_MS)
                    if (state is BleState.Controlled && keepAliveFailures < 2) {
                        val idleMs = System.currentTimeMillis() - lastSuccessfulWriteMs
                        if (idleMs >= KEEP_ALIVE_RENEW_AFTER_IDLE_MS) {
                            Log.d(TAG, "Keep-alive: renewing Request Control after ${idleMs / 1000}s idle")
                            sendCommand(ftms.encodeRequestControl(), isKeepAlive = true)
                        }
                    }
                } catch (e: CancellationException) {
                    Log.d(TAG, "Keep-alive cancelled")
                    throw e
                } catch (e: Exception) {
                    Log.e(TAG, "Keep-alive error: ${e.message}")
                }
            }
        }
    }

    private fun stopKeepAlive() {
        keepAliveJob?.cancel()
        keepAliveJob = null
    }

    private fun sLog(msg: String) {
        Log.d(TAG, msg)
        sessionLog?.append(msg)
    }

    private fun isControlSuccess(resultCode: Int): Boolean =
        resultCode == 0x01 || resultCode == 0x00

    private fun enterControlled() {
        if (state is BleState.Controlled) return
        _state = BleState.Controlled
        onStateChange?.invoke(state)
        startKeepAlive()
        if (controlStrategy == "C") queueModeCReads()
    }

    private fun flushPendingSet() {
        pendingSetRunnable?.let { handler.removeCallbacks(it) }
        pendingSetRunnable = null
        val cmd = pendingSetCommand
        pendingSetCommand = null
        if (cmd != null) {
            sLog("modo B — métricas chegando: enviando Set pendente [${cmd.joinToString(" ") { "%02x".format(it) }}]")
            requestQueue.add(QueuedCommand(cmd, false))
            handler.post { processNextCommand() }
        }
    }

    private fun queueModeCReads() {
        val g = gatt ?: return
        val service = g.getService(FTMS_SERVICE_UUID) ?: return
        readQueue.clear()
        listOf(0x2acc to "Feature", 0x2ad4 to "Supported Speed Range", 0x2ad5 to "Supported Inclination Range").forEach { (id, label) ->
            val c = service.getCharacteristic(
                UUID.fromString(String.format("0000%04x-0000-1000-8000-00805f9b34fb", id)),
            )
            if (c != null) readQueue.addLast(c)
        }
        if (readQueue.isNotEmpty()) {
            sLog("modo C — lendo características de diagnóstico (${readQueue.size})")
            handler.post { processNextRead() }
        }
    }

    private fun processNextRead() {
        if (isReading) return
        val g = gatt ?: return
        val next = readQueue.removeFirstOrNull() ?: return
        isReading = true
        handler.postDelayed({
            @Suppress("DEPRECATION")
            val started = g.readCharacteristic(next)
            if (!started) {
                isReading = false
                handler.post { processNextRead() }
            }
        }, 200)
    }

    private fun cleanup() {
        connectionTimeoutRunnable?.let { handler.removeCallbacks(it) }
        connectionTimeoutRunnable = null
        discoveryTimeoutRunnable?.let { handler.removeCallbacks(it) }
        discoveryTimeoutRunnable = null
        requestControlRetryRunnable?.let { handler.removeCallbacks(it) }
        requestControlRetryRunnable = null
        pendingSetRunnable?.let { handler.removeCallbacks(it) }
        pendingSetRunnable = null
        pendingSetCommand = null
        stopKeepAlive()
        keepAliveFailures = 0
        pendingDescriptorWrite = null
        controlPointNotificationsEnabled = false
        autoStarted = false
        metricsReceived = false
        gatt?.close()
        gatt = null
        ftmsMeasurementChar = null
        ftmsControlPointChar = null
        ftmsStatusChar = null
        preambleChar = null
        readQueue.clear()
        isReading = false
        requestQueue.clear()
        pendingRetry = null
        isWriting = false
        sessionLog?.finish()
        sessionLog = null
        _state = BleState.Disconnected
        onStateChange?.invoke(state)
    }
}
