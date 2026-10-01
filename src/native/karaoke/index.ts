/**
 * K歌原生能力封装
 * - KaraokeAudio：麦克风耳返（实时监听）
 * - VocalRemover：本地人声消除（中置声道抵消）生成纯伴奏
 *
 * 原生实现在 android/app/src/main/java/fun/upup/musicfree/karaoke/。
 * 非 Android 或原生模块缺失时相关能力自动降级为空操作。
 */
import {
    DeviceEventEmitter,
    type EmitterSubscription,
    type NativeModule,
    NativeModules,
} from "react-native";

interface IKaraokeAudio extends NativeModule {
    /** 开始麦克风耳返，返回是否成功 */
    startMicMonitor: () => Promise<boolean>;
    /** 停止麦克风耳返 */
    stopMicMonitor: () => Promise<void>;
    /** 设置耳返音量 0 ~ 100 */
    setMicVolume: (volume: number) => Promise<void>;
    /** 当前是否在耳返 */
    isMicMonitoring: () => Promise<boolean>;
}

interface IVocalRemover extends NativeModule {
    /**
     * 对本地音频做人声消除，生成纯伴奏，resolve 输出文件路径。
     * 原生侧使用 Promise 风格。
     */
    removeVocal: (inputPath: string, outputPath: string) => Promise<string>;
}

const NativeKaraokeAudio: IKaraokeAudio | undefined =
    NativeModules.KaraokeAudio;
const NativeVocalRemover: IVocalRemover | undefined =
    NativeModules.VocalRemover;

export const isKaraokeNativeAvailable = !!NativeKaraokeAudio;
export const isVocalRemoverAvailable = !!NativeVocalRemover;

export const VOCAL_REMOVE_PROGRESS_EVENT = "VocalRemoverProgress";

export interface IVocalRemoveProgress {
    /** 0 ~ 100 */
    progress: number;
}

const NativeKaraoke = {
    startMicMonitor(): Promise<boolean> {
        if (!NativeKaraokeAudio) {
            return Promise.resolve(false);
        }
        return NativeKaraokeAudio.startMicMonitor();
    },
    stopMicMonitor(): Promise<void> {
        if (!NativeKaraokeAudio) {
            return Promise.resolve();
        }
        return NativeKaraokeAudio.stopMicMonitor();
    },
    setMicVolume(volume: number): Promise<void> {
        if (!NativeKaraokeAudio) {
            return Promise.resolve();
        }
        return NativeKaraokeAudio.setMicVolume(volume);
    },
    isMicMonitoring(): Promise<boolean> {
        if (!NativeKaraokeAudio) {
            return Promise.resolve(false);
        }
        return NativeKaraokeAudio.isMicMonitoring();
    },
    /**
     * 人声消除，resolve 输出文件路径
     */
    removeVocal(inputPath: string, outputPath: string): Promise<string> {
        if (!NativeVocalRemover) {
            return Promise.reject(new Error("VocalRemoverUnavailable"));
        }
        return NativeVocalRemover.removeVocal(inputPath, outputPath);
    },
    /**
     * 监听人声消除进度（原生通过 DeviceEventEmitter 发送）
     */
    addVocalRemoveProgressListener(
        callback: (event: IVocalRemoveProgress) => void,
    ): EmitterSubscription {
        return DeviceEventEmitter.addListener(
            VOCAL_REMOVE_PROGRESS_EVENT,
            callback,
        );
    },
};

export default NativeKaraoke;
