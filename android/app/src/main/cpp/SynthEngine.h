#pragma once

#include <atomic>
#include <cstddef>
#include <cstdint>

// Forward-declare the TSF handle so this header stays free of the implementation.
struct tsf;

/**
 * SynthEngine — SF2 synthesis core (Phase 1), built on TinySoundFont (TSF).
 *
 * Threading contract (see CLAUDE.md §2):
 *  - The SoundFont is built off the audio thread in loadFromMemory() and then
 *    PUBLISHED to the audio thread via a single release-store of an atomic tsf*.
 *    render() does an acquire-load: it either sees a fully-built synth or nothing.
 *  - After publish, the `tsf` object is mutated ONLY on the audio thread, inside
 *    render(), by draining a lock-free SPSC event queue. JS-thread calls
 *    (noteOn/noteOff/setProgram) only enqueue events — they never touch `tsf`.
 *  - Master gain is a plain atomic applied while scaling the output buffer.
 *
 * This keeps the Oboe callback allocation/lock/JNI/log-free: TSF voices are
 * pre-reserved (tsf_set_max_voices) and channel 0 is initialised at load time,
 * so neither note-on nor program-change allocates on the audio thread.
 *
 * TSF is swappable for FluidSynth later behind this same surface (Decisions Log).
 */
class SynthEngine {
 public:
  SynthEngine() = default;
  ~SynthEngine();

  SynthEngine(const SynthEngine&) = delete;
  SynthEngine& operator=(const SynthEngine&) = delete;

  // --- Setup (call before the audio thread is busy; not realtime-safe) ---

  // Must be set before loadFromMemory() so TSF renders at the stream's rate.
  void setSampleRate(int sampleRate) { sampleRate_ = sampleRate; }

  // Parse + configure an SF2 from an in-memory buffer, then publish it to the
  // audio thread. Returns false if parsing failed. Intended to be called once
  // at startup. The buffer is not retained after this returns.
  bool loadFromMemory(const void* data, int size);

  bool isLoaded() const { return synth_.load(std::memory_order_acquire) != nullptr; }

  // --- Realtime control surface (JS thread; lock-free, never blocks) ---
  void noteOn(int key, float velocity);  // velocity 0..1
  void noteOff(int key);
  void setProgram(int presetNumber);
  void setSustain(bool on);
  void setMasterGain(float gain) {  // 0..1 (linear)
    masterGain_.store(gain, std::memory_order_relaxed);
  }
  // Ring-out: amp-envelope release (seconds) applied to each voice on note-off,
  // so "Ring time" controls the fade-out for any instrument. 0 = use the SF2's
  // own release. Plain atomic (read on the audio thread); not RT-critical to set.
  void setReleaseTime(float seconds) {
    releaseSec_.store(seconds, std::memory_order_relaxed);
  }

  // --- Audio thread ---
  // Render `numFrames` of interleaved stereo audio into `out`. `channelCount`
  // is the stream's channel count (expected 2). Drains pending events first.
  void render(float* out, int numFrames, int channelCount);

 private:
  enum class EventType : uint8_t { NoteOn, NoteOff, Program, Sustain };
  struct Event {
    EventType type;
    int i0;    // key / preset number
    float f0;  // velocity
  };

  // Single-producer (JS thread) / single-consumer (audio thread) ring buffer.
  static constexpr size_t kQueueCapacity = 1024;  // power of two
  static constexpr size_t kQueueMask = kQueueCapacity - 1;

  bool pushEvent(const Event& e);  // producer; drops if full
  void drainEvents(tsf* f);        // consumer (audio thread)

  std::atomic<tsf*> synth_{nullptr};
  std::atomic<float> masterGain_{1.0f};
  std::atomic<float> releaseSec_{0.0f};  // 0 = use the SF2 region's own release

  Event queue_[kQueueCapacity];
  std::atomic<size_t> head_{0};  // consumer index (audio thread)
  std::atomic<size_t> tail_{0};  // producer index (JS thread)

  int sampleRate_ = 48000;
};
