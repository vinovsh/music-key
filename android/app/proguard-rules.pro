# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# --- App audio modules ------------------------------------------------------
# RecorderModule's @ReactMethod methods are invoked reflectively by React
# Native; keep the module + its bridge (and the JNI native methods they call).
-keep class com.music.audio.** { *; }
-keepclassmembers class com.music.audio.** {
    @com.facebook.react.bridge.ReactMethod <methods>;
    native <methods>;
}

# Keep names of any class with native methods (JNI lookups by name).
-keepclasseswithmembernames class * {
    native <methods>;
}

# Oboe (consumed via prefab; defensive keep).
-keep class com.google.oboe.** { *; }
-dontwarn com.google.oboe.**
