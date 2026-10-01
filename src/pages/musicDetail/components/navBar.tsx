import React from "react";
import { StyleSheet, Text, View } from "react-native";
import rpx from "@/utils/rpx";
import { useNavigation } from "@react-navigation/native";
import Tag from "@/components/base/tag";
import { fontSizeConst, fontWeightConst } from "@/constants/uiConst";
import Share from "react-native-share";
import { B64Asset } from "@/constants/assetsConst";
import IconButton from "@/components/base/iconButton";
import Icon from "@/components/base/icon.tsx";
import Focusable from "@/components/base/focusable";
import { useCurrentMusic } from "@/core/trackPlayer";
import { ROUTE_PATH } from "@/core/router";
import { useI18N } from "@/core/i18n";

export default function NavBar() {
    const navigation = useNavigation<any>();
    const musicItem = useCurrentMusic();
    const { t } = useI18N();
    // const {showShare} = useShare();

    return (
        <View style={styles.container}>
            <Focusable
                accessibilityLabel="back"
                onPress={() => {
                    navigation.goBack();
                }}
                style={[styles.button, styles.navIconButton]}
                focusedStyle={styles.focusedButton}>
                <Icon name="arrow-left" color="white" size={rpx(56)} />
            </Focusable>
            <View style={styles.headerContent}>
                <Text numberOfLines={1} style={styles.headerTitleText}>
                    {musicItem?.title ?? "--"}
                </Text>
                <View style={styles.headerDesc}>
                    <Text style={styles.headerArtistText} numberOfLines={1}>
                        {musicItem?.artist}
                    </Text>
                    {musicItem?.platform ? (
                        <Tag
                            tagName={musicItem.platform}
                            containerStyle={styles.tagBg}
                            style={styles.tagText}
                        />
                    ) : null}
                </View>
            </View>
            <Focusable
                accessibilityLabel={t("karaoke.entry")}
                onPress={() => {
                    navigation.navigate(ROUTE_PATH.KARAOKE);
                }}
                style={[styles.button, styles.karaokeButton]}
                focusedStyle={styles.focusedButton}>
                <Icon name="musical-note" color="white" size={rpx(56)} />
            </Focusable>
            <IconButton
                name="share"
                color="white"
                sizeType="normal"
                style={styles.button}
                onPress={async () => {
                    try {
                        await Share.open({
                            type: "image/jpeg",
                            title: "MusicFree-一个插件化的免费音乐播放器",
                            message: "MusicFree-一个插件化的免费音乐播放器",
                            url: B64Asset.share,
                            subject: "MusicFree分享",
                        });
                    } catch {}
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: "100%",
        height: rpx(150),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    button: {
        marginHorizontal: rpx(24),
    },
    karaokeButton: {
        paddingHorizontal: rpx(12),
        paddingVertical: rpx(8),
        borderRadius: rpx(16),
        borderWidth: 3,
        borderColor: "transparent",
    },
    navIconButton: {
        padding: rpx(8),
        borderRadius: rpx(16),
        borderWidth: 3,
        borderColor: "transparent",
    },
    focusedButton: {
        borderColor: "#ffffff",
        borderWidth: 3,
    },
    headerContent: {
        flex: 1,
        height: rpx(150),
        justifyContent: "center",
        alignItems: "center",
    },
    headerTitleText: {
        color: "white",
        fontWeight: fontWeightConst.semibold,
        fontSize: fontSizeConst.title,
        marginBottom: rpx(12),
        includeFontPadding: false,
    },
    headerDesc: {
        height: rpx(32),
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: rpx(40),
    },
    headerArtistText: {
        color: "white",
        fontSize: fontSizeConst.subTitle,
        includeFontPadding: false,
    },
    tagBg: {
        backgroundColor: "rgba(255, 255, 255, 0.2)",
    },
    tagText: {
        color: "white",
    },
});
