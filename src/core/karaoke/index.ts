/**
 * K歌核心
 *
 * 轻量K歌的核心能力：
 * 1. 伴奏获取：优先复用现有插件音源搜索伴奏版本；找不到时可本地消除人声生成纯伴奏。
 * 2. 原唱 / 伴奏 / 纯伴奏 切换：通过 TrackPlayer 的临时音源覆盖实现，
 *    不改变“当前歌曲”，因此歌词、封面、歌词联动都不受影响。
 * 3. 麦克风耳返：调用原生 KaraokeAudio 做实时监听（不录音、不评分）。
 */
import { atom, getDefaultStore, useAtomValue } from "jotai";
import CryptoJs from "crypto-js";
import RNFS from "react-native-fs";
import { PERMISSIONS, RESULTS, check, request } from "react-native-permissions";

import { TrackPlayerEvents } from "@/core.defination/trackPlayer";
import NativeKaraoke from "@/native/karaoke";
import pathConst from "@/constants/pathConst";
import { checkAndCreateDir } from "@/utils/fileUtils";
import {
    getMediaExtraProperty,
    patchMediaExtra,
} from "@/utils/mediaExtra";
import { getLocalPath } from "@/utils/mediaUtils";
import Toast from "@/utils/toast";
import { errorLog } from "@/utils/log";
import {
    ACCOMPANIMENT_KEYWORDS,
    isAccompanimentCandidate,
    scoreAccompanimentCandidate,
} from "./accompaniment";
import type { IAppConfig } from "@/types/core/config";
import type { IPluginManager } from "@/types/core/pluginManager";
import type { ITrackPlayer } from "@/types/core/trackPlayer";

export type KaraokeMode = "original" | "accompaniment" | "instrumental";

export interface IAccompanimentState {
    loading: boolean;
    /** 伴奏来源：插件音源 or 本地生成 */
    source: "plugin" | "local" | null;
    error?: string;
}

const karaokeModeAtom = atom<KaraokeMode>("original");
const accompanimentStateAtom = atom<IAccompanimentState>({
    loading: false,
    source: null,
});
const micMonitorAtom = atom<boolean>(false);
const micVolumeAtom = atom<number>(60);
const generatingAtom = atom<{ generating: boolean; progress: number }>({
    generating: false,
    progress: 0,
});

/** 伴奏搜索超时（毫秒） */
const SEARCH_TIMEOUT = 8000;

function isLocalFile(path?: string) {
    return !!path && (path.startsWith("/") || path.startsWith("file://"));
}

function md5(text: string) {
    return CryptoJs.MD5(text).toString(CryptoJs.enc.Hex);
}

class KaraokeManager {
    private trackPlayer!: ITrackPlayer;
    private pluginManager!: IPluginManager;
    private appConfig!: IAppConfig;
    private inited = false;

    injectDependencies(
        trackPlayerService: ITrackPlayer,
        pluginManagerService: IPluginManager,
        appConfig: IAppConfig,
    ) {
        this.trackPlayer = trackPlayerService;
        this.pluginManager = pluginManagerService;
        this.appConfig = appConfig;
    }

    setup() {
        if (this.inited) {
            return;
        }
        this.inited = true;

        // 切换歌曲时，退出伴奏覆盖
        this.trackPlayer.on(TrackPlayerEvents.CurrentMusicChanged, () => {
            this.resetOnMusicChange();
        });

        // 恢复默认耳返音量
        const volume = this.appConfig.getConfig("karaoke.micVolume");
        if (typeof volume === "number") {
            getDefaultStore().set(micVolumeAtom, volume);
            NativeKaraoke.setMicVolume(volume).catch(() => { });
        }
    }

    get mode() {
        return getDefaultStore().get(karaokeModeAtom);
    }

    get accompanimentState() {
        return getDefaultStore().get(accompanimentStateAtom);
    }

    get micMonitoring() {
        return getDefaultStore().get(micMonitorAtom);
    }

    /** 切换歌曲时重置状态（不改动新歌的播放） */
    private resetOnMusicChange() {
        this.trackPlayer.clearPlaySourceOverride();
        if (getDefaultStore().get(karaokeModeAtom) !== "original") {
            getDefaultStore().set(karaokeModeAtom, "original");
        }
        getDefaultStore().set(accompanimentStateAtom, {
            loading: false,
            source: null,
        });
    }

    private setAccompanimentState(state: IAccompanimentState) {
        getDefaultStore().set(accompanimentStateAtom, state);
    }

    private setMode(mode: KaraokeMode) {
        getDefaultStore().set(karaokeModeAtom, mode);
    }

