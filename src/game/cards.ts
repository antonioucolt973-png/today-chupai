import { RANKS, SUITS, type Card, type Rank, type Suit } from "./types";

export const suitLabels: Record<Suit, string> = {
  hearts: "♥",
  spades: "♠",
  diamonds: "♦",
  clubs: "♣",
};

export const suitNames: Record<Suit, string> = {
  hearts: "红桃",
  spades: "黑桃",
  diamonds: "方片",
  clubs: "梅花",
};

export const rankValues: Record<Rank, number> = {
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

export function createCard(rank: Rank, suit: Suit): Card {
  return {
    id: `${suit}-${rank}`,
    rank,
    suit,
  };
}

export function randomCard(): Card {
  return randomCardFrom();
}

export function randomCardFrom(ranks: readonly Rank[] = RANKS, suits: readonly Suit[] = SUITS): Card {
  const rank = ranks[Math.floor(Math.random() * ranks.length)];
  const suit = suits[Math.floor(Math.random() * suits.length)];
  return createCard(rank, suit);
}

export function cardLabel(card: Card): string {
  return `${suitLabels[card.suit]}${card.rank}`;
}
