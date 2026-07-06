package com.correlogo.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "Permissions",
    permissions = [
        Permission(strings = [Manifest.permission.POST_NOTIFICATIONS], alias = "notifications"),
        Permission(strings = [Manifest.permission.ACTIVITY_RECOGNITION], alias = "activity")
    ]
)
class PermissionsPlugin : Plugin() {

    private var pendingCall: PluginCall? = null;
    private val REQUEST_CODE = 9101;

    @PluginMethod
    fun requestAll(call: PluginCall) {
        val ctx = context;

        val notifGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        };

        val activityGranted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED;

        if (notifGranted && activityGranted) {
            val ret = JSObject();
            ret.put("notifications", "granted");
            ret.put("activity", "granted");
            call.resolve(ret);
            return;
        }

        val toRequest = mutableListOf<String>();
        val needNotif = !notifGranted;
        if (needNotif && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            toRequest.add(Manifest.permission.POST_NOTIFICATIONS);
        }
        if (!activityGranted) toRequest.add(Manifest.permission.ACTIVITY_RECOGNITION);

        if (toRequest.isEmpty()) {
            val ret = JSObject();
            ret.put("notifications", if (notifGranted) "granted" else "denied");
            ret.put("activity", if (activityGranted) "granted" else "denied");
            call.resolve(ret);
            return;
        }

        pendingCall = call;
        pluginRequestPermissions(toRequest.toTypedArray(), REQUEST_CODE);
    }

    @PluginMethod
    fun checkAll(call: PluginCall) {
        val ctx = context;
        val ret = JSObject();
        ret.put("notifications",
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) "granted" else "denied"
            } else {
                "granted"
            }
        );
        ret.put("activity",
            if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED) "granted" else "denied"
        );
        call.resolve(ret);
    }

    @Suppress("DEPRECATION")
    override fun handleRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray) {
        super.handleRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQUEST_CODE) return;
        val call = pendingCall ?: return;
        pendingCall = null;

        val ctx = context;
        val ret = JSObject();
        ret.put("notifications",
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) "granted" else "denied"
            } else {
                "granted"
            }
        );
        ret.put("activity",
            if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED) "granted" else "denied"
        );
        call.resolve(ret);
    }
}