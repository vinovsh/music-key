package com.music

import android.os.Bundle
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.music.audio.AudioLifecycle

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    hideNavigationBar()
  }

  // Re-hide the navigation bar after the user swipes it back (sticky immersive)
  // or after returning from another app.
  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) hideNavigationBar()
  }

  // Edge-to-edge: take over the bottom system-navigation space so the keyboard
  // uses the full screen height. The bar reappears transiently on swipe.
  private fun hideNavigationBar() {
    WindowCompat.setDecorFitsSystemWindows(window, false)
    WindowInsetsControllerCompat(window, window.decorView).apply {
      hide(WindowInsetsCompat.Type.navigationBars())
      systemBarsBehavior =
          WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    }
  }

  // Stop the Oboe stream when backgrounded / on audio-focus loss; rebuild on
  // resume (roadmap §8). The loaded SoundFont survives across this.
  override fun onResume() {
    super.onResume()
    AudioLifecycle.onResume(this)
  }

  override fun onPause() {
    AudioLifecycle.onPause()
    super.onPause()
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "music"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
