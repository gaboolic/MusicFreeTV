import Empty from "@/components/base/empty";
import Focusable from "@/components/base/focusable";
import Icon from "@/components/base/icon";
import ListItem from "@/components/base/listItem";
import ThemeText from "@/components/base/themeText";
import { showDialog } from "@/components/dialogs/useDialog";
import { showPanel } from "@/components/panels/usePanel";
import { ImgAsset } from "@/constants/assetsConst";
import { localPluginPlatform } from "@/constants/commonConst";
import { useI18N } from "@/core/i18n";
import MusicSheet, { useSheetsBase, useStarredSheets } from "@/core/musicSheet";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import useColors from "@/hooks/useColors";
import useFocusAutoScroll from "@/hooks/useFocusAutoScroll";
import rpx from "@/utils/rpx";
import Toast from "@/utils/toast";
import { FlashList } from "@shopify/flash-list";
import React, { useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

export default function Sheets() {
    const [index, setIndex] = useState(0);
    const colors = useColors();
    const navigate = useNavigate();

    const allSheets = useSheetsBase();
    const staredSheets = useStarredSheets();
    const { t } = useI18N();

    const listRef = useRef<FlashList<any>>(null);
    const containerRef = useRef<View>(null);
    const focusScroll = useFocusAutoScroll({
        scrollRef: listRef,
        containerRef,
    });

    const selectedTabTextStyle = useMemo(() => {
        return [
            styles.selectTabText,
            {
                borderBottomColor: colors.primary,
            },
        ];
    }, [colors]);

    return (
        <>
            <View style={styles.subTitleContainer}>
                <Focusable
                    accessibilityLabel={t("home.myPlaylistsCount.a11y", {
                        count: allSheets.length,
                    })}
                    onPress={() => {
                        setIndex(0);
                    }}
                    style={styles.tabContainer}
                    focusedStyle={styles.focusedTab}>
                    <ThemeText
                        fontSize="title"
                        style={[
                            styles.tabText,
                            index === 0 ? selectedTabTextStyle : null,
                        ]}>
                        {t("home.myPlaylists")}
                    </ThemeText>
                    <ThemeText
                        fontColor="textSecondary"
                        fontSize="subTitle"
                        style={styles.tabText}>
                        {" "}
                        ({allSheets.length})
                    </ThemeText>
                </Focusable>
                <Focusable
                    accessibilityLabel={t("home.starredPlaylistsCount.a11y", {
                        count: allSheets.length,
                    })}
                    onPress={() => {
                        setIndex(1);
                    }}
                    style={styles.tabContainer}
                    focusedStyle={styles.focusedTab}>
                    <ThemeText
                        fontSize="title"
                        style={[
                            styles.tabText,
                            index === 1 ? selectedTabTextStyle : null,
                        ]}>
                        {t("home.starredPlaylists")}
                    </ThemeText>
                    <ThemeText
                        fontColor="textSecondary"
                        fontSize="subTitle"
                        style={styles.tabText}>
                        {" "}
                        ({staredSheets.length})
                    </ThemeText>
                </Focusable>
                <View style={styles.more}>
                    <Focusable
                        accessibilityLabel={t("home.newPlaylist.a11y")}
                        onPress={() => {
                            showPanel("CreateMusicSheet");
                        }}
                        style={[styles.iconButton, styles.newSheetButton]}
                        focusedStyle={styles.focusedIconButton}>
                        <Icon name="plus" size={rpx(48)} color={colors.text} />
                    </Focusable>
                    <Focusable
                        accessibilityLabel={t("home.importPlaylist.a11y")}
                        onPress={() => {
                            showPanel("ImportMusicSheet");
                        }}
                        style={styles.iconButton}
                        focusedStyle={styles.focusedIconButton}>
                        <Icon
                            name="inbox-arrow-down"
                            size={rpx(48)}
                            color={colors.text}
                        />
                    </Focusable>
                </View>
            </View>
            <View style={styles.listContainer} ref={containerRef}>
                <FlashList
                    ref={listRef}
                    onScroll={focusScroll.onScroll}
                    ListEmptyComponent={<Empty />}
                    extraData={{ t }}
                    data={(index === 0 ? allSheets : staredSheets) ?? []}
                    estimatedItemSize={ListItem.Size.big}
                    renderItem={({ item: sheet }) => {
                        const isLocalSheet = !(
                            sheet.platform && sheet.platform !== localPluginPlatform
                        );

                        return (
                            <ListItem
                                key={`${sheet.id}`}
                                heightType="big"
                                withHorizontalPadding
                                onPress={() => {
                                    if (isLocalSheet) {
                                        navigate(ROUTE_PATH.LOCAL_SHEET_DETAIL, {
                                            id: sheet.id,
                                        });
                                    } else {
                                        navigate(ROUTE_PATH.PLUGIN_SHEET_DETAIL, {
                                            sheetInfo: sheet,
                                        });
                                    }
                                }}>
                                <ListItem.ListItemImage
                                    uri={sheet.coverImg ?? sheet.artwork}
                                    fallbackImg={ImgAsset.albumDefault}
                                    maskIcon={
                                        sheet.id === MusicSheet.defaultSheet.id
                                            ? "heart"
                                            : null
                                    }
                                />
                                <ListItem.Content
                                    title={sheet.title}
                                    description={
                                        isLocalSheet
                                            ? t("home.songCount", { count: sheet.worksNum })
                                            : `${sheet.artist ?? ""}`
                                    }
                                />
                                {sheet.id !== MusicSheet.defaultSheet.id ? (
                                    <ListItem.ListItemIcon
                                        position="right"
                                        icon="trash-outline"
                                        onPress={() => {
                                            showDialog("SimpleDialog", {
                                                title: t("dialog.deleteSheetTitle"),
                                                content: t("dialog.deleteSheetContent", {
                                                    name: sheet.title,
                                                }),
                                                onOk: async () => {
                                                    if (isLocalSheet) {
                                                        await MusicSheet.removeSheet(
                                                            sheet.id,
                                                        );
                                                        Toast.success(t("toast.deleteSuccess"));
                                                    } else {
                                                        await MusicSheet.unstarMusicSheet(
                                                            sheet,
                                                        );
                                                        Toast.success(t("toast.hasUnstarred"));
                                                    }
                                                },
                                            });
                                        }}
                                    />
                                ) : null}
                            </ListItem>
                        );
                    }}
                    nestedScrollEnabled
                />
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    subTitleContainer: {
        paddingHorizontal: rpx(24),
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: rpx(12),
    },
    listContainer: {
        flex: 1,
    },
    subTitleLeft: {
        flexDirection: "row",
    },
    tabContainer: {
        flexDirection: "row",
        marginRight: rpx(32),
        paddingHorizontal: rpx(8),
        borderWidth: 3,
        borderColor: "transparent",
        borderRadius: rpx(12),
    },
    focusedTab: {
        borderWidth: 3,
        borderColor: "#ffffff",
    },

    tabText: {
        lineHeight: rpx(64),
    },
    selectTabText: {
        borderBottomWidth: rpx(6),
        fontWeight: "bold",
    },
    more: {
        height: rpx(64),
        marginTop: rpx(3),
        flexGrow: 1,
        flexDirection: "row",
        justifyContent: "flex-end",
    },
    iconButton: {
        padding: rpx(8),
        borderRadius: rpx(12),
        borderWidth: 3,
        borderColor: "transparent",
    },
    focusedIconButton: {
        borderWidth: 3,
        borderColor: "#ffffff",
    },
    newSheetButton: {
        marginRight: rpx(24),
    },
});
