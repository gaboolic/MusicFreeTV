import repeatModeConst from "@/constants/repeatModeConst";
import rpx from "@/utils/rpx";
import React from "react";
import { InteractionManager, StyleSheet, View } from "react-native";

import Icon from "@/components/base/icon.tsx";
import Focusable from "@/components/base/focusable";
import { showPanel } from "@/components/panels/usePanel";
import TrackPlayer, { useMusicState, useRepeatMode } from "@/core/trackPlayer";
import useOrientation from "@/hooks/useOrientation";
import delay from "@/utils/delay";
import { musicIsPaused } from "@/utils/trackUtils";

const focusedStyle = {
    borderWidth: 3,
    borderColor: "#ffffff",
    borderRadius: rpx(48),
    transform: [{ scale: 1.08 }],
};

export default function () {
    const repeatMode = useRepeatMode();
    const musicState = useMusicState();

    const orientation = useOrientation();

    return (
        <>
            <View
                style={[
                    style.wrapper,
                    orientation === "horizontal"
                        ? {
                            marginTop: 0,
                        }
                        : null,
                ]}>
                <Focusable
                    onPress={() => {
                        InteractionManager.runAfterInteractions(async () => {
                            await delay(20, false);
                            TrackPlayer.toggleRepeatMode();
                        });
                    }}
                    style={style.iconButton}
                    focusedStyle={focusedStyle}>
                    <Icon
                        color={"white"}
                        name={repeatModeConst[repeatMode].icon}
                        size={rpx(56)}
                    />
                </Focusable>
                <Focusable
                    onPress={() => {
                        TrackPlayer.skipToPrevious();
                    }}
                    style={style.iconButton}
                    focusedStyle={focusedStyle}>
                    <Icon color={"white"} name={"skip-left"} size={rpx(56)} />
                </Focusable>
                <Focusable
                    autoFocus
                    onPress={() => {
                        if (musicIsPaused(musicState)) {
                            TrackPlayer.play();
                        } else {
                            TrackPlayer.pause();
                        }
                    }}
                    style={style.iconButton}
                    focusedStyle={focusedStyle}>
                    <Icon
                        color={"white"}
                        name={musicIsPaused(musicState) ? "play" : "pause"}
                        size={rpx(96)}
                    />
                </Focusable>
                <Focusable
                    onPress={() => {
                        TrackPlayer.skipToNext();
                    }}
                    style={style.iconButton}
                    focusedStyle={focusedStyle}>
                    <Icon color={"white"} name={"skip-right"} size={rpx(56)} />
                </Focusable>
                <Focusable
                    onPress={() => {
                        showPanel("PlayList");
                    }}
                    style={style.iconButton}
                    focusedStyle={focusedStyle}>
                    <Icon color={"white"} name={"playlist"} size={rpx(56)} />
                </Focusable>
            </View>
        </>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        marginTop: rpx(36),
        height: rpx(100),
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
    },
    iconButton: {
        padding: rpx(10),
        borderWidth: 3,
        borderColor: "transparent",
        borderRadius: rpx(48),
    },
});
