package `fun`.upup.musicfree.karaoke

import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.concurrent.thread

/**
 * 本地人声消除
 *
 * 对本地音频文件做中置声道抵消（out = L - R），生成纯伴奏 WAV。
 * 优点：无需联网/模型，速度快；缺点：对非居中的人声效果有限，
 * 属于“轻量 K 歌”的兜底方案。
 */
class VocalRemoverModule(context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {

    override fun getName() = "VocalRemover"

    @ReactMethod
    fun removeVocal(inputPath: String, outputPath: String, promise: Promise) {
        thread(name = "MusicFreeVocalRemover") {
            try {
                val normalizedInput = inputPath.removePrefix("file://")
                val result = process(normalizedInput, outputPath)
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("VOCAL_REMOVE_FAILED", e)
            }
        }
    }

    private fun process(inputPath: String, outputPath: String): String {
        val extractor = MediaExtractor()
        try {
            extractor.setDataSource(inputPath)

            var trackIndex = -1
            var inputFormat: MediaFormat? = null
            for (i in 0 until extractor.trackCount) {
                val format = extractor.getTrackFormat(i)
                val mime = format.getString(MediaFormat.KEY_MIME) ?: continue
                if (mime.startsWith("audio/")) {
                    trackIndex = i
                    inputFormat = format
                    break
                }
            }
            if (trackIndex < 0 || inputFormat == null) {
                throw IllegalArgumentException("未找到音频轨道")
            }
            extractor.selectTrack(trackIndex)

            val mime = inputFormat.getString(MediaFormat.KEY_MIME)!!
            val decoder = MediaCodec.createDecoderByType(mime)
            decoder.configure(inputFormat, null, null, 0)
            decoder.start()

            val outputFile = File(outputPath)
            outputFile.parentFile?.mkdirs()
            val raf = RandomAccessFile(outputFile, "rw")
            raf.setLength(0)
            raf.write(ByteArray(44)) // 预留 WAV 头

            var sampleRate = inputFormat.getIntSafe(MediaFormat.KEY_SAMPLE_RATE, 44100)
            var channelCount = inputFormat.getIntSafe(MediaFormat.KEY_CHANNEL_COUNT, 2)

            val durationUs = inputFormat.getLongSafe(MediaFormat.KEY_DURATION, 0L)

            val bufferInfo = MediaCodec.BufferInfo()
            var inputDone = false
            var outputDone = false
            var dataSize = 0L
            var lastProgress = -1

            while (!outputDone) {
                if (!inputDone) {
                    val inIndex = decoder.dequeueInputBuffer(10000)
                    if (inIndex >= 0) {
                        val inputBuffer = decoder.getInputBuffer(inIndex)
                        inputBuffer?.clear()
                        val sampleSize =
                            if (inputBuffer != null) extractor.readSampleData(inputBuffer, 0) else -1
                        if (sampleSize < 0) {
                            decoder.queueInputBuffer(
                                inIndex,
                                0,
                                0,
                                0,
                                MediaCodec.BUFFER_FLAG_END_OF_STREAM,
                            )
                            inputDone = true
                        } else {
                            decoder.queueInputBuffer(
                                inIndex,
                                0,
                                sampleSize,
                                extractor.sampleTime,
                                0,
                            )
                            extractor.advance()
                        }
                    }
                }

                val outIndex = decoder.dequeueOutputBuffer(bufferInfo, 10000)
                when {
                    outIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                        val outFormat = decoder.outputFormat
                        sampleRate = outFormat.getIntSafe(MediaFormat.KEY_SAMPLE_RATE, sampleRate)
                        channelCount = outFormat.getIntSafe(MediaFormat.KEY_CHANNEL_COUNT, channelCount)
                    }

                    outIndex >= 0 -> {
                        if (bufferInfo.size > 0) {
                            val outputBuffer = decoder.getOutputBuffer(outIndex)
                            if (outputBuffer != null) {
                                outputBuffer.position(bufferInfo.offset)
                                outputBuffer.limit(bufferInfo.offset + bufferInfo.size)
                                dataSize += processBuffer(outputBuffer, channelCount, raf)
                            }
                        }
                        decoder.releaseOutputBuffer(outIndex, false)

                        if (durationUs > 0) {
                            val progress = (
                                (bufferInfo.presentationTimeUs * 100 / durationUs)
                                    .toInt()
                                ).coerceIn(0, 100)
                            if (progress - lastProgress >= 2) {
                                lastProgress = progress
                                emitProgress(progress)
                            }
                        }

                        if ((bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
                            outputDone = true
                        }
                    }
                }
            }

            decoder.stop()
            decoder.release()

            writeWavHeader(
                raf,
                dataSize,
                sampleRate,
                if (channelCount >= 2) 2 else 1,
            )
            raf.close()

            emitProgress(100)
            return outputPath
        } finally {
            try {
                extractor.release()
            } catch (_: Exception) {
            }
        }
    }

    /**
     * 处理单个 PCM 输出缓冲：
     * 双声道做中置抵消 (L - R)，单声道直接透传。
     */
    private fun processBuffer(
        buffer: ByteBuffer,
        channelCount: Int,
        raf: RandomAccessFile,
    ): Long {
        buffer.order(ByteOrder.LITTLE_ENDIAN)
        val shortCount = buffer.remaining() / 2
        if (shortCount <= 0) {
            return 0
        }

        val shorts = ShortArray(shortCount)
        buffer.asShortBuffer().get(shorts)

        val outBytes: ByteArray
        if (channelCount >= 2) {
            val frames = shortCount / channelCount
            val outShorts = ShortArray(frames * 2)
            for (frame in 0 until frames) {
                val left = shorts[frame * channelCount].toInt()
                val right = shorts[frame * channelCount + 1].toInt()
                val value = ((left - right) * 0.9)
                    .toInt()
                    .coerceIn(-32768, 32767)
                    .toShort()
                outShorts[frame * 2] = value
                outShorts[frame * 2 + 1] = value
            }
            outBytes = ByteArray(outShorts.size * 2)
            ByteBuffer.wrap(outBytes)
                .order(ByteOrder.LITTLE_ENDIAN)
                .asShortBuffer()
                .put(outShorts)
        } else {
            outBytes = ByteArray(shortCount * 2)
            ByteBuffer.wrap(outBytes)
                .order(ByteOrder.LITTLE_ENDIAN)
                .asShortBuffer()
                .put(shorts)
        }

        raf.write(outBytes)
        return outBytes.size.toLong()
    }

    private fun writeWavHeader(
        raf: RandomAccessFile,
        dataSize: Long,
        sampleRate: Int,
        channels: Int,
    ) {
        val byteRate = sampleRate * channels * 2
        val header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN)
        header.put("RIFF".toByteArray(Charsets.US_ASCII))
        header.putInt((36 + dataSize).toInt())
        header.put("WAVE".toByteArray(Charsets.US_ASCII))
        header.put("fmt ".toByteArray(Charsets.US_ASCII))
        header.putInt(16)
        header.putShort(1.toShort()) // PCM
        header.putShort(channels.toShort())
        header.putInt(sampleRate)
        header.putInt(byteRate)
        header.putShort((channels * 2).toShort())
        header.putShort(16.toShort())
        header.put("data".toByteArray(Charsets.US_ASCII))
        header.putInt(dataSize.toInt())
        raf.seek(0)
        raf.write(header.array())
    }

    private fun MediaFormat.getIntSafe(key: String, defaultValue: Int): Int =
        try {
            getInteger(key)
        } catch (_: Exception) {
            defaultValue
        }

    private fun MediaFormat.getLongSafe(key: String, defaultValue: Long): Long =
        try {
            getLong(key)
        } catch (_: Exception) {
            defaultValue
        }

    private fun emitProgress(progress: Int) {
        try {
            val params = Arguments.createMap().apply {
                putInt("progress", progress)
            }
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("VocalRemoverProgress", params)
        } catch (_: Exception) {
        }
    }
}
