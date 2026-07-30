package com.correlogo.app

import android.content.Intent
import android.util.Log
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseRoute
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.units.Length
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId

@CapacitorPlugin(name = "HealthConnect")
class HealthConnectPlugin : Plugin() {

    companion object {
        private const val TAG = "CorreLogo-HC"
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var client: HealthConnectClient? = null
    private val permContract = PermissionController.createRequestPermissionResultContract()

    override fun load() {
        Log.d(TAG, "Plugin loaded")
    }

    private fun ensureClient(): Boolean {
        if (client != null) return true
        val ctx = activity?.applicationContext ?: bridge.context ?: return false
        val sdkStatus = HealthConnectClient.getSdkStatus(ctx)
        if (sdkStatus == HealthConnectClient.SDK_AVAILABLE) {
            try {
                client = HealthConnectClient.getOrCreate(ctx)
                Log.d(TAG, "HealthConnectClient initialized (lazy)")
            } catch (e: Exception) {
                Log.e(TAG, "HealthConnectClient lazy init failed", e)
            }
        } else {
            Log.w(TAG, "Health Connect SDK not available (status=$sdkStatus)")
        }
        return client != null
    }

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        call.resolve(JSObject().apply { put("available", ensureClient()) })
    }

    @PluginMethod
    fun checkHcPermissions(call: PluginCall) {
        if (!ensureClient()) {
            call.resolve(JSObject().apply { put("granted", false) })
            return
        }
        val c = client!!
        scope.launch {
            try {
                val grantedPerms = c.permissionController.getGrantedPermissions()
                val writePerm = HealthPermission.getWritePermission(ExerciseSessionRecord::class)
                val granted = writePerm in grantedPerms
                Log.d(TAG, "checkHcPermissions: WRITE_EXERCISE granted=$granted")
                call.resolve(JSObject().apply { put("granted", granted) })
            } catch (e: Exception) {
                Log.e(TAG, "checkHcPermissions error", e)
                call.resolve(JSObject().apply { put("granted", false) })
            }
        }
    }

    @PluginMethod
    fun requestHcPermissions(call: PluginCall) {
        val a = activity
        if (a == null) {
            Log.w(TAG, "requestHcPermissions: activity is null")
            call.resolve(JSObject().apply { put("granted", false) })
            return
        }

        val permissions = setOf(
            HealthPermission.getWritePermission(ExerciseSessionRecord::class),
            HealthPermission.getWritePermission(DistanceRecord::class)
        )

        val intent = permContract.createIntent(a, permissions)

        Log.d(TAG, "Opening HC permissions page for package=${a.packageName}")
        startActivityForResult(call, intent, "handleHcPermissionResult")
    }

    @ActivityCallback
    fun handleHcPermissionResult(call: PluginCall, result: ActivityResult) {
        val grantedPerms = permContract.parseResult(result.resultCode, result.data)
        val writePerm = HealthPermission.getWritePermission(ExerciseSessionRecord::class)
        val granted = writePerm in grantedPerms
        Log.d(TAG, "Permission result: WRITE_EXERCISE granted=$granted (${grantedPerms.size} total)")
        call.resolve(JSObject().apply { put("granted", granted) })
    }

    @PluginMethod
    fun exportWorkout(call: PluginCall) {
        val data = call.getObject("workout")
        if (data == null) { call.reject("workout data required"); return }

        if (!ensureClient()) { call.reject("Health Connect not available"); return }
        val c = client!!

        scope.launch {
            try {
                val grantedPerms = c.permissionController.getGrantedPermissions()
                val writePerm = HealthPermission.getWritePermission(ExerciseSessionRecord::class)
                if (writePerm !in grantedPerms) {
                    Log.w(TAG, "WRITE_EXERCISE not granted — cannot export")
                    call.reject("WRITE_EXERCISE not granted. Grant it in Profile > Health Connect.")
                    return@launch
                }

                val startTime = Instant.ofEpochMilli(data.optLong("startTime", 0L))
                val endTime = Instant.ofEpochMilli(data.optLong("endTime", 0L))
                val distanceKm = data.optDouble("distanceKm", 0.0)
                val isTreadmill = data.optString("exerciseType", "treadmill") == "treadmill"
                val exerciseType = if (isTreadmill)
                    ExerciseSessionRecord.EXERCISE_TYPE_RUNNING_TREADMILL
                else
                    ExerciseSessionRecord.EXERCISE_TYPE_RUNNING

                val zoneOffset = ZoneId.systemDefault().rules.getOffset(startTime)
                val metadata = Metadata.unknownRecordingMethod()
                val route = buildRoute(data)

                val session = if (route != null) {
                    ExerciseSessionRecord(
                        startTime, zoneOffset, endTime, zoneOffset, metadata,
                        exerciseType, "Corre Logo", null, emptyList(), emptyList(), route
                    )
                } else {
                    ExerciseSessionRecord(
                        startTime, zoneOffset, endTime, zoneOffset, metadata,
                        exerciseType
                    )
                }

                val records: MutableList<Record> = mutableListOf(session)
                if (distanceKm > 0.0) {
                    records.add(
                        DistanceRecord(startTime, zoneOffset, endTime, zoneOffset,
                            Length.kilometers(distanceKm), metadata)
                    )
                }

                try {
                    c.insertRecords(records)
                } catch (routeErr: Exception) {
                    if (route != null) {
                        Log.w(TAG, "Insert with route failed, retrying without route", routeErr)
                        val fallback = ExerciseSessionRecord(
                            startTime, zoneOffset, endTime, zoneOffset, metadata,
                            exerciseType
                        )
                        val fallbackRecords: MutableList<Record> = mutableListOf(fallback)
                        if (distanceKm > 0.0) {
                            fallbackRecords.add(
                                DistanceRecord(startTime, zoneOffset, endTime, zoneOffset,
                                    Length.kilometers(distanceKm), metadata)
                            )
                        }
                        c.insertRecords(fallbackRecords)
                        Log.d(TAG, "Workout exported without route (route failed: ${routeErr.message})")
                        call.resolve(JSObject().apply { put("success", true) })
                        return@launch
                    }
                    throw routeErr
                }
                Log.d(TAG, "Workout exported: ${records.size} records")
                call.resolve(JSObject().apply { put("success", true) })
            } catch (e: Exception) {
                Log.e(TAG, "exportWorkout error", e)
                call.reject("Export failed: ${e.message}")
            }
        }
    }

    private fun buildRoute(data: JSObject): ExerciseRoute? {
        val arr = data.optJSONArray("route") ?: return null
        val locations = mutableListOf<ExerciseRoute.Location>()
        for (i in 0 until arr.length()) {
            val p = arr.getJSONObject(i)
            val lat = p.optDouble("lat", 0.0)
            val lng = p.optDouble("lng", 0.0)
            if (lat == 0.0 && lng == 0.0) continue
            val ts = p.optLong("timestamp", 0L)
            val time = if (ts > 0L) Instant.ofEpochMilli(ts) else Instant.now()
            val alt = p.optDouble("altitude", Double.NaN)
            val altitude = if (alt.isNaN()) null else Length.meters(alt)
            locations.add(ExerciseRoute.Location(time, lat, lng, null, null, altitude))
        }
        if (locations.isEmpty()) return null
        return ExerciseRoute(locations)
    }
}
