package com.music.audio

import android.content.res.AssetManager
import com.facebook.soloader.SoLoader

/**
 * Kotlin -> C++ startup bridge for the native audio engine.
 *
 * Only used at app startup (from MainApplication) to spin up the Oboe stream and
 * load the SoundFont from the APK assets. All note playback happens through the
 * NativeAudioEngine C++ TurboModule (synchronous JSI), NOT through this bridge.
 *
 * The native symbols live in libappmodules.so (see cpp/AudioEngineJni.cpp).
 */
object AudioEngineBridge {
  @Volatile private var loaded = false

  private fun ensureLibrary() {
    if (!loaded) {
      // SoLoader is already initialised by loadReactNative(); this resolves
      // libappmodules.so and its React Native dependencies.
      SoLoader.loadLibrary("appmodules")
      loaded = true
    }
  }

  /** Open + start the Oboe output stream (idempotent). */
  fun start() {
    ensureLibrary()
    nativeStart()
  }

  /** Load an SF2 SoundFont bundled in assets (e.g. "soundfonts/piano.sf2"). */
  fun loadSoundFontFromAsset(assets: AssetManager, assetPath: String): Boolean {
    ensureLibrary()
    return nativeLoadSoundFontFromAsset(assets, assetPath)
  }

  /** "REC As Sound": start capturing rendered PCM to a 16-bit WAV file. */
  fun startPcmRecording(wavPath: String): Boolean {
    ensureLibrary()
    return nativeStartPcmRecording(wavPath)
  }

  /** Stop PCM capture; returns the number of frames written. */
  fun stopPcmRecording(): Long {
    ensureLibrary()
    return nativeStopPcmRecording()
  }

  /** Release the Oboe stream (backgrounded / audio-focus lost). */
  fun pause() {
    ensureLibrary()
    nativePause()
  }

  /** Rebuild + restart the Oboe stream (foregrounded / focus regained). */
  fun resume() {
    ensureLibrary()
    nativeResume()
  }

  private external fun nativeStart()
  private external fun nativeLoadSoundFontFromAsset(
    assets: AssetManager,
    assetPath: String,
  ): Boolean
  private external fun nativeStartPcmRecording(wavPath: String): Boolean
  private external fun nativeStopPcmRecording(): Long
  private external fun nativePause()
  private external fun nativeResume()
}
