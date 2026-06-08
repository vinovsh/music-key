#include "AudioEngine.h"

AudioEngine& AudioEngine::instance() {
  static AudioEngine engine;
  return engine;
}

AudioEngine::~AudioEngine() {
  stop();
}

bool AudioEngine::openStream() {
  oboe::AudioStreamBuilder builder;
  builder.setDirection(oboe::Direction::Output)
      ->setPerformanceMode(oboe::PerformanceMode::LowLatency)
      ->setSharingMode(oboe::SharingMode::Exclusive)
      ->setFormat(oboe::AudioFormat::Float)
      ->setChannelCount(oboe::ChannelCount::Stereo)
      ->setDataCallback(this)
      ->setErrorCallback(this);

  oboe::Result result = builder.openStream(stream_);
  if (result != oboe::Result::OK) {
    return false;
  }

  // Hand the actual device rate to the synth before any rendering happens.
  synth_.setSampleRate(stream_->getSampleRate());

  // Aim for low latency: 2 bursts. Oboe clamps to device capacity.
  stream_->setBufferSizeInFrames(stream_->getFramesPerBurst() * 2);
  return true;
}

bool AudioEngine::start() {
  std::lock_guard<std::mutex> lock(streamMutex_);
  if (!stream_) {
    if (!openStream()) {
      return false;
    }
  }
  return stream_->requestStart() == oboe::Result::OK;
}

void AudioEngine::stop() {
  std::lock_guard<std::mutex> lock(streamMutex_);
  if (stream_) {
    stream_->stop();
    stream_->close();
    stream_.reset();
  }
}

bool AudioEngine::loadSoundFont(const void* data, int size) {
  return synth_.loadFromMemory(data, size);
}

bool AudioEngine::startPcmRecording(const std::string& wavPath) {
  int sampleRate, channels;
  {
    std::lock_guard<std::mutex> lock(streamMutex_);
    if (!stream_) return false;
    sampleRate = stream_->getSampleRate();
    channels = stream_->getChannelCount();
  }
  return pcmRecorder_.start(wavPath, sampleRate, channels);
}

int64_t AudioEngine::stopPcmRecording() {
  return pcmRecorder_.stop();
}

oboe::DataCallbackResult AudioEngine::onAudioReady(
    oboe::AudioStream* stream,
    void* audioData,
    int32_t numFrames) {
  // REAL-TIME THREAD — see CLAUDE.md §2.
  const int channelCount = stream->getChannelCount();
  auto* out = static_cast<float*>(audioData);
  synth_.render(out, numFrames, channelCount);
  // Tap the rendered output for "REC As Sound" (lock-free; no-op when idle).
  pcmRecorder_.feed(out, numFrames, channelCount);
  return oboe::DataCallbackResult::Continue;
}

void AudioEngine::onErrorAfterClose(
    oboe::AudioStream* /*stream*/,
    oboe::Result /*error*/) {
  // Device disconnect / route change: Oboe already closed the stream. Reopen and
  // restart so playback survives e.g. plugging in headphones. The SynthEngine
  // (and its loaded SoundFont) is unaffected.
  std::lock_guard<std::mutex> lock(streamMutex_);
  stream_.reset();
  if (openStream()) {
    stream_->requestStart();
  }
}
