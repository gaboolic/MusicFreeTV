import React, {
    useCallback,
    useEffect,
    useRef,
} from "react";
import {
    Pressable,
    type PressableProps,
    type StyleProp,
    type ViewStyle,
} from "react-native";
import {
    focusNode,
    registerFocusNode,
    unregisterFocusNode,
    updateFocusRect,
    useIsFocused,
} from "@/core/tv/focusManager";

let idSeed = 0;

export interface IFocusableRenderState {
    focused: boolean;
    pressed: boolean;
}

export interface IFocusableProps
    extends Omit<PressableProps, "children" | "style" | "onPress"> {
    id?: string;
    style?: StyleProp<ViewStyle>;
    /** 聚焦时的样式，不传则使用默认高亮描边 */
    focusedStyle?: StyleProp<ViewStyle>;
    /** 进入页面时是否自动聚焦 */
    autoFocus?: boolean;
    /** 不可聚焦（例如禁用态） */
    disabledFocus?: boolean;
    onPress?: () => void;
    children?:
        | React.ReactNode
        | ((state: IFocusableRenderState) => React.ReactNode);
}

const defaultFocusedStyle: ViewStyle = {
    borderColor: "#ffffff",
    borderWidth: 3,
};

/**
 * 可聚焦控件
 *
 * - 手机端表现为普通 Pressable；
 * - 电视端会注册到焦点管理器，方向键移动、确认键触发 onPress，
 *   并显示聚焦高亮。
 */
export default function Focusable(props: IFocusableProps) {
    const {
        id,
        onPress,
        autoFocus,
        focusedStyle,
        disabledFocus,
        children,
        style,
        onLayout,
        onPressIn,
        ...rest
    } = props;

    const generatedId = useRef<string>();
    if (!generatedId.current) {
        generatedId.current = `focusable-${++idSeed}`;
    }
    const fid = id ?? generatedId.current!;
    const focused = useIsFocused(fid);
    const viewRef = useRef<any>(null);

    // 用 ref 保存回调，避免内联函数导致频繁重注册
    const pressRef = useRef(onPress);
    pressRef.current = onPress;

    const measure = useCallback(() => {
        const node = viewRef.current;
        if (node && typeof node.measureInWindow === "function") {
            node.measureInWindow((x: number, y: number, width: number, height: number) => {
                updateFocusRect(fid, { x, y, width, height });
            });
        }
    }, [fid]);

    useEffect(() => {
        registerFocusNode({
            id: fid,
            rect: { x: 0, y: 0, width: 0, height: 0 },
            disabled: disabledFocus,
            onPress: () => pressRef.current?.(),
        });

        const measureTimer = setTimeout(measure, 0);
        const autoFocusTimer = autoFocus
            ? setTimeout(() => focusNode(fid), 60)
            : undefined;

        return () => {
            clearTimeout(measureTimer);
            if (autoFocusTimer) {
                clearTimeout(autoFocusTimer);
            }
            unregisterFocusNode(fid);
        };
    }, [fid, disabledFocus, autoFocus, measure]);

    useEffect(() => {
        if (focused) {
            measure();
        }
    }, [focused, measure]);

    return (
        <Pressable
            {...(rest as any)}
            ref={viewRef}
            {...({ focusable: !disabledFocus } as any)}
            onLayout={event => {
                onLayout?.(event);
                requestAnimationFrame(measure);
            }}
            onPressIn={event => {
                // 触摸（含触摸遥控器）时同步焦点，保证高亮一致
                focusNode(fid);
                onPressIn?.(event);
            }}
            onPress={onPress}
            style={[
                style,
                focused ? focusedStyle ?? defaultFocusedStyle : null,
            ]}>
            {typeof children === "function"
                ? children({ focused, pressed: false })
                : children}
        </Pressable>
    );
}
