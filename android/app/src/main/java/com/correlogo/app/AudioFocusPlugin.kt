package com.correlogo.app;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import android.util.Log;

@CapacitorPlugin(name = "AudioFocus")
class AudioFocusPlugin : Plugin() {

    private val audioManager: AudioManager by lazy {
        context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    }
    private var audioFocusRequest: AudioFocusRequest? = null;
    // Reference counter pairs every requestFocus() with an abandonFocus().
    // Only the first request (0->1) asks the system for focus and only the last
    // abandon (1->0) releases it, so overlapping calls never unbalance the duck.
    private var focusRefCount: Int = 0;
    private val focusLock = Any();

    override fun load() {
        super.load()
        Log.d("CorreLogo", "AudioFocusPlugin loaded and initialized")
    }

    @PluginMethod
    fun requestFocus(call: PluginCall) {
        Log.d("CorreLogo", "AudioFocusPlugin: requestFocus, ducking mode (reduce 80%)");
        synchronized(focusLock) {
            if (focusRefCount == 0) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val attributes = AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build();
                    // AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK diz ao sistema para reduzir o volume
                    // da música em ~80% em vez de pausá-la completamente. O sistema restaura
                    // o volume automaticamente ao abandonar o foco.
                    val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                        .setAudioAttributes(attributes)
                        .setOnAudioFocusChangeListener { focusChange ->
                            Log.d("CorreLogo", "AudioFocus change: $focusChange");
                        }
                        .build();
                    audioFocusRequest = request;
                    audioManager.requestAudioFocus(request);
                } else {
                    @Suppress("DEPRECATION")
                    audioManager.requestAudioFocus(
                        null,
                        AudioManager.STREAM_MUSIC,
                        AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
                    );
                }
            }
            focusRefCount++;
        }
        call.resolve();
    }

    @PluginMethod
    fun abandonFocus(call: PluginCall) {
        Log.d("CorreLogo", "AudioFocusPlugin: abandonFocus (restoring music)");
        synchronized(focusLock) {
            if (focusRefCount > 0) {
                focusRefCount--;
            }
            if (focusRefCount == 0) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val request = audioFocusRequest;
                    if (request != null) {
                        audioManager.abandonAudioFocusRequest(request);
                        audioFocusRequest = null;
                    }
                } else {
                    @Suppress("DEPRECATION")
                    audioManager.abandonAudioFocus(null);
                }
            }
        }
        call.resolve();
    }
}
