package `fun`.upup.musicfree.karaoke

import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.os.Build
import android.os.Process
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import kotlin.concurrent.thread

/**
 * 麦克风耳返（实时监听）
 *
 * 使用 AudioRecord 采集麦克风数据，按设定音量直接写入 AudioTrack 播放，
 * 实现 K 歌时的“耳返”效果。不做录音、不做评分。
 */
class KaraokeModule(context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {

    override fun getName() = "KaraokeAudio"

    private val recording = AtomicBoolean(false)
    private val volumePercent = AtomicInteger(60)

    private var worker: Thread? = null
    private var audioRecord: AudioRecord? = null
    private var audioTrack: AudioTrack? = null

    @ReactMethod
    fun isMicMonitoring(promise: Promise) {
        promise.resolve(recording.get())
    }

    @ReactMethod
    fun setMicVolume(value: Double, promise: Promise) {
        volumePercent.set(value.toInt().coerceIn(0, 100))
        promise.resolve(null)
    }

    @ReactMethod
    fun startMicMonitor(promise: Promise) {
        if (recording.get()) {
            promise.resolve(true)
            return
        }

        val granted = ContextCompat.checkSelfPermission(
            reactApplicationContext,
            Manifest.permission.RECORD_AUDIO,
        ) == PackageManager.PERMISSION_GRANTED
        if (!granted) {
            promise.resolve(false)
            return
        }

        try {
            startInternal()
            promise.resolve(true)
        } catch (e: Exception) {
            stopInternal()
            promise.reject("MIC_MONITOR_FAILED", e)
        }
    }

    @ReactMethod
    fun stopMicMonitor(promise: Promise) {
        try {
            stopInternal()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("MIC_MONITOR_STOP_FAILED", e)
        }
    }

    private fun startInternal() {
        val sampleRate = 44100
        val inChannel = AudioFormat.CHANNEL_IN_MONO
        val outChannel = AudioFormat.CHANNEL_OUT_MONO
        val encoding = AudioFormat.ENCODING_PCM_16BIT

        val recordMin = AudioRecord.getMinBufferSize(sampleRate, inChannel, encoding)
        val trackMin = AudioTrack.getMinBufferSize(sampleRate, outChannel, encoding)
        val bufferSize = maxOf(recordMin, trackMin, 2048) * 2

        val record = AudioRecord(
            MediaRecorder.AudioSource.VOICE_RECOGNITION,
            sampleRate,
            inChannel,
            encoding,
            bufferSize,
        )
        if (record.state != AudioRecord.STATE_INITIALIZED) {
            record.release()
            throw IllegalStateException("AudioRecord 初始化失败")
        }

        val trackBuilder = AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build(),
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setEncoding(encoding)
                    .setSampleRate(sampleRate)
                    .setChannelMask(outChannel)
                    .build(),
            )
            .setBufferSizeInBytes(bufferSize)
            .setTransferMode(AudioTrack.MODE_STREAM)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                trackBuilder.setPerformanceMode(
                    AudioTrack.PERFORMANCE_MODE_LOW_LATENCY,
                )
            } catch (_: Exception) {
                // 部分设备不支持，忽略
            }
        }

        val track = trackBuilder.build()

        audioRecord = record
        audioTrack = track
        recording.set(true)

        worker = thread(name = "MusicFreeMicMonitor") {
            Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_AUDIO)
            val shortBuffer = ShortArray(1024)
            try {
                track.play()
                record.startRecording()
                while (recording.get()) {
                    val read = record.read(shortBuffer, 0, shortBuffer.size)
                    if (read > 0) {
                        val gain = volumePercent.get() / 100f
                        for (i in 0 until read) {
                            shortBuffer[i] = (shortBuffer[i] * gain)
                                .toInt()
                                .coerceIn(-32768, 32767)
                                .toShort()
                        }
                        track.write(shortBuffer, 0, read)
                    } else if (read < 0) {
                        break
                    }
                }
            } catch (_: Exception) {
                // 忽略采集/播放异常
            } finally {
                try {
                    record.stop()
                } catch (_: Exception) {
                }
                try {
                    track.stop()
                } catch (_: Exception) {
                }
            }
        }
    }

    private fun stopInternal() {
        recording.set(false)
        try {
            audioRecord?.stop()
        } catch (_: Exception) {
        }
        worker?.let {
            try {
                it.join(600)
            } catch (_: Exception) {
            }
        }
        worker = null
        try {
            audioRecord?.release()
        } catch (_: Exception) {
        }
        try {
            audioTrack?.release()
        } catch (_: Exception) {
        }
        audioRecord = null
        audioTrack = null
    }

    override fun invalidate() {
        stopInternal()
        super.invalidate()
    }
}
