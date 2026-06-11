#include "NativeAudioEngine.h"

#include "AudioEngine.h"

namespace facebook::react {

NativeAudioEngine::NativeAudioEngine(std::shared_ptr<CallInvoker> jsInvoker)
    : NativeAudioEngineCxxSpec(std::move(jsInvoker)) {
  // Idempotent: the Kotlin startup bridge usually starts the stream first and
  // loads the SoundFont; this guarantees the engine is running even if JS
  // reaches the module before that path ran.
  AudioEngine::instance().start();
}

void NativeAudioEngine::noteOn(jsi::Runtime& /*rt*/, double pitch, double velocity) {
  AudioEngine::instance().noteOn(static_cast<int>(pitch), static_cast<float>(velocity));
}

void NativeAudioEngine::noteOff(jsi::Runtime& /*rt*/, double pitch) {
  AudioEngine::instance().noteOff(static_cast<int>(pitch));
}

void NativeAudioEngine::setMasterGain(jsi::Runtime& /*rt*/, double gain) {
  AudioEngine::instance().setMasterGain(static_cast<float>(gain));
}

void NativeAudioEngine::setProgram(jsi::Runtime& /*rt*/, double preset) {
  AudioEngine::instance().setProgram(static_cast<int>(preset));
}

void NativeAudioEngine::setSustain(jsi::Runtime& /*rt*/, bool on) {
  AudioEngine::instance().setSustain(on);
}

void NativeAudioEngine::setReleaseTime(jsi::Runtime& /*rt*/, double seconds) {
  AudioEngine::instance().setReleaseTime(static_cast<float>(seconds));
}

void NativeAudioEngine::allSoundOff(jsi::Runtime& /*rt*/) {
  AudioEngine::instance().allSoundOff();
}

} // namespace facebook::react
