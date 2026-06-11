#pragma once

#include <oboe/Oboe.h>
#include <oboe/LatencyTuner.h>

#include <cstdint>
#include <memory>
#include <mutex>
#include <string>

#include "PcmRecorder.h"
#include "SynthEngine.h"

/**
 * AudioEngine — process-wide singleton owning the Oboe output stream and the
 * SynthEngine. It is a singleton because two entry points drive it: the C++
 * TurboModule (JS-thread note/control calls) and the JNI startup bridge (Kotlin
 * loads the SoundFont from assets). Both talk to AudioEngine::instance().
 *
 * The Oboe callback (onAudioReady) just asks SynthEngine to render — it does NO
 * allocation, locks, JNI, or logging (CLAUDE.md §2).
 *
 * Lifecycle ordering: start() opens the stream (learning the device sample rate
 * and handing it to the synth) and is idempotent; load the SoundFont AFTER
 * start() so the synth renders at the correct rate.
 */
class AudioEngine : public oboe::AudioStreamDataCallback,
                    public oboe::AudioStreamErrorCallback {
 public:
  static AudioEngine& instance();

  // Open + start the Oboe stream. Idempotent and thread-safe (non-RT callers).
  bool start();
  void stop();

  // Called from the JNI startup bridge with the SF2 bytes from assets.
  bool loadSoundFont(const void* data, int size);

  // "REC As Sound": capture the rendered output to a 16-bit PCM WAV at `wavPath`.
  // startPcmRecording returns false if no stream is open; stopPcmRecording
  // returns the number of frames written (0 if not recording).
  bool startPcmRecording(const std::string& wavPath);
  int64_t stopPcmRecording();

  // Realtime control surface (forwarded to SynthEngine; lock-free).
  void noteOn(int key, float velocity) { synth_.noteOn(key, velocity); }
  void noteOff(int key) { synth_.noteOff(key); }
  void setProgram(int presetNumber) { synth_.setProgram(presetNumber); }
  void setSustain(bool on) { synth_.setSustain(on); }
  void allSoundOff() { synth_.allSoundOff(); }
  void setMasterGain(float gain) { synth_.setMasterGain(gain); }
  void setReleaseTime(float sec) { synth_.setReleaseTime(sec); }

  // oboe::AudioStreamDataCallback
  oboe::DataCallbackResult onAudioReady(
      oboe::AudioStream* stream,
      void* audioData,
      int32_t numFrames) override;

  // oboe::AudioStreamErrorCallback — device disconnect / route change.
  void onErrorAfterClose(oboe::AudioStream* stream, oboe::Result error)
      override;

 private:
  AudioEngine() = default;
  ~AudioEngine() override;
  AudioEngine(const AudioEngine&) = delete;
  AudioEngine& operator=(const AudioEngine&) = delete;

  bool openStream();  // assumes streamMutex_ held

  std::mutex streamMutex_;  // guards open/start/stop (never locked on RT thread)
  std::shared_ptr<oboe::AudioStream> stream_;
  // Adaptive buffer sizing: tune() runs in the audio callback and grows the
  // buffer (in burst steps) when underruns occur, so dense two-handed play with
  // long ring-out tails stops glitching, while latency stays minimal when idle.
  // Created/destroyed alongside the stream under streamMutex_ (no live callback).
  std::unique_ptr<oboe::LatencyTuner> latencyTuner_;
  SynthEngine synth_;
  PcmRecorder pcmRecorder_;
};
