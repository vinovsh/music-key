package com.music.audio

import android.content.Context
import android.media.AudioManager

/**
 * Ties the Oboe stream to the app lifecycle + audio focus (roadmap §8):
 *  - foreground/resume → request focus + (re)start the stream
 *  - background/pause  → stop the stream + abandon focus (lets other apps play,
 *    saves battery)
 *  - transient focus loss (incoming call, etc.) → pause; regain → resume
 *
 * Note: the latency-critical keypress path is untouched; this only governs when
 * the stream exists.
 */
object AudioLifecycle {
  private var audioManager: AudioManager? = null
  private var foreground = false

  private val focusListener = AudioManager.OnAudioFocusChangeListener { change ->
    when (change) {
      // Real focus loss (another media app, or a phone call): release the stream
      // and wait for AUDIOFOCUS_GAIN to rebuild it.
      AudioManager.AUDIOFOCUS_LOSS,
      AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> AudioEngineBridge.pause()
      AudioManager.AUDIOFOCUS_GAIN -> if (foreground) AudioEngineBridge.resume()
      // "Can duck" = a transient ping (notification, nav voice). Android does NOT
      // send a follow-up GAIN for ducking, so pausing here left the stream dead
      // forever while the app stayed in front. Keep playing — a piano need not go
      // silent for a notification chime. (This was the recurring "sound is gone".)
      AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> { /* keep playing */ }
    }
  }

  fun onResume(context: Context) {
    foreground = true
    val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    audioManager = am
    @Suppress("DEPRECATION")
    am.requestAudioFocus(
      focusListener,
      AudioManager.STREAM_MUSIC,
      AudioManager.AUDIOFOCUS_GAIN,
    )
    AudioEngineBridge.resume()
  }

  fun onPause() {
    foreground = false
    AudioEngineBridge.pause()
    @Suppress("DEPRECATION")
    audioManager?.abandonAudioFocus(focusListener)
  }
}
