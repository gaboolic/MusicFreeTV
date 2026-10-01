/**
 * TV 焦点管理
 *
 * 核心 React Native 不提供 Android TV 的遥控器焦点事件（这些能力在 react-native-tvos 分支里）。
 * 为了不替换整个 react-native 依赖，这里实现一套轻量的空间焦点导航：
 * - 原生侧（MainActivity）拦截方向键/确认键并通过 DeviceEventEmitter 转发到 JS；
 * - `Focusable` 组件把自身位置注册到本管理器；
 * - 收到方向键时按「主方向距离 + 垂直偏移」打分，选出最近的元素并聚焦。
 */
import { atom, getDefaultStore, useAtomValue } from "jotai";

export type FocusDirection = "up" | "down" | "left" | "right";

export interface IFocusRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface IFocusNode {
    id: string;
    rect: IFocusRect;
    order: number;
    disabled?: boolean;
    onPress?: () => void;
    onFocus?: () => void;
    onBlur?: () => void;
}

const nodeStore = new Map<string, IFocusNode>();
const focusedIdAtom = atom<string | null>(null);

let orderSeed = 0;

/** 焦点移动的监听（用于列表自动滚动等） */
type FocusMovedCallback = (node: IFocusNode) => void;
const movedCallbacks = new Set<FocusMovedCallback>();

export function addFocusMovedListener(cb: FocusMovedCallback) {
    movedCallbacks.add(cb);
    return () => {
        movedCallbacks.delete(cb);
    };
}

function emitFocusMoved(node: IFocusNode) {
    movedCallbacks.forEach(cb => {
        try {
            cb(node);
        } catch {
            // ignore
        }
    });
}

export function getFocusedId() {
    return getDefaultStore().get(focusedIdAtom);
}

function setFocusedId(id: string | null) {
    const store = getDefaultStore();
    const prev = store.get(focusedIdAtom);
    if (prev === id) {
        return;
    }
    if (prev) {
        nodeStore.get(prev)?.onBlur?.();
    }
    store.set(focusedIdAtom, id);
    if (id) {
        nodeStore.get(id)?.onFocus?.();
    }
}

/** 注册一个可聚焦元素 */
export function registerFocusNode(node: Omit<IFocusNode, "order">) {
    const existing = nodeStore.get(node.id);
    if (existing) {
        existing.rect = node.rect;
        existing.onPress = node.onPress;
        existing.onFocus = node.onFocus;
        existing.onBlur = node.onBlur;
        existing.disabled = node.disabled;
        return;
    }
    nodeStore.set(node.id, {
        ...node,
        order: ++orderSeed,
    });
}

/** 注销 */
export function unregisterFocusNode(id: string) {
    nodeStore.delete(id);
    if (getFocusedId() === id) {
        setFocusedId(null);
    }
}

export function updateFocusRect(id: string, rect: IFocusRect) {
    const node = nodeStore.get(id);
    if (node) {
        node.rect = rect;
    }
}

/** 聚焦指定元素 */
export function focusNode(id: string) {
    const node = nodeStore.get(id);
    if (!node || node.disabled) {
        return;
    }
    setFocusedId(id);
    emitFocusMoved(node);
}

/** 清空焦点 */
export function clearFocus() {
    setFocusedId(null);
}

/** 聚焦到第一个可用元素（按注册顺序） */
export function focusFirst() {
    const nodes = [...nodeStore.values()].filter(
        node => !node.disabled && node.rect.width > 0 && node.rect.height > 0,
    );
    if (!nodes.length) {
        return;
    }
    nodes.sort((a, b) => a.order - b.order);
    focusNode(nodes[0].id);
}

/** 执行当前聚焦元素的点击 */
export function pressFocused() {
    const id = getFocusedId();
    if (!id) {
        focusFirst();
        return;
    }
    const node = nodeStore.get(id);
    if (node && !node.disabled) {
        node.onPress?.();
    }
}

function center(rect: IFocusRect) {
    return {
        cx: rect.x + rect.width / 2,
        cy: rect.y + rect.height / 2,
    };
}

interface ICandidate {
    node: IFocusNode;
    primary: number;
    perp: number;
}

function candidatesInDirection(from: IFocusNode, dir: FocusDirection): ICandidate[] {
    const c = center(from.rect);
    const list: ICandidate[] = [];

    for (const node of nodeStore.values()) {
        if (node.id === from.id || node.disabled) {
            continue;
        }
        if (node.rect.width <= 0 || node.rect.height <= 0) {
            continue;
        }
        const t = center(node.rect);
        switch (dir) {
        case "left": {
            const primary = c.cx - t.cx;
            if (primary <= 1) {
                break;
            }
            list.push({ node, primary, perp: Math.abs(c.cy - t.cy) });
            break;
        }
        case "right": {
            const primary = t.cx - c.cx;
            if (primary <= 1) {
                break;
            }
            list.push({ node, primary, perp: Math.abs(c.cy - t.cy) });
            break;
        }
        case "up": {
            const primary = c.cy - t.cy;
            if (primary <= 1) {
                break;
            }
            list.push({ node, primary, perp: Math.abs(c.cx - t.cx) });
            break;
        }
        case "down": {
            const primary = t.cy - c.cy;
            if (primary <= 1) {
                break;
            }
            list.push({ node, primary, perp: Math.abs(c.cx - t.cx) });
            break;
        }
        }
    }

    return list;
}

/** 按方向移动焦点 */
export function moveFocus(dir: FocusDirection) {
    const currentId = getFocusedId();
    const current = currentId ? nodeStore.get(currentId) : undefined;
    if (!current) {
        focusFirst();
        return;
    }

    const candidates = candidatesInDirection(current, dir);
    if (!candidates.length) {
        return;
    }

    // 主方向越近越好，垂直偏移越小越好
    candidates.sort(
        (a, b) => a.primary + a.perp * 1.8 - (b.primary + b.perp * 1.8),
    );
    focusNode(candidates[0].node.id);
}

export function useFocusedId() {
    return useAtomValue(focusedIdAtom);
}

export function useIsFocused(id: string) {
    return useAtomValue(focusedIdAtom) === id;
}
