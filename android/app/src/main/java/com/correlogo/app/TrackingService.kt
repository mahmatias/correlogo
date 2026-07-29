package com.correlogo.app

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.getcapacitor.JSObject
import com.getcapacitor.PluginCall

class TrackingService : Service(), SensorEventListener {

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private lateinit var sensorManager: SensorManager
    private var stepSensor: Sensor? = null
    private var initialSteps: Float = 0f
    private var hasInitialSteps = false
    private var wakeLock: PowerManager.WakeLock? = null

    // Native timer — immune to WebView background throttling
    private val timerHandler = Handler(Looper.getMainLooper())
    private var timerRunning = false
    private var timerPaused = false
    private var timerStartMs: Long = 0L
    private var timerPausedAtMs: Long = 0L
    private var timerAccumulatedPauseMs: Long = 0L

    private val timerRunnable = object : Runnable {
        override fun run() {
            if (!timerRunning || timerPaused) return
            val elapsed = ((System.currentTimeMillis() - timerStartMs - timerAccumulatedPauseMs) / 1000).toInt()
            currentPlugin?.emitTimerTick(elapsed)
            timerHandler.postDelayed(this, 1000L)
        }
    }

    companion object {
        const val CHANNEL_ID = "tracking_channel"
        const val NOTIFICATION_ID = 1
        var currentPlugin: TrackingPlugin? = null
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        sensorManager = getSystemService(SENSOR_SERVICE) as SensorManager
        stepSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                for (location in locationResult.locations) {
                    emitLocation(location)
                }
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Start foreground immediately (required before any work)
        val notification = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
        acquireWakeLock()

        // GPS tracking (only if permission granted)
        if (checkLocationPermission()) {
            val locationRequest = LocationRequest.Builder(3000L)
                .setPriority(Priority.PRIORITY_HIGH_ACCURACY)
                .setMinUpdateIntervalMillis(1000L)
                .build()

            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            )

            stepSensor?.let { sensor ->
                sensorManager.registerListener(this, sensor, SensorManager.SENSOR_DELAY_NORMAL)
            }
        }

        // Native timer actions (treadmill mode)
        val action = intent?.getStringExtra("action")
        when (action) {
            "start_timer" -> {
                val elapsed = intent.getLongExtra("elapsedSeconds", 0L)
                startTimerInternal(elapsed)
            }
            "pause_timer" -> pauseTimerInternal()
            "resume_timer" -> resumeTimerInternal()
            "stop_timer" -> stopTimerInternal()
        }

        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        fusedLocationClient.removeLocationUpdates(locationCallback)
        sensorManager.unregisterListener(this)
        stopTimerInternal()
        releaseWakeLock()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // --- Native timer ---

    private fun startTimerInternal(elapsedSeconds: Long) {
        timerStartMs = System.currentTimeMillis() - (elapsedSeconds * 1000)
        timerAccumulatedPauseMs = 0L
        timerPaused = false
        timerRunning = true
        timerHandler.removeCallbacks(timerRunnable)
        timerHandler.post(timerRunnable)
    }

    private fun pauseTimerInternal() {
        if (!timerRunning || timerPaused) return
        timerPaused = true
        timerPausedAtMs = System.currentTimeMillis()
        timerHandler.removeCallbacks(timerRunnable)
    }

    private fun resumeTimerInternal() {
        if (!timerRunning || !timerPaused) return
        timerAccumulatedPauseMs += System.currentTimeMillis() - timerPausedAtMs
        timerPaused = false
        timerHandler.post(timerRunnable)
    }

    private fun stopTimerInternal() {
        timerRunning = false
        timerPaused = false
        timerHandler.removeCallbacks(timerRunnable)
    }

    // --- Sensor + location ---

    override fun onSensorChanged(event: SensorEvent?) {
        event?.let {
            if (!hasInitialSteps) {
                initialSteps = it.values[0]
                hasInitialSteps = true
            }
            val steps = (it.values[0] - initialSteps).toInt().coerceAtLeast(0)
            currentPlugin?.notifySteps(steps)
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    private fun emitLocation(location: Location) {
        val obj = JSObject().apply {
            put("latitude", location.latitude)
            put("longitude", location.longitude)
            put("altitude", location.altitude)
            put("accuracy", location.accuracy)
            put("speed", location.speed)
            put("timestamp", location.time)
        }
        currentPlugin?.emitLocation(obj)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Tracking de Treino",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Notificação persistente durante o treino"
            }
            (getSystemService(NOTIFICATION_SERVICE) as NotificationManager)
                .createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Corre Logo")
            .setContentText("Gravando treino...")
            .setSmallIcon(android.R.drawable.ic_dialog_map)
            .setOngoing(true)
            .setSilent(true)
            .build()
    }

    private fun checkLocationPermission(): Boolean {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    }

    private fun acquireWakeLock() {
        if (wakeLock == null) {
            val pm = getSystemService(POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "correlogo::tracking_wakelock"
            ).apply {
                acquire()
            }
        }
    }

    private fun releaseWakeLock() {
        wakeLock?.let {
            if (it.isHeld) it.release()
            wakeLock = null
        }
    }
}
