import { ROUTE_PATH } from "@/core/router";
import { useNavigation } from "@react-navigation/native";
import React from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import useColors from "@/hooks/useColors";
import ThemeText from "@/components/base/themeText";
import Color from "color";
import Icon from "@/components/base/icon.tsx";
import Focusable from "@/components/base/focusable";
import { useI18N } from "@/core/i18n";

// todo icon: = musicFree(引入自定义字体 居中) search
export default function NavBar() {
    const navigation = useNavigation<any>();
    const colors = useColors();
    const { t } = useI18N();

    return (
        <View style={styles.appbar}>
            <Focusable
                accessibilityLabel={t("home.openSidebar.a11y")}
                autoFocus
                onPress={() => {
                    navigation?.openDrawer();
                }}
                style={styles.iconButton}
                focusedStyle={styles.focusedButton}>
                <Icon name="bars-3" size={rpx(48)} color={colors.text} />
            </Focusable>

            <Focusable
                accessibilityLabel={t("home.clickToSearch")}
                onPress={() => {
                    navigation.navigate(ROUTE_PATH.SEARCH_PAGE);
                }}
                style={[
                    styles.searchBar,
                    {
                        backgroundColor: colors.placeholder,
                    },
                ]}
                focusedStyle={styles.focusedButton}>
                <Icon
                    accessible={false}
                    name="magnifying-glass"
                    size={rpx(32)}
                    color={Color(colors.text).alpha(0.6).toString()}
                />
                <ThemeText
                    accessible={false}
                    fontSize="subTitle"
                    style={[styles.text]}>
                    {t("home.clickToSearch")}
                </ThemeText>
            </Focusable>
        </View>
    );
}

const styles = StyleSheet.create({
    appbar: {
        backgroundColor: "transparent",
        shadowColor: "transparent",
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
        height: rpx(88),
    },
    searchBar: {
        marginHorizontal: rpx(24),
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
        height: "72%",
        maxHeight: rpx(64),
        borderRadius: rpx(36),
        paddingHorizontal: rpx(20),
        borderWidth: 3,
        borderColor: "transparent",
    },
    text: {
        marginLeft: rpx(12),
        opacity: 0.6,
    },
    iconButton: {
        marginLeft: rpx(24),
        padding: rpx(8),
        borderRadius: rpx(16),
        borderWidth: 3,
        borderColor: "transparent",
    },
    focusedButton: {
        borderColor: "#ffffff",
        borderWidth: 3,
        transform: [{ scale: 1.05 }],
    },
});
