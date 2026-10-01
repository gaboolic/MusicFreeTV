import { useMemo } from "react";
import { Dimensions, Platform } from "react-native";

let cachedIsTV: boolean | null = null;

/** 是否运行在电视（Android TV / Leanback）上 */
export function isTV(): boolean {
    if (cachedIsTV === null) {
        try {
            cachedIsTV = !!Platform.isTV;
        } catch {
            cachedIsTV = false;
        }
    }
    return cachedIsTV;
}

/**
 * 电视/大屏适配尺寸：
 * 手机端沿用 rpx 逻辑，电视端按 1920x1080 设计基准放大，
 * 保证 10-foot UI 的控件足够大。
 */
export function useTVScale() {
    return useMemo(() => {
        const { width, height } = Dimensions.get("window");
        const minEdge = Math.min(width, height);
        const maxEdge = Math.max(width, height);
        return {
            isTV: isTV(),
            width,
            height,
            minEdge,
            maxEdge,
            /** 相对 750 设计稿的缩放系数 */
            scale: (isTV() ? maxEdge : minEdge) / 750,
        };
    }, []);
}

export default function useIsTV() {
    return isTV();
}
