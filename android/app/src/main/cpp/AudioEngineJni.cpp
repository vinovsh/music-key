/*
 * JNI startup bridge for the audio engine.
 *
 * These are NOT on the audio hot-path — they run once at app startup (from
 * MainApplication) to start the Oboe stream and load the SoundFont straight from
 * the APK assets into the C++ engine. Note playback goes through the C++
 * TurboModule (JSI), not through here.
 */
#include <android/asset_manager.h>
#include <android/asset_manager_jni.h>
#include <jni.h>

#include "AudioEngine.h"

extern "C" JNIEXPORT void JNICALL
Java_com_music_audio_AudioEngineBridge_nativeStart(JNIEnv*, jobject) {
  AudioEngine::instance().start();
}

extern "C" JNIEXPORT jboolean JNICALL
Java_com_music_audio_AudioEngineBridge_nativeLoadSoundFontFromAsset(
    JNIEnv* env,
    jobject /*thiz*/,
    jobject assetManager,
    jstring assetPath) {
  AAssetManager* mgr = AAssetManager_fromJava(env, assetManager);
  if (mgr == nullptr) {
    return JNI_FALSE;
  }

  const char* path = env->GetStringUTFChars(assetPath, nullptr);
  AAsset* asset = AAssetManager_open(mgr, path, AASSET_MODE_BUFFER);
  env->ReleaseStringUTFChars(assetPath, path);
  if (asset == nullptr) {
    return JNI_FALSE;
  }

  const off_t length = AAsset_getLength(asset);
  const void* buffer = AAsset_getBuffer(asset);  // valid until AAsset_close
  bool ok = false;
  if (buffer != nullptr && length > 0) {
    // tsf_load_memory parses into its own structures; it does not retain buffer,
    // so closing the asset right after is safe.
    ok = AudioEngine::instance().loadSoundFont(buffer, static_cast<int>(length));
  }
  AAsset_close(asset);
  return ok ? JNI_TRUE : JNI_FALSE;
}

extern "C" JNIEXPORT jboolean JNICALL
Java_com_music_audio_AudioEngineBridge_nativeStartPcmRecording(
    JNIEnv* env,
    jobject /*thiz*/,
    jstring wavPath) {
  const char* path = env->GetStringUTFChars(wavPath, nullptr);
  bool ok = AudioEngine::instance().startPcmRecording(path);
  env->ReleaseStringUTFChars(wavPath, path);
  return ok ? JNI_TRUE : JNI_FALSE;
}

extern "C" JNIEXPORT jlong JNICALL
Java_com_music_audio_AudioEngineBridge_nativeStopPcmRecording(
    JNIEnv* /*env*/,
    jobject /*thiz*/) {
  return (jlong)AudioEngine::instance().stopPcmRecording();
}

// Lifecycle: release the Oboe stream when backgrounded / on focus loss, and
// rebuild it on resume. The loaded SoundFont survives (it lives in the engine).
extern "C" JNIEXPORT void JNICALL
Java_com_music_audio_AudioEngineBridge_nativePause(JNIEnv*, jobject) {
  AudioEngine::instance().stop();
}

extern "C" JNIEXPORT void JNICALL
Java_com_music_audio_AudioEngineBridge_nativeResume(JNIEnv*, jobject) {
  AudioEngine::instance().start();
}
