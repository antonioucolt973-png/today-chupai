import type { BoardMatch, Card } from "./types";

export function cardsToGainFromMatches(matches: BoardMatch[]): number {
  if (matches.length === 0) return 0;

  const base = matches.reduce((total, match) => {
    if (match.cells.length >= 5) return total + 3;
    if (match.cells.length === 4) return total + 2;
    return total + 1;
  }, 0);
  const multiMatchBonus = Math.max(0, matches.length - 1);

  return Math.min(5, base + multiMatchBonus);
}

export function pickCardsForSkillSlots(matches: BoardMatch[], existingCards: Card[], slotLimit = 5): Card[] {
  const gainCount = Math.min(cardsToGainFromMatches(matches), Math.max(0, slotLimit - existingCards.length));
  if (gainCount <= 0) return [];

  const existingIds = new Set(existingCards.map((card) => card.id));
  const candidates = shuffle(
    matches.flatMap((match) => match.cells.map((cell) => cell.card)).filter((card) => !existingIds.has(card.id)),
  );

  const picked: Card[] = [];
  const pickedIds = new Set<string>();

  for (const card of candidates) {
    if (picked.length >= gainCount) break;
    if (pickedIds.has(card.id)) continue;
    picked.push(card);
    pickedIds.add(card.id);
  }

  return picked;
}

export function fillSkillSlots(
  existingCards: Card[],
  gainedCards: Card[],
  slotLimit = 5,
): { slots: Card[]; readyCards: Card[] | null } {
  const slots = [...existingCards, ...gainedCards].slice(0, slotLimit);

  return {
    slots: slots.length >= slotLimit ? [] : slots,
    readyCards: slots.length >= slotLimit ? slots : null,
  };
}

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}
