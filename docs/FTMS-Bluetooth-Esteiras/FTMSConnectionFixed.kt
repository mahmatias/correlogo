import android.bluetooth.*
import android.os.Handler
import android.os.Looper
import java.util.*

/**
 * Conexão FTMS Corrigida para WiLinktech Vision ID
 * Baseado em logs do nRF Connect
 */
class FTMSConnectionFixed(private val bluetoothDevice: BluetoothDevice) {
    
    companion object {
        // UUIDs corretos (conforme logs nRF)
        private const val FITNESS_MACHINE_SERVICE     = "0000181e-0000-1000-8000-00805f9b34fb"
        private const val TREADMILL_DATA              = "00002acd-0000-1000-8000-00805f9b34fb"
        private const val FITNESS_MACHINE_STATUS      = "00002ada-0000-1000-8000-00805f9b34fb"
        private const val FITNESS_MACHINE_FEATURE     = "00002acc-0000-1000-8000-00805f9b34fb"
        private const val FITNESS_MACHINE_CONTROL_PT  = "00002ad9-0000-1000-8000-00805f9b34fb"
        private const val CLIENT_CHARACTERISTIC_CONFIG = "00002902-0000-1000-8000-00805f9b34fb"
    }
    
    private var gatt: BluetoothGatt? = null
    private var connectionCallback: ((Boolean) -> Unit)? = null
    private var dataCallback: ((String) -> Unit)? = null
    
    fun connect(callback: (Boolean) -> Unit) {
        this.connectionCallback = callback
        
        // Importante: usar autoConnect = false para conexão imediata
        gatt = bluetoothDevice.connectGatt(null, false, gattCallback, BluetoothDevice.TRANSPORT_LE)
        
        Log.d("FTMS", "Conectando a ${bluetoothDevice.name} (${bluetoothDevice.address})")
    }
    
    private val gattCallback = object : BluetoothGattCallback() {
        
        override fun onConnectionStateChange(gatt: BluetoothGatt?, status: Int, newState: Int) {
            when (newState) {
                BluetoothProfile.STATE_CONNECTED -> {
                    Log.d("FTMS", "✓ Conectado!")
                    
                    // CRÍTICO: Aguardar um pouco antes de descobrir serviços
                    Handler(Looper.getMainLooper()).postDelayed({
                        gatt?.discoverServices()
                    }, 500)
                }
                BluetoothProfile.STATE_DISCONNECTED -> {
                    Log.d("FTMS", "✗ Desconectado")
                    connectionCallback?.invoke(false)
                }
            }
        }
        
        override fun onServicesDiscovered(gatt: BluetoothGatt?, status: Int) {
            if (status != BluetoothGatt.GATT_SUCCESS) {
                Log.e("FTMS", "Erro ao descobrir serviços: $status")
                connectionCallback?.invoke(false)
                return
            }
            
            Log.d("FTMS", "✓ Serviços descobertos")
            
            try {
                // Step 1: Procurar FTMS Service
                val ftmsService = gatt?.getService(
                    UUID.fromString(FITNESS_MACHINE_SERVICE)
                )
                
                if (ftmsService == null) {
                    Log.e("FTMS", "❌ FTMS Service (0x181e) não encontrado!")
                    logAllCharacteristics(gatt)
                    connectionCallback?.invoke(false)
                    return
                }
                
                Log.d("FTMS", "✓ FTMS Service encontrado")
                
                // Step 2: Procurar Treadmill Data
                val treadmillData = ftmsService.getCharacteristic(
                    UUID.fromString(TREADMILL_DATA)
                )
                
                if (treadmillData == null) {
                    Log.e("FTMS", "❌ Treadmill Data (0x2ACD) não encontrado!")
                    connectionCallback?.invoke(false)
                    return
                }
                
                Log.d("FTMS", "✓ Treadmill Data characteristic encontrado")
                
                // Step 3: Habilitar notificações
                enableNotifications(gatt, treadmillData)
                
                // Step 4: Ler Feature (opcional)
                readFeatures(gatt, ftmsService)
                
                Log.d("FTMS", "✅ FTMS Conectado com sucesso!")
                connectionCallback?.invoke(true)
                
            } catch (e: Exception) {
                Log.e("FTMS", "Erro ao processar serviços: ${e.message}")
                e.printStackTrace()
                connectionCallback?.invoke(false)
            }
        }
        
        override fun onCharacteristicRead(gatt: BluetoothGatt?, characteristic: BluetoothGattCharacteristic?, status: Int) {
            if (status != BluetoothGatt.GATT_SUCCESS) {
                Log.e("FTMS", "Erro ao ler characteristic: ${characteristic?.uuid}")
                return
            }
            
            when (characteristic?.uuid.toString().lowercase()) {
                TREADMILL_DATA -> {
                    val speed = characteristic?.value?.let { parseTreadmillData(it) }
                    Log.d("FTMS", "📊 Treadmill Data: $speed km/h")
                    dataCallback?.invoke(speed.toString())
                }
            }
        }
        
        override fun onCharacteristicChanged(gatt: BluetoothGatt?, characteristic: BluetoothGattCharacteristic?) {
            // Notificações chegam aqui
            when (characteristic?.uuid.toString().lowercase()) {
                TREADMILL_DATA -> {
                    val speed = parseTreadmillData(characteristic?.value ?: ByteArray(0))
                    Log.d("FTMS", "📊 Speed: $speed km/h")
                    dataCallback?.invoke(speed.toString())
                }
            }
        }
        
        override fun onDescriptorWrite(gatt: BluetoothGatt?, descriptor: BluetoothGattDescriptor?, status: Int) {
            if (status != BluetoothGatt.GATT_SUCCESS) {
                Log.e("FTMS", "Erro ao escrever descriptor: $status")
                return
            }
            Log.d("FTMS", "✓ Notificações habilitadas para ${descriptor?.characteristic?.uuid}")
        }
    }
    
