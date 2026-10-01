package `fun`.upup.musicfree
import expo.modules.ReactActivityDelegateWrapper
import expo.modules.splashscreen.SplashScreenManager

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

import android.content.res.Configuration
import android.os.Bundle
import android.view.KeyEvent

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "MusicFree"

  /** 是否运行在电视设备上 */
  private val isTV: Boolean by lazy {
    (resources.configuration.uiMode and Configuration.UI_MODE_TYPE_MASK) ==
      Configuration.UI_MODE_TYPE_TELEVISION
  }

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      ReactActivityDelegateWrapper(this, BuildConfig.IS_NEW_ARCHITECTURE_ENABLED, DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled))

  // https://reactnavigation.org/docs/getting-started/#installing-dependencies-into-a-bare-react-native-project
  override fun onCreate(savedInstanceState: Bundle?) {
      SplashScreenManager.registerOnActivity(this)
      super.onCreate(null);
  }

  /**
   * Android TV 遥控器焦点导航：把方向键/确认键转发给 JS 焦点管理器
   * （核心 react-native 不提供 TVEventHandler），并消费事件避免系统默认焦点行为。
   * 手机端不做任何处理。
   */
  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    if (isTV) {
      val keyName = when (event.keyCode) {
        KeyEvent.KEYCODE_DPAD_UP -> "UP"
        KeyEvent.KEYCODE_DPAD_DOWN -> "DOWN"
        KeyEvent.KEYCODE_DPAD_LEFT -> "LEFT"
        KeyEvent.KEYCODE_DPAD_RIGHT -> "RIGHT"
        KeyEvent.KEYCODE_DPAD_CENTER -> "CENTER"
        else -> null
      }
      if (keyName != null) {
        val action = if (event.action == KeyEvent.ACTION_DOWN) "down" else "up"
        emitTvKeyEvent(keyName, action)
        return true
      }
    }
    return super.dispatchKeyEvent(event)
  }

  private fun emitTvKeyEvent(key: String, action: String) {
    try {
      val reactContext =
        reactNativeHost.reactInstanceManager.currentReactContext ?: return
      val params = Arguments.createMap().apply {
        putString("key", key)
        putString("action", action)
      }
      reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("MusicFreeTvKey", params)
    } catch (_: Exception) {
      // React 上下文尚未就绪，忽略
    }
  }
}
