#pragma once

#include <atomic>
#include <cstdint>
#include <cstdio>
#include <mutex>
#include <string>
#include <thread>

/**
 * PcmRecorder — "REC As Sound": taps the synth's rendered PCM into a file.
 *
 * The audio thread calls feed() to push the just-rendered interleaved float
 * buffer into a lock-free SPSC ring (no allocation/locks/JNI/logging there —
 * CLAUDE.md §2). A separate writer thread drains the ring, converts to 16-bit
 * PCM, and writes a WAV file. On stop() the WAV header is finalised; a Kotlin
 * step then encodes the WAV to .m4a (AAC) and deletes the WAV.
 */
class PcmRecorder {
 public:
  PcmRecorder() = default;
  ~PcmRecorder();

  // Begin writing a 16-bit PCM WAV at `wavPath`. Non-RT (called from JS/JNI).
  bool start(const std::string& wavPath, int sampleRate, int channels);

  // Stop and finalise the WAV. Returns the number of frames written.
  int64_t stop();

  bool isActive() const { return active_.load(std::memory_order_acquire); }

  // AUDIO THREAD: push `numFrames * channels` interleaved floats. Lock-free,
  // never blocks; drops (counts) if the ring is momentarily full.
  void feed(const float* data, int numFrames, int channels);

 private:
  void writerLoop();
  void finalizeHeader(int64_t framesWritten);

  static constexpr size_t kRingCapacity = 1u << 19; // 524288 floats (power of two)
  static constexpr size_t kRingMask = kRingCapacity - 1;

  float ring_[kRingCapacity];
  std::atomic<size_t> writeIdx_{0}; // producer (audio thread)
  std::atomic<size_t> readIdx_{0};  // consumer (writer thread)

  std::atomic<bool> active_{false};
  std::thread writer_;
  std::mutex lifecycleMutex_; // guards start/stop (never on the audio thread)

  std::FILE* file_ = nullptr;
  int sampleRate_ = 48000;
  int channels_ = 2;
  std::atomic<int64_t> framesWritten_{0};
};
