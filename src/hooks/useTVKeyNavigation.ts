import { useEffect } from "react";
import { addTVKeyListener } from "@/native/tvEvent";
import {
    moveFocus,
    pressFocused,
} from "@/core/tv/focusManager";

/**
 * 监听遥控器方向键/确认键，驱动焦点移动。
 * 仅在电视设备上有按键事件，手机端不会触发。
 */
export default function useTVKeyNavigation(enabled = true) {
    useEffect(() => {
        if (!enabled) {
            return;
        }
        const subscription = addTVKeyListener(event => {
            if (event?.action !== "down") {
                return;
            }
            switch (event.key) {
            case "UP":
                moveFocus("up");
                break;
            case "DOWN":
                moveFocus("down");
                break;
            case "LEFT":
                moveFocus("left");
                break;
            case "RIGHT":
                moveFocus("right");
                break;
            case "CENTER":
                pressFocused();
                break;
            }
        });

        return () => {
            subscription.remove();
        };
    }, [enabled]);
}
