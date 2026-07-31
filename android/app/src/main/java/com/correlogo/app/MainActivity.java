package com.correlogo.app;

import android.os.Bundle;
import android.view.View;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

import android.util.Log;

public class MainActivity extends BridgeActivity {

    @Override
    protected void load() {
        registerPlugin(TrackingPlugin.class);
        registerPlugin(PermissionsPlugin.class);
        registerPlugin(AudioFocusPlugin.class);
        registerPlugin(HealthConnectPlugin.class);
        registerPlugin(TreadmillBlePlugin.class);
        registerPlugin(ApkInstallerPlugin.class);
        registerPlugin(SocialSharePlugin.class);
        super.load();
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Log.d("CorreLogo", "MainActivity onCreate called");

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        // Immersive sticky mode: conteúdo desenha atrás da barra de navegação,
        // que só reaparece com swipe do usuário
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_FULLSCREEN |
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION |
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
                View.SYSTEM_UI_FLAG_FULLSCREEN |
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            );
        }
    }
}
