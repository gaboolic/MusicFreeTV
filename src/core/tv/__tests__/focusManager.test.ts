import {
    clearFocus,
    focusFirst,
    focusNode,
    getFocusedId,
    moveFocus,
    pressFocused,
    registerFocusNode,
    unregisterFocusNode,
} from "@/core/tv/focusManager";

const IDS = ["a", "b", "c", "d"];

function register(id: string, x: number, y: number, onPress?: () => void) {
    registerFocusNode({
        id,
        rect: { x, y, width: 100, height: 50 },
        onPress,
    });
}

/** 2x2 网格：a(左上) b(右上) c(左下) d(右下) */
function setupGrid() {
    register("a", 0, 0);
    register("b", 200, 0);
    register("c", 0, 120);
    register("d", 200, 120);
}

describe("focusManager", () => {
    beforeEach(() => {
        clearFocus();
        IDS.forEach(unregisterFocusNode);
    });

    afterEach(() => {
        clearFocus();
        IDS.forEach(unregisterFocusNode);
    });

    it("没有焦点时按方向键会聚焦第一个元素", () => {
        setupGrid();
        expect(getFocusedId()).toBeNull();
        moveFocus("right");
        expect(getFocusedId()).toBe("a");
    });

    it("focusFirst 按注册顺序聚焦", () => {
        setupGrid();
        focusFirst();
        expect(getFocusedId()).toBe("a");
    });

    it("在网格中按方向键做空间导航", () => {
        setupGrid();
        focusNode("a");
        expect(getFocusedId()).toBe("a");

        moveFocus("right");
        expect(getFocusedId()).toBe("b");

        moveFocus("down");
        expect(getFocusedId()).toBe("d");

        moveFocus("left");
        expect(getFocusedId()).toBe("c");

        moveFocus("up");
        expect(getFocusedId()).toBe("a");
    });

    it("边缘方向没有候选时保持当前焦点", () => {
        setupGrid();
        focusNode("a");
        moveFocus("left");
        expect(getFocusedId()).toBe("a");
        moveFocus("up");
        expect(getFocusedId()).toBe("a");
    });

    it("确认键触发已聚焦元素的 onPress", () => {
        const onPress = jest.fn();
        register("a", 0, 0, onPress);
        focusNode("a");
        pressFocused();
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("注销聚焦元素后焦点被清空", () => {
        setupGrid();
        focusNode("b");
        unregisterFocusNode("b");
        expect(getFocusedId()).toBeNull();
    });
});
