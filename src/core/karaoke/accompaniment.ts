/**
 * 伴奏匹配的纯逻辑（不依赖 React Native，便于单测）
 */
import minDistance from "@/utils/minDistance";

/** 伴奏关键词 */
export const ACCOMPANIMENT_KEYWORDS = [
    "伴奏",
    "纯伴奏",
    "纯音乐",
    "卡拉ok",
    "卡拉OK",
    "off vocal",
    "instrumental",
    "karaoke",
    "inst.",
];

/** 打分高于该阈值则认为不是伴奏 */
export const ACCOMPANIMENT_SCORE_THRESHOLD = 8;

export function stripAccompanimentKeyword(text?: string) {
    if (!text) {
        return "";
    }
    let result = text;
    for (const keyword of ACCOMPANIMENT_KEYWORDS) {
        result = result.replace(new RegExp(keyword, "gi"), "");
    }
    // 去掉括号及其内容，如 (伴奏) [Instrumental]
    result = result.replace(/[（(\[【][^）)\]】]*[）)\]】]/g, "");
    return result.replace(/\s+/g, " ").trim();
}

export function hasAccompanimentKeyword(text?: string) {
    if (!text) {
        return false;
    }
    const lower = text.toLowerCase();
    return ACCOMPANIMENT_KEYWORDS.some(keyword =>
        lower.includes(keyword.toLowerCase()),
    );
}

/**
 * 候选伴奏评分：分数越低越像目标歌曲的伴奏。
 * 不含任何伴奏关键词的候选会被加上惩罚分，通常直接超过阈值被淘汰。
 */
export function scoreAccompanimentCandidate(
    candidateTitle: string,
    candidateArtist: string,
    targetTitle: string,
    targetArtist: string,
): number {
    const matchKeyword = hasAccompanimentKeyword(candidateTitle);
    const titleDist = minDistance(
        stripAccompanimentKeyword(candidateTitle),
        targetTitle,
    );
    const artistDist = minDistance(candidateArtist ?? "", targetArtist ?? "");
    return (matchKeyword ? 0 : ACCOMPANIMENT_SCORE_THRESHOLD) +
        titleDist * 1.2 +
        artistDist;
}

/** 是否为可接受的伴奏候选 */
export function isAccompanimentCandidate(score: number): boolean {
    return score < ACCOMPANIMENT_SCORE_THRESHOLD;
}
