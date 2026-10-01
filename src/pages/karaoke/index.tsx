import React, { useCallback, useEffect } from "react";
import {
    Image,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Slider from "@react-native-community/slider";
import { useNavigation } from "@react-navigation/native";

import Focusable from "@/components/base/focusable";
import Icon from "@/components/base/icon";
import Lyric from "@/pages/musicDetail/components/content/lyric";
import karaokeManager, {
    type KaraokeMode,
    useAccompanimentState,
    useGenerating,
    useKaraokeMode,
    useMicMonitoring,
    useMicVolume,
} from "@/core/karaoke";
import { useCurrentMusic, useMusicState, useProgress } from "@/core/trackPlayer";
import TrackPlayer from "@/core/trackPlayer";
import { clearFocus } from "@/core/tv/focusManager";
import { useI18N } from "@/core/i18n";
import rpx from "@/utils/rpx";
import Toast from "@/utils/toast";
import { musicIsPaused } from "@/utils/trackUtils";

const WHITE = "#ffffff";
const WHITE_60 = "rgba(255,255,255,0.6)";
const WHITE_80 = "rgba(255,255,255,0.8)";

export default function Karaoke() {
    const navigation = useNavigation<any>();
    const musicItem = useCurrentMusic();
    const musicState = useMusicState();
    const mode = useKaraokeMode();
    const accompaniment = useAccompanimentState();
    const micMonitoring = useMicMonitoring();
    const micVolume = useMicVolume();
    const generating = useGenerating();
    const { t } = useI18N();
    const progress = useProgress();

    useEffect(() => {
        clearFocus();
        karaokeManager.onEnterKaraoke().catch(() => { });
        return () => {
            // 离开页面停止耳返，避免持续啸叫
            karaokeManager.stopMicMonitor().catch(() => { });
        };
    }, []);

    const handleMode = useCallback(
        async (target: KaraokeMode) => {
            if (!musicItem) {
                Toast.warn(t("karaoke.noMusic"));
                return;
            }
            if (target === "original") {
                if (mode !== "original") {
                    await karaokeManager.switchToOriginal();
                }
                return;
            }
            if (target === "accompaniment") {
                if (mode === "accompaniment") {
                    await karaokeManager.switchToOriginal();
                    return;
                }
                const ok = await karaokeManager.switchToAccompaniment(
                    musicItem,
                );
                if (!ok) {
                    Toast.warn(t("karaoke.accompaniment.notFound"));
                    return;
                }
                Toast.success(
                    karaokeManager.mode === "instrumental"
                        ? t("karaoke.accompaniment.generateSuccess")
                        : t("karaoke.accompaniment.found"),
                );
                return;
            }
            // instrumental
            if (mode === "instrumental") {
                await karaokeManager.switchToOriginal();
                return;
            }
            const ok = await karaokeManager.switchToInstrumental(musicItem);
            if (!ok && !generating.generating) {
                Toast.warn(t("karaoke.accompaniment.generateFail"));
            }
        },
        [musicItem, mode, t, generating.generating],
    );

    const togglePlay = useCallback(() => {
        if (musicIsPaused(musicState)) {
            TrackPlayer.play();
        } else {
            TrackPlayer.pause();
        }
    }, [musicState]);

    const adjustMicVolume = useCallback((delta: number) => {
        karaokeManager
            .setMicVolume(micVolume + delta)
            .catch(() => { });
    }, [micVolume]);

    const progressPercent =
        progress?.duration && progress.duration > 0
            ? Math.min(100, (progress.position / progress.duration) * 100)
            : 0;

    return (
        <View style={styles.root}>
            {musicItem?.artwork ? (
                <Image
                    blurRadius={40}
                    resizeMode="cover"
                    style={styles.background}
                    source={
                        typeof musicItem.artwork === "string"
                            ? { uri: musicItem.artwork }
                            : (musicItem.artwork as any)
                    }
                />
            ) : null}
            <View style={styles.dim} />

            <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
                {/* 顶栏 */}
                <View style={styles.navBar}>
                    <Focusable
                        autoFocus={!musicItem}
                        onPress={() => navigation.goBack()}
                        style={styles.iconButton}
                        focusedStyle={styles.focusedRound}>
                        <Icon name="arrow-left" color={WHITE} size={rpx(48)} />
                    </Focusable>
                    <View style={styles.navTitleWrap}>
                        <Text numberOfLines={1} style={styles.navTitle}>
                            {musicItem?.title ?? t("karaoke.title")}
                        </Text>
                        <Text numberOfLines={1} style={styles.navSubTitle}>
                            {musicItem?.artist ?? t("karaoke.noMusicHint")}
                        </Text>
                    </View>
                    <View style={styles.navRight}>
                        {accompaniment.loading ? (
                            <Text style={styles.hintText}>
                                {generating.generating
                                    ? t("karaoke.accompaniment.generating", {
                                        "0": Math.round(generating.progress),
                                    })
                                    : t("karaoke.accompaniment.searching")}
                            </Text>
                        ) : null}
                    </View>
                </View>

                {musicItem ? (
                    <>
                        {/* 歌词区 */}
                        <View style={styles.lyricWrap}>
                            <Lyric />
                        </View>

                        {/* 进度条 */}
                        <View style={styles.progressTrack}>
                            <View
                                style={[
                                    styles.progressBar,
                                    { width: `${progressPercent}%` },
                                ]}
                            />
                        </View>

                        {/* 控制区 */}
                        <View style={styles.controls}>
                            <View style={styles.controlRow}>
                                <ModeButton
                                    label={t("karaoke.mode.original")}
                                    active={mode === "original"}
                                    onPress={() => handleMode("original")}
                                />
                                <ModeButton
                                    label={t("karaoke.mode.accompaniment")}
                                    active={mode === "accompaniment"}
                                    onPress={() => handleMode("accompaniment")}
                                />
                                <ModeButton
                                    label={t("karaoke.mode.instrumental")}
                                    active={mode === "instrumental"}
                                    onPress={() => handleMode("instrumental")}
                                />
                            </View>

                            <View style={styles.playRow}>
                                <Focusable
                                    onPress={() => TrackPlayer.skipToPrevious()}
                                    style={styles.iconButton}
                                    focusedStyle={styles.focusedRound}>
                                    <Icon
                                        name="skip-left"
                                        color={WHITE}
                                        size={rpx(64)}
                                    />
                                </Focusable>
                                <Focusable
                                    autoFocus
                                    onPress={togglePlay}
                                    style={styles.playButton}
                                    focusedStyle={styles.focusedRound}>
                                    <Icon
                                        name={
                                            musicIsPaused(musicState)
                                                ? "play"
                                                : "pause"
                                        }
                                        color={WHITE}
                                        size={rpx(96)}
                                    />
                                </Focusable>
                                <Focusable
                                    onPress={() => TrackPlayer.skipToNext()}
                                    style={styles.iconButton}
                                    focusedStyle={styles.focusedRound}>
                                    <Icon
                                        name="skip-right"
                                        color={WHITE}
                                        size={rpx(64)}
                                    />
                                </Focusable>
                            </View>

                            {/* 耳返 */}
                            <View style={styles.micRow}>
                                <Focusable
                                    onPress={() => {
                                        karaokeManager
                                            .toggleMicMonitor()
                                            .then(on =>
                                                Toast.success(
                                                    on
                                                        ? t("karaoke.micMonitor.on")
                                                        : t("karaoke.micMonitor.off"),
                                                ),
                                            )
                                            .catch(() => { });
                                    }}
                                    style={[
                                        styles.micButton,
                                        micMonitoring && styles.micButtonOn,
                                    ]}
                                    focusedStyle={styles.focusedRound}>
                                    <Icon
                                        name={
                                            micMonitoring
                                                ? "musical-note"
                                                : "musical-note"
                                        }
                                        color={WHITE}
                                        size={rpx(36)}
                                    />
                                    <Text style={styles.micText}>
                                        {t("karaoke.micMonitor")}
                                    </Text>
                                </Focusable>
                                <Focusable
                                    onPress={() => adjustMicVolume(-10)}
                                    style={styles.micStepper}
                                    focusedStyle={styles.focusedRound}>
                                    <Icon name="minus" color={WHITE} size={rpx(32)} />
                                </Focusable>
                                <Slider
                                    style={styles.slider}
                                    minimumValue={0}
                                    maximumValue={100}
                                    step={1}
                                    value={micVolume}
                                    minimumTrackTintColor={WHITE}
                                    maximumTrackTintColor="rgba(255,255,255,0.3)"
                                    thumbTintColor={WHITE}
                                    onSlidingComplete={value =>
                                        karaokeManager
                                            .setMicVolume(value)
                                            .catch(() => { })
                                    }
                                />
                                <Focusable
                                    onPress={() => adjustMicVolume(10)}
                                    style={styles.micStepper}
                                    focusedStyle={styles.focusedRound}>
                                    <Icon name="plus" color={WHITE} size={rpx(32)} />
                                </Focusable>
                            </View>
                        </View>
                    </>
                ) : (
                    <View style={styles.emptyWrap}>
                        <Text style={styles.emptyTitle}>
                            {t("karaoke.noMusic")}
                        </Text>
                        <Text style={styles.emptyHint}>
                            {t("karaoke.noMusicHint")}
                        </Text>
                    </View>
                )}
            </SafeAreaView>
        </View>
    );
}

function ModeButton(props: {
    label: string;
    active: boolean;
    onPress: () => void;
}) {
    const { label, active, onPress } = props;
    return (
        <Focusable
            onPress={onPress}
            style={[styles.modeButton, active && styles.modeButtonActive]}
            focusedStyle={styles.focusedRound}>
            <Text
                style={[styles.modeText, active && styles.modeTextActive]}>
                {label}
            </Text>
        </Focusable>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: "#000000",
    },
    background: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.6,
    },
    dim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.55)",
    },
    safe: {
        flex: 1,
    },
    navBar: {
        height: rpx(96),
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: rpx(24),
    },
    navTitleWrap: {
        flex: 1,
        paddingHorizontal: rpx(16),
    },
    navTitle: {
        color: WHITE,
        fontSize: rpx(34),
        fontWeight: "600",
    },
    navSubTitle: {
        color: WHITE_60,
        fontSize: rpx(24),
        marginTop: rpx(4),
    },
    navRight: {
        minWidth: rpx(200),
        alignItems: "flex-end",
    },
    hintText: {
        color: WHITE_80,
        fontSize: rpx(24),
    },
    lyricWrap: {
        flex: 1,
    },
    progressTrack: {
        height: rpx(6),
        marginHorizontal: rpx(40),
        backgroundColor: "rgba(255,255,255,0.2)",
        borderRadius: rpx(3),
        overflow: "hidden",
    },
    progressBar: {
        height: "100%",
        backgroundColor: WHITE,
    },
    controls: {
        paddingHorizontal: rpx(40),
        paddingBottom: rpx(16),
        paddingTop: rpx(16),
    },
    controlRow: {
        flexDirection: "row",
        justifyContent: "center",
        marginBottom: rpx(16),
    },
    modeButton: {
        paddingHorizontal: rpx(40),
        paddingVertical: rpx(14),
        borderRadius: rpx(34),
        marginHorizontal: rpx(12),
        borderWidth: 3,
        borderColor: "transparent",
        backgroundColor: "rgba(255,255,255,0.12)",
    },
    modeButtonActive: {
        backgroundColor: WHITE,
    },
    modeText: {
        color: WHITE,
        fontSize: rpx(28),
    },
    modeTextActive: {
        color: "#000000",
        fontWeight: "600",
    },
    playRow: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: rpx(12),
    },
    iconButton: {
        padding: rpx(16),
        marginHorizontal: rpx(24),
        borderRadius: rpx(48),
    },
    playButton: {
        padding: rpx(16),
        marginHorizontal: rpx(24),
        borderRadius: rpx(64),
        borderWidth: 3,
        borderColor: "transparent",
    },
    micRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },
    micButton: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: rpx(24),
        paddingVertical: rpx(12),
        borderRadius: rpx(30),
        borderWidth: 3,
        borderColor: "transparent",
        backgroundColor: "rgba(255,255,255,0.12)",
        marginRight: rpx(20),
    },
    micButtonOn: {
        backgroundColor: "rgba(0,200,120,0.5)",
    },
    micText: {
        color: WHITE,
        fontSize: rpx(24),
        marginLeft: rpx(8),
    },
    micStepper: {
        padding: rpx(10),
        borderRadius: rpx(24),
    },
    slider: {
        width: rpx(280),
    },
    focusedRound: {
        borderColor: WHITE,
        borderWidth: 3,
        transform: [{ scale: 1.06 }],
    },
    emptyWrap: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    emptyTitle: {
        color: WHITE,
        fontSize: rpx(40),
        fontWeight: "600",
    },
    emptyHint: {
        color: WHITE_60,
        fontSize: rpx(28),
        marginTop: rpx(16),
    },
});
