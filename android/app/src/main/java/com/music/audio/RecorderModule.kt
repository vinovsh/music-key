package com.music.audio

import android.content.Intent
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.media.MediaMuxer
import android.media.MediaPlayer
import android.net.Uri
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * RecorderModule — JS-facing orchestration for "REC As Sound".
 *
 * Native C++ (via AudioEngineBridge JNI) captures the rendered PCM to a WAV;
 * this module encodes that WAV to .m4a (AAC) with MediaMuxer/MediaCodec, and
 * manages the resulting files (list / play / rename / delete / share).
 *
 * Mic permission is NOT required: we record the synth's own output, not the mic.
 */
class RecorderModule(private val ctx: ReactApplicationContext) :
  ReactContextBaseJavaModule(ctx) {

  override fun getName() = "RecorderModule"

  private var currentWav: File? = null
  private var player: MediaPlayer? = null

  private fun dir(): File =
    File(ctx.filesDir, "recordings").apply { if (!exists()) mkdirs() }

  // --- Recording ------------------------------------------------------------

  @ReactMethod
  fun startSoundRecording(promise: Promise) {
    try {
      val wav = File(dir(), "tmp_${System.currentTimeMillis()}.wav")
      if (!AudioEngineBridge.startPcmRecording(wav.absolutePath)) {
        promise.reject("E_START", "Audio stream not ready")
        return
      }
      currentWav = wav
      promise.resolve(null)
    } catch (t: Throwable) {
      promise.reject("E_START", t)
    }
  }

  @ReactMethod
  fun stopSoundRecording(promise: Promise) {
    try {
      AudioEngineBridge.stopPcmRecording()
      val wav = currentWav
      currentWav = null
      if (wav == null || !wav.exists()) {
        promise.reject("E_STOP", "No active recording")
        return
      }
      val m4a = File(dir(), "Recording_${System.currentTimeMillis()}.m4a")
      val durationMs = encodeWavToM4a(wav, m4a)
      wav.delete()
      promise.resolve(fileToMap(m4a, durationMs))
    } catch (t: Throwable) {
      promise.reject("E_STOP", t)
    }
  }

  // --- Library --------------------------------------------------------------

  @ReactMethod
  fun listRecordings(promise: Promise) {
    try {
      val arr: WritableArray = Arguments.createArray()
      dir().listFiles { f -> f.isFile && f.name.endsWith(".m4a") }
        ?.sortedByDescending { it.lastModified() }
        ?.forEach { f -> arr.pushMap(fileToMap(f, durationOf(f))) }
      promise.resolve(arr)
    } catch (t: Throwable) {
      promise.reject("E_LIST", t)
    }
  }

  @ReactMethod
  fun deleteRecording(path: String, promise: Promise) {
    try {
      stopInternal()
      File(path).delete()
      promise.resolve(null)
    } catch (t: Throwable) {
      promise.reject("E_DELETE", t)
    }
  }

  @ReactMethod
  fun renameRecording(path: String, newName: String, promise: Promise) {
    try {
      val src = File(path)
      val safe = newName.trim().ifEmpty { "Recording" }.replace(Regex("[^A-Za-z0-9 _-]"), "")
      val dst = File(src.parentFile, "$safe.m4a")
      if (src.renameTo(dst)) promise.resolve(dst.absolutePath)
      else promise.reject("E_RENAME", "Rename failed")
    } catch (t: Throwable) {
      promise.reject("E_RENAME", t)
    }
  }

  // --- Playback -------------------------------------------------------------

  @ReactMethod
  fun playRecording(path: String, promise: Promise) {
    try {
      stopInternal()
      player = MediaPlayer().apply {
        setDataSource(path)
        setOnCompletionListener { stopInternal() }
        prepare()
        start()
      }
      promise.resolve(null)
    } catch (t: Throwable) {
      promise.reject("E_PLAY", t)
    }
  }

  @ReactMethod
  fun stopPlayback(promise: Promise) {
    stopInternal()
    promise.resolve(null)
  }

  private fun stopInternal() {
    player?.run { try { if (isPlaying) stop() } catch (_: Throwable) {}; release() }
    player = null
  }

  // --- Share ----------------------------------------------------------------

  @ReactMethod
  fun shareRecording(path: String, promise: Promise) {
    try {
      val file = File(path)
      val uri: Uri = FileProvider.getUriForFile(ctx, "${ctx.packageName}.fileprovider", file)
      val intent = Intent(Intent.ACTION_SEND).apply {
        type = "audio/mp4"
        putExtra(Intent.EXTRA_STREAM, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      val chooser = Intent.createChooser(intent, "Share recording")
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      ctx.startActivity(chooser)
      promise.resolve(null)
    } catch (t: Throwable) {
      promise.reject("E_SHARE", t)
    }
  }

  // --- Helpers --------------------------------------------------------------

  private fun fileToMap(f: File, durationMs: Long) = Arguments.createMap().apply {
    putString("path", f.absolutePath)
    putString("name", f.nameWithoutExtension.replace('_', ' '))
    putDouble("durationMs", durationMs.toDouble())
    putDouble("createdAt", f.lastModified().toDouble())
    putDouble("size", f.length().toDouble())
  }

  private fun durationOf(f: File): Long {
    return try {
      val r = MediaMetadataRetriever()
      r.setDataSource(f.absolutePath)
      val d = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
      r.release()
      d
    } catch (_: Throwable) {
      0L
    }
  }

  /** Encode a 16-bit PCM WAV to AAC (.m4a). Returns duration in ms. */
  private fun encodeWavToM4a(wav: File, m4a: File): Long {
    val input = wav.inputStream().buffered()
    val header = ByteArray(44)
    if (input.read(header) != 44) { input.close(); throw IllegalStateException("Bad WAV") }
    val hb = ByteBuffer.wrap(header).order(ByteOrder.LITTLE_ENDIAN)
    val channels = hb.getShort(22).toInt()
    val sampleRate = hb.getInt(24)
    val dataSize = hb.getInt(40)
    val totalFrames = if (channels > 0) dataSize / (channels * 2) else 0
    val durationMs = if (sampleRate > 0) totalFrames * 1000L / sampleRate else 0L

    val format = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, sampleRate, channels).apply {
      setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
      setInteger(MediaFormat.KEY_BIT_RATE, 128_000)
      setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 16_384)
    }
    val codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC)
    codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
    codec.start()

    val muxer = MediaMuxer(m4a.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
    var trackIndex = -1
    var muxerStarted = false

    val info = MediaCodec.BufferInfo()
    val pcm = ByteArray(8192)
    var inputEos = false
    var outputEos = false
    var ptsUs = 0L

    while (!outputEos) {
      if (!inputEos) {
        val inIdx = codec.dequeueInputBuffer(10_000)
        if (inIdx >= 0) {
          val buf = codec.getInputBuffer(inIdx)!!
          buf.clear()
          val toRead = minOf(buf.capacity(), pcm.size)
          val read = input.read(pcm, 0, toRead)
          if (read < 0) {
            codec.queueInputBuffer(inIdx, 0, 0, ptsUs, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
            inputEos = true
          } else {
            buf.put(pcm, 0, read)
            codec.queueInputBuffer(inIdx, 0, read, ptsUs, 0)
            val frames = read / (channels * 2)
            ptsUs += frames * 1_000_000L / sampleRate
          }
        }
      }
      val outIdx = codec.dequeueOutputBuffer(info, 10_000)
      when {
        outIdx == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
          trackIndex = muxer.addTrack(codec.outputFormat)
          muxer.start(); muxerStarted = true
        }
        outIdx >= 0 -> {
          val outBuf = codec.getOutputBuffer(outIdx)!!
          if (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0) info.size = 0
          if (info.size > 0 && muxerStarted) {
            outBuf.position(info.offset)
            outBuf.limit(info.offset + info.size)
            muxer.writeSampleData(trackIndex, outBuf, info)
          }
          codec.releaseOutputBuffer(outIdx, false)
          if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) outputEos = true
        }
      }
    }

    input.close()
    codec.stop(); codec.release()
    try { muxer.stop() } catch (_: Throwable) {}
    muxer.release()
    return durationMs
  }

  override fun invalidate() {
    stopInternal()
    super.invalidate()
  }
}
