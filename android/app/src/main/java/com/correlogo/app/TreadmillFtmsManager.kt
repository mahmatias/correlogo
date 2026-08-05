package com.correlogo.app

import android.util.Log
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.UUID

class TreadmillFtmsManager {

    companion object {
        private const val TAG = "CorreLogo-FTMS"

        init {
            validateUUIDs()
        }

        private fun validateUUIDs() {
            val uuids = mapOf(
                "FTMS_SERVICE" to "00001826-0000-1000-8000-00805f9b34fb",
                "TREADMILL_DATA" to "00002acd-0000-1000-8000-00805f9b34fb",
                "CONTROL_POINT" to "00002ad9-0000-1000-8000-00805f9b34fb",
                "CCCD" to "00002902-0000-1000-8000-00805f9b34fb",
            )
            uuids.forEach { (name, uuidStr) ->
                try {
                    UUID.fromString(uuidStr)
                    Log.d(TAG, "UUID válido: $name = $uuidStr")
                } catch (e: IllegalArgumentException) {
                    Log.e(TAG, "UUID INVÁLIDO: $name = $uuidStr")
                    throw IllegalStateException("Invalid UUID constant: $name")
                }
            }
        }
    }

    data class TreadmillMetrics(
        val instantSpeedKmh: Double = 0.0,
        val averageSpeedKmh: Double? = null,
        val totalDistanceMeters: Long? = null,
        val instantaneousInclinePercent: Double? = null,
        val elevationGainMeters: Double? = null,
        val stepRate: Int? = null,
        val heartRate: Int? = null,
        val elapsedTimeSeconds: Int? = null,
    )

    data class ControlPointResponse(
        val resultCode: Int,
        val requestedOpcode: Int,
    )

    fun parseMetrics(data: ByteArray): TreadmillMetrics {
        val buf = ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN)
        val flags = buf.getShort().toInt() and 0xFFFF

        var instantSpeedKmh = 0.0
        if (flags and 0x0001 == 0) {
            instantSpeedKmh = (buf.getShort().toInt() and 0xFFFF).toDouble() / 100.0
        }
        val averageSpeedKmh: Double? = if (flags and 0x0002 != 0) {
            (buf.getShort().toInt() and 0xFFFF).toDouble() / 100.0
        } else null
        val totalDistanceMeters: Long? = if (flags and 0x0004 != 0) {
            val b0 = buf.get().toInt() and 0xFF
            val b1 = buf.get().toInt() and 0xFF
            val b2 = buf.get().toInt() and 0xFF
            (b0 or (b1 shl 8) or (b2 shl 16)).toLong()
        } else null
        val instantaneousInclinePercent: Double? = if (flags and 0x0008 != 0) {
            buf.getShort().toDouble() / 10.0
        } else null
        if (flags and 0x0008 != 0) buf.getShort()
        if (flags and 0x0010 != 0) buf.getShort()
        if (flags and 0x0010 != 0) buf.getShort()
        if (flags and 0x0020 != 0) buf.get()
        if (flags and 0x0040 != 0) buf.get()
        if (flags and 0x0080 != 0) buf.getShort()
        if (flags and 0x0080 != 0) buf.getShort()
        if (flags and 0x0080 != 0) buf.get()
        val heartRate: Int? = if (flags and 0x0100 != 0) {
            buf.get().toInt() and 0xFF
        } else null
        if (flags and 0x0200 != 0) buf.get()
        val elapsedTimeSeconds: Int? = if (flags and 0x0400 != 0) {
            (buf.getShort().toInt() and 0xFFFF)
        } else null
        if (flags and 0x0800 != 0) buf.getShort()

        return TreadmillMetrics(
            instantSpeedKmh = instantSpeedKmh,
            averageSpeedKmh = averageSpeedKmh,
            totalDistanceMeters = totalDistanceMeters,
            instantaneousInclinePercent = instantaneousInclinePercent,
            heartRate = heartRate,
            elapsedTimeSeconds = elapsedTimeSeconds,
        )
    }

    fun encodeSetSpeed(speedKmh: Double): ByteArray {
        val speedRaw = (speedKmh * 100).toInt()
        return ByteBuffer.allocate(3).order(ByteOrder.LITTLE_ENDIAN).apply {
            put(0x02.toByte())
            putShort(speedRaw.toShort())
        }.array()
    }

    fun encodeSetIncline(inclinePercent: Double): ByteArray {
        val inclineRaw = (inclinePercent * 10).toInt()
        return ByteBuffer.allocate(3).order(ByteOrder.LITTLE_ENDIAN).apply {
            put(0x03.toByte())
            putShort(inclineRaw.toShort())
        }.array()
    }

    fun encodeRequestControl(): ByteArray {
        return byteArrayOf(0x00)
    }

    fun encodeReset(): ByteArray {
        return byteArrayOf(0x01)
    }

    fun encodeStart(): ByteArray {
        return byteArrayOf(0x07)
    }

    fun parseControlPointResponse(data: ByteArray): ControlPointResponse {
        val buf = ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN)
        val requestedOpcode = buf.get(1).toInt() and 0xFF
        val resultCode = buf.get(2).toInt() and 0xFF
        return ControlPointResponse(resultCode, requestedOpcode)
    }
}
