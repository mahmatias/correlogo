package com.correlogo.app

import java.nio.ByteBuffer
import java.nio.ByteOrder

class TreadmillFtmsManager {

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
        if (flags and 0x0001 != 0) {
            instantSpeedKmh = buf.getShort().toInt() and 0xFFFF / 100.0
        }
        val totalDistanceMeters: Long? = if (flags and 0x0002 != 0) {
            buf.getInt().toLong() and 0xFFFFFFFFL
        } else null
        val instantaneousInclinePercent: Double? = if (flags and 0x0004 != 0) {
            buf.getShort().toDouble() / 10.0
        } else null

        if (flags and 0x0008 != 0) buf.getShort()
        if (flags and 0x0010 != 0) buf.getShort()
        if (flags and 0x0020 != 0) buf.get()
        if (flags and 0x0040 != 0) buf.getShort()
        if (flags and 0x0080 != 0) buf.getShort()
        if (flags and 0x0100 != 0) buf.getShort()
        if (flags and 0x0200 != 0) buf.getShort()

        return TreadmillMetrics(
            instantSpeedKmh = instantSpeedKmh,
            totalDistanceMeters = totalDistanceMeters,
            instantaneousInclinePercent = instantaneousInclinePercent,
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

    fun parseControlPointResponse(data: ByteArray): ControlPointResponse {
        val buf = ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN)
        val resultCode = buf.get(1).toInt() and 0xFF
        val requestedOpcode = buf.get(2).toInt() and 0xFF
        return ControlPointResponse(resultCode, requestedOpcode)
    }
}
