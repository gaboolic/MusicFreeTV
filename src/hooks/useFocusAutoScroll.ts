import React, { useEffect, useRef } from "react";
import { addFocusMovedListener } from "@/core/tv/focusManager";

interface IScrollableLike {
    scrollToOffset?: (opts: { offset: number; animated?: boolean }) => void;
    scrollTo?: (opts: { y: number; animated?: boolean }) => void;
}

interface IOptions {
    /** 列表/滚动容器 ref（需要支持 scrollToOffset 或 scrollTo） */
    scrollRef: React.MutableRefObject<any>;
    /** 可见区域容器 ref（用于测量窗口位置） */
    containerRef: React.MutableRefObject<any>;
    /** 上下留白，默认 60 */
    padding?: number;
}

/**
 * TV 焦点自动滚动：
 * 当遥控器把焦点移动到可视区域之外的列表项时，自动滚动列表使其可见。
 * 需要把返回的 onScroll 绑定到列表的 onScroll 上以跟踪当前偏移。
 */
export default function useFocusAutoScroll(options: IOptions) {
    const { scrollRef, containerRef, padding = 60 } = options;
    const offsetRef = useRef(0);

    useEffect(() => {
        return addFocusMovedListener(node => {
            const container = containerRef.current;
            const scroll = scrollRef.current as IScrollableLike | null;
            if (!container || !scroll || node.rect.height <= 0) {
                return;
            }
            if (typeof container.measureInWindow !== "function") {
                return;
            }

            container.measureInWindow(
                (_x: number, y: number, _w: number, h: number) => {
                    if (!h) {
                        return;
                    }
                    const topEdge = y + padding;
                    const bottomEdge = y + h - padding;
                    const nodeTop = node.rect.y;
                    const nodeBottom = node.rect.y + node.rect.height;

                    let delta = 0;
                    if (nodeTop < topEdge) {
                        delta = nodeTop - topEdge;
                    } else if (nodeBottom > bottomEdge) {
                        delta = nodeBottom - bottomEdge;
                    }

                    if (delta !== 0) {
                        const target = Math.max(0, offsetRef.current + delta);
                        if (typeof scroll.scrollToOffset === "function") {
                            scroll.scrollToOffset({
                                offset: target,
                                animated: true,
                            });
                        } else if (typeof scroll.scrollTo === "function") {
                            scroll.scrollTo({ y: target, animated: true });
                        }
                        offsetRef.current = target;
                    }
                },
            );
        });
    }, [scrollRef, containerRef, padding]);

    return {
        onScroll: (event: any) => {
            offsetRef.current =
                event?.nativeEvent?.contentOffset?.y ?? offsetRef.current;
        },
    };
}
