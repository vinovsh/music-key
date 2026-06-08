package com.music

import android.app.Application
import android.util.Log
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.music.audio.AudioEngineBridge

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // App-local native modules (not autolinked):
          add(com.music.audio.RecorderPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)

    // Start the native audio engine and load the SoundFont from assets up front,
    // so the Oboe stream is running and the synth is ready before the first tap.
    // (Loading happens AFTER start() so the synth renders at the device rate.)
    try {
      AudioEngineBridge.start()
      val ok = AudioEngineBridge.loadSoundFontFromAsset(assets, SOUNDFONT_ASSET)
      if (!ok) Log.e("AudioEngine", "Failed to load SoundFont: $SOUNDFONT_ASSET")
    } catch (t: Throwable) {
      Log.e("AudioEngine", "Audio engine init failed", t)
    }
  }

  companion object {
    // DEV SoundFont (TinySoundFont example, MIT-adjacent). Shipping SF2 + license
    // is still an open question — see TASK.md.
    private const val SOUNDFONT_ASSET = "soundfonts/florestan-subset.sf2"
  }
}