    /**
     * 搜索伴奏
     */
    async findAccompaniment(
        musicItem: IMusic.IMusicItem,
    ): Promise<IMusic.IMusicItem | null> {
        const title = musicItem.alias || musicItem.title;
        if (!title) {
            return null;
        }
        const artist = musicItem.artist ?? "";

        const plugins = this.pluginManager.getSearchablePlugins("music");
        const startTime = Date.now();

        let best: IMusic.IMusicItem | null = null;
        let bestScore = Infinity;

        for (const plugin of plugins) {
            if (Date.now() - startTime > SEARCH_TIMEOUT) {
                break;
            }
            for (const keyword of ACCOMPANIMENT_KEYWORDS) {
                const searchKey = `${title} ${artist} ${keyword}`.trim();
                const results = await plugin.methods
                    ?.search?.(searchKey, 1, "music")
                    .catch(() => null);
                const list = (results?.data ?? []).slice(0, 6);

                for (const item of list) {
                    const score = scoreAccompanimentCandidate(
                        item.title ?? "",
                        item.artist ?? "",
                        title,
                        artist,
                    );
                    if (score < bestScore) {
                        bestScore = score;
                        best = item;
                    }
                }
                if (bestScore <= 0.5) {
                    break;
                }
            }
            if (bestScore <= 0.5) {
                break;
            }
        }

        // 分数过高视为没找到
        return isAccompanimentCandidate(bestScore) ? best : null;
    }

    /**
     * 切换到伴奏（优先复用已绑定的伴奏，其次搜索插件音源）
     */
    async switchToAccompaniment(
        musicItem: IMusic.IMusicItem,
    ): Promise<boolean> {
        if (!musicItem) {
            return false;
        }

        this.setAccompanimentState({ loading: true, source: null });

        try {
            let accompaniment =
                getMediaExtraProperty(musicItem, "karaokeAccompaniment") ??
                null;

            if (!accompaniment) {
                const autoSearch =
                    this.appConfig.getConfig(
                        "karaoke.autoSearchAccompaniment",
                    ) !== false;
                if (autoSearch) {
                    accompaniment = await this.findAccompaniment(musicItem);
                }
            }

            if (!accompaniment) {
                this.setAccompanimentState({ loading: false, source: null });
                // 配置：找不到伴奏时自动本地消除人声
                if (this.appConfig.getConfig("karaoke.autoVocalRemoval")) {
                    return this.switchToInstrumental(musicItem);
                }
                return false;
            }

            const source = await this.resolvePluginSource(accompaniment);
            if (!source?.url) {
                this.setAccompanimentState({ loading: false, source: null });
                return false;
            }

            if (!this.trackPlayer.isCurrentMusic(musicItem)) {
                this.setAccompanimentState({ loading: false, source: null });
                return false;
            }

            const ok = await this.trackPlayer.setPlaySourceOverride({
                url: source.url,
                headers: source.headers,
            });
            if (!ok) {
                this.setAccompanimentState({ loading: false, source: null });
                return false;
            }

            // 缓存绑定关系，下次直接复用
            patchMediaExtra(musicItem, {
                karaokeAccompaniment: accompaniment,
            });
            this.setMode("accompaniment");
            this.setAccompanimentState({ loading: false, source: "plugin" });
            return true;
        } catch (e) {
            errorLog("切换伴奏失败", e);
            this.setAccompanimentState({ loading: false, source: null });
            return false;
        }
    }

    private async resolvePluginSource(item: IMusic.IMusicItem) {
        const plugin = this.pluginManager.getByMedia(item);
        const quality =
            this.appConfig.getConfig("basic.defaultPlayQuality") ?? "standard";
        const source = await plugin?.methods
            ?.getMediaSource?.(item, quality)
            .catch(() => null);
        return source ?? null;
    }

    /**
     * 切换为原唱
     */
    async switchToOriginal(): Promise<boolean> {
        const ok = await this.trackPlayer.setPlaySourceOverride(null);
        this.setMode("original");
        return ok;
    }

    /**
     * 切换为本地生成的纯伴奏
     */
    async switchToInstrumental(
        musicItem: IMusic.IMusicItem,
    ): Promise<boolean> {
        if (!musicItem) {
            return false;
        }

        let instrumentalPath = getMediaExtraProperty(
            musicItem,
            "karaokeInstrumentalPath",
        );
        if (instrumentalPath && !(await RNFS.exists(instrumentalPath))) {
            instrumentalPath = null;
        }

        if (!instrumentalPath) {
            instrumentalPath = await this.generateInstrumental(musicItem);
        }

        if (!instrumentalPath) {
            return false;
        }

        if (!this.trackPlayer.isCurrentMusic(musicItem)) {
            return false;
        }

        const ok = await this.trackPlayer.setPlaySourceOverride({
            url: `file://${instrumentalPath}`,
        });
        if (ok) {
            this.setMode("instrumental");
            this.setAccompanimentState({ loading: false, source: "local" });
        }
        return ok;
    }

