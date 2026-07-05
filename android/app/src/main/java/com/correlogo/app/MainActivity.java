package com.correlogo.app;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(TrackingPlugin.class);
        registerPlugin(AudioFocusPlugin.class);

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    }
}
