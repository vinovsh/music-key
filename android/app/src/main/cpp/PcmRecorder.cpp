#include "PcmRecorder.h"

#include <algorithm>
#include <chrono>
#include <cstring>
#include <vector>

namespace {

void writeLE32(std::FILE* f, uint32_t v) {
  uint8_t b[4] = {(uint8_t)(v), (uint8_t)(v >> 8), (uint8_t)(v >> 16), (uint8_t)(v >> 24)};
  std::fwrite(b, 1, 4, f);
}
void writeLE16(std::FILE* f, uint16_t v) {
  uint8_t b[2] = {(uint8_t)(v), (uint8_t)(v >> 8)};
  std::fwrite(b, 1, 2, f);
}

// 44-byte canonical WAV header for 16-bit PCM. Sizes patched on stop().
void writePlaceholderHeader(std::FILE* f, int sampleRate, int channels) {
  const uint16_t bitsPerSample = 16;
  const uint16_t blockAlign = (uint16_t)(channels * bitsPerSample / 8);
  const uint32_t byteRate = (uint32_t)(sampleRate * blockAlign);
  std::fwrite("RIFF", 1, 4, f);
  writeLE32(f, 0); // RIFF chunk size (patched)
  std::fwrite("WAVE", 1, 4, f);
  std::fwrite("fmt ", 1, 4, f);
  writeLE32(f, 16);              // fmt chunk size
  writeLE16(f, 1);              // PCM
  writeLE16(f, (uint16_t)channels);
  writeLE32(f, (uint32_t)sampleRate);
  writeLE32(f, byteRate);
  writeLE16(f, blockAlign);
  writeLE16(f, bitsPerSample);
  std::fwrite("data", 1, 4, f);
  writeLE32(f, 0); // data chunk size (patched)
}

inline int16_t floatToInt16(float s) {
  if (s > 1.0f) s = 1.0f;
  else if (s < -1.0f) s = -1.0f;
  return (int16_t)(s * 32767.0f);
}

}  // namespace

PcmRecorder::~PcmRecorder() {
  stop();
}

bool PcmRecorder::start(const std::string& wavPath, int sampleRate, int channels) {
  std::lock_guard<std::mutex> lock(lifecycleMutex_);
  if (active_.load(std::memory_order_acquire)) return false;

  file_ = std::fopen(wavPath.c_str(), "wb");
  if (!file_) return false;

  sampleRate_ = sampleRate;
  channels_ = channels;
  framesWritten_.store(0, std::memory_order_relaxed);
  writeIdx_.store(0, std::memory_order_relaxed);
  readIdx_.store(0, std::memory_order_relaxed);

  writePlaceholderHeader(file_, sampleRate_, channels_);

  active_.store(true, std::memory_order_release);
  writer_ = std::thread(&PcmRecorder::writerLoop, this);
  return true;
}

int64_t PcmRecorder::stop() {
  std::lock_guard<std::mutex> lock(lifecycleMutex_);
  if (!active_.load(std::memory_order_acquire) && !writer_.joinable()) {
    return 0;
  }
  active_.store(false, std::memory_order_release);
  if (writer_.joinable()) writer_.join();  // drains the ring before exiting

  const int64_t frames = framesWritten_.load(std::memory_order_relaxed);
  if (file_) {
    finalizeHeader(frames);
    std::fclose(file_);
    file_ = nullptr;
  }
  return frames;
}

void PcmRecorder::feed(const float* data, int numFrames, int channels) {
  // AUDIO THREAD. Lock-free; drop on overflow rather than block.
  if (!active_.load(std::memory_order_acquire)) return;

  const size_t n = (size_t)numFrames * (size_t)channels;
  const size_t w = writeIdx_.load(std::memory_order_relaxed);
  const size_t r = readIdx_.load(std::memory_order_acquire);
  const size_t free = kRingCapacity - (w - r);
  if (n > free) return;  // ring full this tick: drop (rare; ring is ~2.7s)

  for (size_t i = 0; i < n; ++i) {
    ring_[(w + i) & kRingMask] = data[i];
  }
  writeIdx_.store(w + n, std::memory_order_release);
}

void PcmRecorder::writerLoop() {
  // CONSUMER THREAD (not the audio thread): allocation/locks/IO are fine here.
  std::vector<int16_t> scratch;
  scratch.reserve(8192);

  while (true) {
    const size_t w = writeIdx_.load(std::memory_order_acquire);
    const size_t r = readIdx_.load(std::memory_order_relaxed);
    size_t avail = w - r;

    if (avail == 0) {
      if (!active_.load(std::memory_order_acquire)) break;  // stopped + drained
      std::this_thread::sleep_for(std::chrono::milliseconds(3));
      continue;
    }

    scratch.clear();
    for (size_t i = 0; i < avail; ++i) {
      scratch.push_back(floatToInt16(ring_[(r + i) & kRingMask]));
    }
    std::fwrite(scratch.data(), sizeof(int16_t), avail, file_);
    readIdx_.store(r + avail, std::memory_order_release);

    framesWritten_.fetch_add((int64_t)(avail / (size_t)channels_),
                             std::memory_order_relaxed);
  }
}

void PcmRecorder::finalizeHeader(int64_t framesWritten) {
  const uint32_t dataBytes = (uint32_t)(framesWritten * channels_ * 2);
  std::fseek(file_, 4, SEEK_SET);
  writeLE32(file_, 36 + dataBytes); // RIFF size
  std::fseek(file_, 40, SEEK_SET);
  writeLE32(file_, dataBytes);      // data size
  std::fflush(file_);
}
