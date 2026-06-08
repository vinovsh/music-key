#include "SynthEngine.h"

#include <android/log.h>
#include <cstring>

#define SYNTH_LOG(...) __android_log_print(ANDROID_LOG_INFO, "PianoSynth", __VA_ARGS__)

// TSF implementation lives in this single translation unit.
#define TSF_IMPLEMENTATION
#include "third_party/tsf.h"

namespace {
// Plenty of polyphony for 10 fingers + sustain tails; pre-reserved so the audio
// thread never reallocates voices.
constexpr int kMaxVoices = 64;
}  // namespace

SynthEngine::~SynthEngine() {
  tsf* f = synth_.exchange(nullptr, std::memory_order_acq_rel);
  if (f) {
    tsf_close(f);
  }
}

bool SynthEngine::loadFromMemory(const void* data, int size) {
  // Build + fully configure off the audio thread before publishing.
  tsf* f = tsf_load_memory(data, size);
  if (!f) {
    return false;
  }
  if (tsf_get_presetcount(f) <= 0) {
    tsf_close(f);
    return false;
  }

  tsf_set_output(f, TSF_STEREO_INTERLEAVED, sampleRate_, 0.0f /*gain dB*/);
  tsf_set_max_voices(f, kMaxVoices);  // pre-reserve voices (no RT realloc)
  // Initialise channel 0 (allocates the channels struct here, off the RT thread)
  // and select the first preset as the default instrument.
  tsf_channel_set_presetnumber(f, 0, 0, 0 /*not drums*/);
  tsf_channel_set_volume(f, 0, 1.0f);

  // Publish. Single-load model for Phase 1: assert nothing was loaded before.
  SYNTH_LOG("loadFromMemory ok: presets=%d sampleRate=%d size=%d",
            tsf_get_presetcount(f), sampleRate_, size);

  tsf* prev = synth_.exchange(f, std::memory_order_release);
  if (prev) {
    // Reload isn't supported yet (would need RCU vs the audio thread). Keep the
    // newly published one; safely close the old only because Phase 1 loads once
    // at startup before the stream is rendering audio in earnest.
    tsf_close(prev);
  }
  return true;
}

bool SynthEngine::pushEvent(const Event& e) {
  const size_t tail = tail_.load(std::memory_order_relaxed);
  const size_t head = head_.load(std::memory_order_acquire);
  if (tail - head >= kQueueCapacity) {
    return false;  // full: drop rather than block (never stall the JS thread)
  }
  queue_[tail & kQueueMask] = e;
  tail_.store(tail + 1, std::memory_order_release);
  return true;
}

void SynthEngine::drainEvents(tsf* f) {
  size_t head = head_.load(std::memory_order_relaxed);
  const size_t tail = tail_.load(std::memory_order_acquire);
  for (; head != tail; ++head) {
    const Event& e = queue_[head & kQueueMask];
    switch (e.type) {
      case EventType::NoteOn:
        tsf_channel_note_on(f, 0, e.i0, e.f0);
        break;
      case EventType::NoteOff:
        tsf_channel_note_off(f, 0, e.i0);
        break;
      case EventType::Program:
        tsf_channel_set_presetnumber(f, 0, e.i0, 0);
        break;
      case EventType::Sustain:
        tsf_channel_set_sustain(f, 0, e.i0);
        break;
    }
  }
  head_.store(head, std::memory_order_release);
}

void SynthEngine::noteOn(int key, float velocity) {
  pushEvent(Event{EventType::NoteOn, key, velocity});
}

void SynthEngine::noteOff(int key) {
  pushEvent(Event{EventType::NoteOff, key, 0.0f});
}

void SynthEngine::setProgram(int presetNumber) {
  pushEvent(Event{EventType::Program, presetNumber, 0.0f});
}

void SynthEngine::setSustain(bool on) {
  pushEvent(Event{EventType::Sustain, on ? 1 : 0, 0.0f});
}

void SynthEngine::render(float* out, int numFrames, int channelCount) {
  // REAL-TIME THREAD. No allocation, no locks, no JNI, no logging.
  tsf* f = synth_.load(std::memory_order_acquire);
  if (!f) {
    std::memset(out, 0, sizeof(float) * numFrames * channelCount);
    return;
  }

  drainEvents(f);

  // TSF is configured for interleaved stereo; the stream is opened as stereo.
  tsf_render_float(f, out, numFrames, 0 /*overwrite, not mixing*/);

  const float gain = masterGain_.load(std::memory_order_relaxed);
  if (gain != 1.0f) {
    const int n = numFrames * channelCount;
    for (int i = 0; i < n; ++i) {
      out[i] *= gain;
    }
  }
}