    private fun enableNotifications(gatt: BluetoothGatt?, characteristic: BluetoothGattCharacteristic) {
        // Habilitar notificações localmente
        gatt?.setCharacteristicNotification(characteristic, true)
        
        // Escrever no CCCD (Client Characteristic Configuration Descriptor)
        val cccd = characteristic.getDescriptor(
            UUID.fromString(CLIENT_CHARACTERISTIC_CONFIG)
        )
        
        if (cccd != null) {
            cccd.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
            gatt?.writeDescriptor(cccd)
            Log.d("FTMS", "✓ CCCD escrito para ${characteristic.uuid}")
        } else {
            Log.w("FTMS", "⚠ CCCD não encontrado")
        }
    }
    
    private fun readFeatures(gatt: BluetoothGatt?, service: BluetoothGattService) {
        val feature = service.getCharacteristic(
            UUID.fromString(FITNESS_MACHINE_FEATURE)
        )
        if (feature != null) {
            gatt?.readCharacteristic(feature)
            Log.d("FTMS", "✓ Lendo features...")
        }
    }
    
    private fun parseTreadmillData(data: ByteArray): Double {
        if (data.size < 2) return 0.0
        
        // Speed está nos bytes 0-1 (little endian)
        // Formato: UInt16, em 0.01 km/h
        val speedRaw = (data[0].toInt() and 0xFF) or ((data[1].toInt() and 0xFF) shl 8)
        return speedRaw * 0.01
    }
    
    private fun logAllCharacteristics(gatt: BluetoothGatt?) {
        Log.e("FTMS", "🚨 Listando todas as características disponíveis:")
        gatt?.services?.forEach { service ->
            Log.e("FTMS", "Service: ${service.uuid}")
            service.characteristics.forEach { char ->
                Log.e("FTMS", "  └─ ${char.uuid} (properties: ${char.properties})")
            }
        }
    }
    
    fun setDataCallback(callback: (String) -> Unit) {
        this.dataCallback = callback
    }
    
    fun disconnect() {
        gatt?.disconnect()
        gatt?.close()
        gatt = null
    }
}
