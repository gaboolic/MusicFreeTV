import {
    hasAccompanimentKeyword,
    isAccompanimentCandidate,
    scoreAccompanimentCandidate,
    stripAccompanimentKeyword,
} from "@/core/karaoke/accompaniment";

describe("accompaniment 伴奏匹配", () => {
    it("识别伴奏关键词", () => {
        expect(hasAccompanimentKeyword("告白气球 (伴奏)")).toBe(true);
        expect(hasAccompanimentKeyword("告白气球")).toBe(false);
        expect(hasAccompanimentKeyword("Song (Instrumental)")).toBe(true);
        expect(hasAccompanimentKeyword("夜曲 纯音乐")).toBe(true);
    });

    it("去除关键词与括号内容", () => {
        expect(stripAccompanimentKeyword("告白气球 (伴奏)")).toBe("告白气球");
        expect(stripAccompanimentKeyword("Song - Instrumental")).toBe("Song -");
    });

    it("完全匹配的伴奏得分低于阈值", () => {
        const score = scoreAccompanimentCandidate(
            "告白气球 (伴奏)",
            "周杰伦",
            "告白气球",
            "周杰伦",
        );
        expect(isAccompanimentCandidate(score)).toBe(true);
    });

    it("没有伴奏关键词的原曲会被淘汰", () => {
        const score = scoreAccompanimentCandidate(
            "告白气球",
            "周杰伦",
            "告白气球",
            "周杰伦",
        );
        expect(isAccompanimentCandidate(score)).toBe(false);
    });

    it("同名但不同歌手的伴奏仍可接受", () => {
        const score = scoreAccompanimentCandidate(
            "告白气球 伴奏",
            "某歌手",
            "告白气球",
            "周杰伦",
        );
        expect(isAccompanimentCandidate(score)).toBe(true);
    });

    it("完全无关的候选得分高于阈值", () => {
        const score = scoreAccompanimentCandidate(
            "完全不同的歌曲",
            "别人",
            "告白气球",
            "周杰伦",
        );
        expect(isAccompanimentCandidate(score)).toBe(false);
    });
});
