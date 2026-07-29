package com.correlogo.app

import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.samsung.android.sdk.healthdata.HealthConstants
import com.samsung.android.sdk.healthdata.HealthData
import com.samsung.android.sdk.healthdata.HealthDataResolver
import com.samsung.android.sdk.healthdata.HealthDataService
import com.samsung.android.sdk.healthdata.HealthDataStore
import com.samsung.android.sdk.healthdata.HealthDeviceManager
import com.samsung.android.sdk.healthdata.HealthPermissionManager
import org.json.JSONObject
import java.util.HashSet

@CapacitorPlugin(name = "SamsungHealth")
class SamsungHealthPlugin : Plugin() {

    companion object {
        private const val TAG = "CorreLogo-SHealth"
        private const val APP_ID = "correlogo_sync"
    }

    private var dataStore: HealthDataStore? = null
    private var localDeviceUuid: String? = null
    private var isConnected = false

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        try {
            val available = HealthDataService().isAvailable
            call.resolve(JSObject().apply { put("available", available) })
        } catch (e: Exception) {
            call.resolve(JSObject().apply { put("available", false) })
        }
    }

    @PluginMethod
    fun getPermissionStatus(call: PluginCall) {
        if (!ensureConnected()) {
            call.resolve(JSObject().apply { put("granted", false) })
            return
        }
        val pm = HealthPermissionManager(dataStore)
        val keys = buildPermissionKeys()
        val result = pm.isPermissionAcquired(keys)
        val granted = keys.all { result[it] == true }
        call.resolve(JSObject().apply { put("granted", granted) })
    }

    @PluginMethod
    fun requestPermission(call: PluginCall) {
        if (!ensureConnected()) {
            call.reject("Not connected to Samsung Health")
            return
        }
        val pm = HealthPermissionManager(dataStore)
        val keys = buildPermissionKeys()
        pm.requestPermissions(activity, keys).setResultListener { result ->
            val granted = keys.all {
                result.getResult(it) == HealthPermissionManager.PermissionResponse.SUCCESS
            }
            call.resolve(JSObject().apply { put("granted", granted) })
        }
    }

    @PluginMethod
    fun exportWorkout(call: PluginCall) {
        val data = call.getObject("workout")
        if (data == null) { call.reject("workout data is required"); return }
        if (!ensureConnected()) { call.reject("Not connected"); return }

        try {
            val resolver = HealthDataResolver(dataStore, null)
            val exerciseId = java.util.UUID.randomUUID().toString()
            insertExercise(resolver, data, exerciseId)
            insertExerciseTracking(resolver, data, exerciseId)
            call.resolve(JSObject().apply { put("success", true) })
        } catch (e: Exception) {
            Log.e(TAG, "exportWorkout failed", e)
            call.reject("Export failed: ${e.message}")
        }
    }

    private fun ensureConnected(): Boolean {
        if (isConnected && dataStore != null) return true
        return try {
            HealthDataService().initialize(activity.applicationContext)
            val lock = java.util.concurrent.CountDownLatch(1)
            val store = HealthDataStore(
                activity.applicationContext,
                object : HealthDataStore.ConnectionListener {
                    override fun onConnected() {
                        isConnected = true
                        localDeviceUuid = HealthDeviceManager(store).localDevice.uuid
                        lock.countDown()
                    }
                    override fun onConnectionFailed(e: Exception) { isConnected = false; lock.countDown() }
                    override fun onDisconnected() { isConnected = false }
                },
                APP_ID
            )
            store.connect()
            lock.await(3, java.util.concurrent.TimeUnit.SECONDS)
            dataStore = store
            isConnected
        } catch (e: Exception) {
            Log.e(TAG, "HealthDataStore connect failed", e)
            false
        }
    }

    private fun insertExercise(resolver: HealthDataResolver, data: JSONObject, exerciseId: String) {
        val healthData = HealthData()
        healthData.sourceDevice = localDeviceUuid
        healthData.putLong(HealthConstants.Exercise.START_TIME, data.optLong("startTime", 0L))
        healthData.putLong(HealthConstants.Exercise.END_TIME, data.optLong("endTime", 0L))
        healthData.putFloat(HealthConstants.Exercise.TIME_DURATION, data.optDouble("durationSeconds", 0.0).toFloat())
        healthData.putFloat(HealthConstants.Exercise.DISTANCE, (data.optDouble("distanceKm", 0.0) * 1000).toFloat())
        healthData.putFloat(HealthConstants.Exercise.MEAN_SPEED, data.optDouble("avgSpeedKmh", 0.0).toFloat())
        val exerciseType = if (data.optString("exerciseType", "treadmill") == "treadmill") 3000 else 2002
        healthData.putInt(HealthConstants.Exercise.EXERCISE_TYPE, exerciseType)
        healthData.putString(HealthConstants.Exercise.UUID, exerciseId)
        healthData.putString(HealthConstants.Exercise.CUSTOM_PACKAGE_NAME, activity.packageName)

        val insertRequest = HealthDataResolver.InsertRequest.Builder()
            .setDataType(HealthConstants.Exercise.HEALTH_DATA_TYPE)
            .build()
        insertRequest.addHealthData(healthData)
        resolver.insert(insertRequest)
    }

    private fun insertExerciseTracking(resolver: HealthDataResolver, data: JSONObject, exerciseId: String) {
        val routeArray = data.optJSONArray("route") ?: return
        val startTime = data.optLong("startTime", 0L)
        for (i in 0 until routeArray.length()) {
            val point = routeArray.getJSONObject(i)
            val healthData = HealthData()
            healthData.sourceDevice = localDeviceUuid
            healthData.putLong(HealthConstants.ExerciseTracking.TIME_OFFSET, point.optLong("timestamp", 0L) - startTime)
            healthData.putFloat(HealthConstants.ExerciseTracking.LATITUDE, point.optDouble("lat", 0.0).toFloat())
            healthData.putFloat(HealthConstants.ExerciseTracking.LONGITUDE, point.optDouble("lng", 0.0).toFloat())
            healthData.putFloat(HealthConstants.ExerciseTracking.ALTITUDE, point.optDouble("altitude", 0.0).toFloat())
            healthData.putString(HealthConstants.ExerciseTracking.EXERCISE_ID, exerciseId)

            val insertRequest = HealthDataResolver.InsertRequest.Builder()
                .setDataType(HealthConstants.ExerciseTracking.HEALTH_DATA_TYPE)
                .build()
            insertRequest.addHealthData(healthData)
            resolver.insert(insertRequest)
        }
    }

    private fun buildPermissionKeys(): HashSet<HealthPermissionManager.PermissionKey> {
        val keys = HashSet<HealthPermissionManager.PermissionKey>()
        keys.add(HealthPermissionManager.PermissionKey(
            HealthConstants.Exercise.HEALTH_DATA_TYPE, HealthPermissionManager.PermissionType.WRITE))
        keys.add(HealthPermissionManager.PermissionKey(
            HealthConstants.ExerciseTracking.HEALTH_DATA_TYPE, HealthPermissionManager.PermissionType.WRITE))
        return keys
    }
}
