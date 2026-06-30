import { createCard } from "./cards";
import { evaluatePokerHand } from "./poker";
import type { Card, PokerEvaluation, PokerHandType } from "./types";

export type SkillPreview = {
  cards: Card[];
  effect: string;
  evaluation: PokerEvaluation;
};

const previewHands: Array<{ cards: Card[]; effect: string; type: PokerHandType }> = [
  {
    type: "highCard",
    effect: "单体小伤害",
    cards: [createCard("7", "hearts"), createCard("9", "spades"), createCard("J", "diamonds"), createCard("Q", "clubs"), createCard("A", "hearts")],
  },
  {
    type: "pair",
    effect: "单体强化伤害",
    cards: [createCard("7", "hearts"), createCard("7", "spades"), createCard("9", "diamonds"), createCard("J", "clubs"), createCard("A", "hearts")],
  },
  {
    type: "twoPair",
    effect: "攻击前排 2 个",
    cards: [createCard("7", "hearts"), createCard("7", "spades"), createCard("9", "diamonds"), createCard("9", "clubs"), createCard("A", "hearts")],
  },
  {
    type: "threeKind",
    effect: "对最近目标连击",
    cards: [createCard("7", "hearts"), createCard("7", "spades"), createCard("7", "diamonds"), createCard("J", "clubs"), createCard("A", "hearts")],
  },
  {
    type: "straight",
    effect: "穿透攻击全体",
    cards: [createCard("7", "hearts"), createCard("8", "spades"), createCard("9", "diamonds"), createCard("10", "clubs"), createCard("J", "hearts")],
  },
  {
    type: "flush",
    effect: "范围攻击前排",
    cards: [createCard("7", "hearts"), createCard("9", "hearts"), createCard("J", "hearts"), createCard("Q", "hearts"), createCard("A", "hearts")],
  },
  {
    type: "fullHouse",
    effect: "高额单体爆发",
    cards: [createCard("7", "hearts"), createCard("7", "spades"), createCard("7", "diamonds"), createCard("9", "clubs"), createCard("9", "hearts")],
  },
  {
    type: "fourKind",
    effect: "超高单体爆发",
    cards: [createCard("7", "hearts"), createCard("7", "spades"), createCard("7", "diamonds"), createCard("7", "clubs"), createCard("A", "hearts")],
  },
  {
    type: "straightFlush",
    effect: "最强爆发",
    cards: [createCard("10", "hearts"), createCard("J", "hearts"), createCard("Q", "hearts"), createCard("K", "hearts"), createCard("A", "hearts")],
  },
];

export const SKILL_PREVIEWS: SkillPreview[] = previewHands.map(({ cards, effect, type }) => {
  const evaluation = evaluatePokerHand(cards);

  if (evaluation.type !== type) {
    throw new Error(`技能预览手牌配置错误：预期 ${type}，实际 ${evaluation.type}`);
  }

  return { cards, effect, evaluation };
});
