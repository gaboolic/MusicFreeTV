/**
 * TV 遥控器按键事件
 *
 * 原生 MainActivity 会拦截方向键/确认键，并通过 DeviceEventEmitter
 * 以 `MusicFreeTvKey` 事件转发到 JS（仅在电视设备上生效）。
 *
 * 注意：核心 react-native 并不包含 TVEventHandler，这里是自建方案。
 */
import { DeviceEventEmitter, EmitterSubscription } from "react-native";

export type TVKeyName = "UP" | "DOWN" | "LEFT" | "RIGHT" | "CENTER";

export interface ITVKeyEvent {
    key: TVKeyName;
    action: "down" | "up";
}

export const TV_KEY_EVENT_NAME = "MusicFreeTvKey";

export function addTVKeyListener(
    callback: (event: ITVKeyEvent) => void,
): EmitterSubscription {
    return DeviceEventEmitter.addListener(TV_KEY_EVENT_NAME, callback);
}
