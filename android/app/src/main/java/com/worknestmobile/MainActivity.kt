package com.worknestmobile

import android.content.res.Configuration
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.View
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.views.view.isEdgeToEdgeFeatureFlagOn
import com.swmansion.rnscreens.fragment.restoration.RNScreensFragmentFactory

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    // react-native-screens: screen fragments must not be restored after the activity is recreated (crash).
    supportFragmentManager.fragmentFactory = RNScreensFragmentFactory()
    // Edge-to-edge (edgeToEdgeEnabled=true in gradle.properties): React Native makes the status and navigation
    // bars transparent here, and the JS side pads content with the safe-area insets (Screen, AppHeader,
    // BottomSheet, tab bar).
    super.onCreate(savedInstanceState)
    if (isEdgeToEdgeFeatureFlagOn) {
      keepContentAboveKeyboard()
      applyNavigationBarAppearance(resources.configuration)
    }
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    // Called when the in-app appearance (System / Light / Dark) or the phone's dark mode changes.
    if (isEdgeToEdgeFeatureFlagOn) applyNavigationBarAppearance(newConfig)
  }

  /**
   * An edge-to-edge window is no longer shrunk for the keyboard (android:windowSoftInputMode="adjustResize" stops
   * resizing it), so text fields near the bottom would end up under the keyboard. Padding the React root by the
   * keyboard height restores the adjustResize behaviour the screens and their KeyboardAvoidingViews were built for.
   * The other insets are left to the JS side.
   */
  private fun keepContentAboveKeyboard() {
    val content = findViewById<View>(android.R.id.content) ?: return
    ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
      val keyboard = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
      if (view.paddingBottom != keyboard) {
        view.setPadding(view.paddingLeft, view.paddingTop, view.paddingRight, keyboard)
      }
      insets
    }
  }

  /**
   * Navigation-bar buttons / gesture handle: dark on the light theme, light on the dark theme. React Native sets this
   * once from the phone's setting; this follows the in-app choice too (ThemeProvider switches Android's night mode).
   * Status-bar icons are set from JS (<Screen> / <AppHeader> barStyle).
   */
  @Suppress("DEPRECATION") // Window.navigationBarColor, only used before Android 10
  private fun applyNavigationBarAppearance(config: Configuration) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val isDark =
        (config.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      // Before Android 10 there is no automatic contrast scrim: use a translucent bar in the theme's colour.
      window.navigationBarColor =
          if (isDark) Color.argb(0x80, 0x1b, 0x1b, 0x1b) else Color.argb(0xe6, 0xff, 0xff, 0xff)
    }
    WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightNavigationBars = !isDark
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "WorkNestMobile"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