    /**
     * 生成纯伴奏（本地人声消除）
     */
    async generateInstrumental(
        musicItem: IMusic.IMusicItem,
    ): Promise<string | null> {
        const generating = getDefaultStore().get(generatingAtom);
        if (generating.generating) {
            return null;
        }

        getDefaultStore().set(generatingAtom, {
            generating: true,
            progress: 0,
        });
        this.setAccompanimentState({ loading: true, source: null });

        const progressSubscription = NativeKaraoke.addVocalRemoveProgressListener(
            event => {
                getDefaultStore().set(generatingAtom, {
                    generating: true,
                    progress: Math.max(0, Math.min(100, event.progress ?? 0)),
                });
            },
        );

        try {
            await checkAndCreateDir(pathConst.karaokePath);

            const inputPath = await this.prepareLocalFile(musicItem);
            if (!inputPath) {
                Toast.warn("需要先下载该歌曲才能生成伴奏");
                return null;
            }

            const outputPath = `${pathConst.karaokePath}${md5(
                `${musicItem.platform}@${musicItem.id}`,
            )}.wav`;

            const result = await NativeKaraoke.removeVocal(
                inputPath,
                outputPath,
            );

            patchMediaExtra(musicItem, {
                karaokeInstrumentalPath: result,
            });

            Toast.success("伴奏生成成功");
            this.setAccompanimentState({ loading: false, source: "local" });
            return result;
        } catch (e) {
            errorLog("生成伴奏失败", e);
            Toast.warn("伴奏生成失败");
            this.setAccompanimentState({ loading: false, source: null });
            return null;
        } finally {
            progressSubscription?.remove();
            getDefaultStore().set(generatingAtom, {
                generating: false,
                progress: 0,
            });
        }
    }

    /**
     * 获取本地文件路径，若非本地则下载到缓存目录
     */
    private async prepareLocalFile(
        musicItem: IMusic.IMusicItem,
    ): Promise<string | null> {
        const localPath =
            getLocalPath(musicItem) ||
            getMediaExtraProperty(musicItem, "localPath") ||
            (isLocalFile(musicItem.url) ? musicItem.url! : null);

        if (localPath) {
            return localPath.replace("file://", "");
        }

        // 远程音频：优先使用当前歌曲 URL，否则通过插件解析音源
        let remoteUrl = musicItem.url;
        if (!remoteUrl) {
            remoteUrl =
                (await this.resolvePluginSource(musicItem))?.url ?? undefined;
        }
        if (!remoteUrl) {
            return null;
        }

        const cacheFile = `${pathConst.downloadCachePath}karaoke-${md5(
            `${musicItem.platform}@${musicItem.id}`,
        )}`;
        try {
            if (!(await RNFS.exists(cacheFile))) {
                await checkAndCreateDir(pathConst.downloadCachePath);
                const { promise } = RNFS.downloadFile({
                    fromUrl: remoteUrl,
                    toFile: cacheFile,
                });
                await promise;
            }
            return cacheFile;
        } catch (e) {
            errorLog("下载待处理音频失败", e);
            return null;
        }
    }

    /******** 麦克风耳返 ********/

    async toggleMicMonitor(): Promise<boolean> {
        if (getDefaultStore().get(micMonitorAtom)) {
            await NativeKaraoke.stopMicMonitor();
            getDefaultStore().set(micMonitorAtom, false);
            return false;
        }

        const granted = await this.ensureMicPermission();
        if (!granted) {
            Toast.warn("未获得麦克风权限");
            return false;
        }

        const started = await NativeKaraoke.startMicMonitor();
        getDefaultStore().set(micMonitorAtom, started);
        return started;
    }

    private async ensureMicPermission(): Promise<boolean> {
        try {
            const permission = PERMISSIONS.ANDROID.RECORD_AUDIO;
            const status = await check(permission);
            if (status === RESULTS.GRANTED) {
                return true;
            }
            const result = await request(permission);
            return result === RESULTS.GRANTED;
        } catch (e) {
            errorLog("麦克风权限申请失败", e);
            return false;
        }
    }

    async setMicVolume(volume: number) {
        const safeVolume = Math.max(0, Math.min(100, Math.round(volume)));
        getDefaultStore().set(micVolumeAtom, safeVolume);
        this.appConfig.setConfig("karaoke.micVolume", safeVolume);
        await NativeKaraoke.setMicVolume(safeVolume).catch(() => { });
    }

    async stopMicMonitor() {
        if (getDefaultStore().get(micMonitorAtom)) {
            await NativeKaraoke.stopMicMonitor().catch(() => { });
            getDefaultStore().set(micMonitorAtom, false);
        }
    }

    /** 进入K歌页时的初始化 */
    async onEnterKaraoke() {
        const musicItem = this.trackPlayer.currentMusic;
        if (!musicItem) {
            return;
        }
        if (this.appConfig.getConfig("karaoke.micMonitor")) {
            this.toggleMicMonitor().catch(() => { });
        }
        if (this.appConfig.getConfig("karaoke.defaultMode") === "accompaniment") {
            this.switchToAccompaniment(musicItem).catch(() => { });
        }
    }
}

const karaokeManager = new KaraokeManager();
export default karaokeManager;

export const useKaraokeMode = () => useAtomValue(karaokeModeAtom);
export const useAccompanimentState = () =>
    useAtomValue(accompanimentStateAtom);
export const useMicMonitoring = () => useAtomValue(micMonitorAtom);
export const useMicVolume = () => useAtomValue(micVolumeAtom);
export const useGenerating = () => useAtomValue(generatingAtom);
