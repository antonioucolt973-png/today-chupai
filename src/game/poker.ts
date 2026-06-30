import { rankValues } from "./cards";
import type { Card, PokerEvaluation, PokerHandType } from "./types";

const labels: Record<PokerHandType, string> = {
  straightFlush: "同花顺",
  fourKind: "四条",
  fullHouse: "葫芦",
  flush: "同花",
  straight: "顺子",
  threeKind: "三条",
  twoPair: "两对",
  pair: "一对",
  highCard: "高牌",
};

const powers: Record<PokerHandType, number> = {
  straightFlush: 9,
  fourKind: 8,
  fullHouse: 7,
  flush: 6,
  straight: 5,
  threeKind: 4,
  twoPair: 3,
  pair: 2,
  highCard: 1,
};

const multipliers: Record<PokerHandType, number> = {
  straightFlush: 12,
  fourKind: 7,
  fullHouse: 5,
  flush: 3.6,
  straight: 3.4,
  threeKind: 3,
  twoPair: 2,
  pair: 1.4,
  highCard: 1,
};

export function evaluatePokerHand(cards: Card[]): PokerEvaluation {
  const counts = new Map<string, number>();
  const suitCounts = new Map<string, number>();

  for (const card of cards) {
    counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
    suitCounts.set(card.suit, (suitCounts.get(card.suit) ?? 0) + 1);
  }

  const countValues = [...counts.values()].sort((a, b) => b - a);
  const isFive = cards.length === 5;
  const isFlush = isFive && suitCounts.size === 1;
  const isStraight = isFive && isConsecutive(cards);

  let type: PokerHandType = "highCard";

  if (isStraight && isFlush) type = "straightFlush";
  else if (countValues[0] === 4) type = "fourKind";
  else if (countValues[0] === 3 && countValues[1] === 2) type = "fullHouse";
  else if (isFlush) type = "flush";
  else if (isStraight) type = "straight";
  else if (countValues[0] === 3) type = "threeKind";
  else if (countValues[0] === 2 && countValues[1] === 2) type = "twoPair";
  else if (countValues[0] === 2) type = "pair";

  return {
    type,
    label: labels[type],
    power: powers[type],
    multiplier: multipliers[type],
  };
}

function isConsecutive(cards: Card[]): boolean {
  const values = [...new Set(cards.map((card) => rankValues[card.rank]))].sort((a, b) => a - b);
  if (values.length !== 5) return false;
  return values.every((value, index) => index === 0 || value === values[index - 1] + 1);
}

export function describePursuit(cards: Card[]): string {
  if (cards.length === 0) return "消除拿牌，开始构筑第一手";
  if (cards.length >= 5) return "手牌已满，准备出牌";

  const rankCounts = new Map<string, number>();
  const suitCounts = new Map<string, number>();
  for (const card of cards) {
    rankCounts.set(card.rank, (rankCounts.get(card.rank) ?? 0) + 1);
    suitCounts.set(card.suit, (suitCounts.get(card.suit) ?? 0) + 1);
  }

  const maxRank = Math.max(...rankCounts.values());
  const maxSuit = Math.max(...suitCounts.values());
  const straightGap = cards.length >= 2 ? straightMissingCount(cards) : null;

  if (maxRank === 2) return "已有一对，可追三条或两对";
  if (maxRank === 3) return "已有三条，可考虑直接爆发";
  if (maxSuit >= 3) return `差 ${5 - maxSuit} 张成同花`;
  if (straightGap !== null && straightGap <= 2) return `差 ${straightGap} 张成顺子`;
  return "先找对子、顺子或同花方向";
}

function straightMissingCount(cards: Card[]): number {
  const values = [...new Set(cards.map((card) => rankValues[card.rank]))];
  const starts = [7, 8, 9, 10];
  let best = 5;
  for (const start of starts) {
    const target = new Set([start, start + 1, start + 2, start + 3, start + 4]);
    const hits = values.filter((value) => target.has(value)).length;
    best = Math.min(best, 5 - hits);
  }
  return best;
}

export function scoreCandidate(hand: Card[], candidate: Card): number {
  const next = [...hand, candidate];
  const evalScore = evaluatePokerHand(next).power * 100;
  const rankMatches = hand.filter((card) => card.rank === candidate.rank).length * 20;
  const suitMatches = hand.filter((card) => card.suit === candidate.suit).length * 8;
  const straightNear = hand.some((card) => Math.abs(rankValues[card.rank] - rankValues[candidate.rank]) <= 2)
    ? 6
    : 0;
  return evalScore + rankMatches + suitMatches + straightNear;
}
