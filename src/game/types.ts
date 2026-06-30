export const RANKS = ["7", "8", "9", "10", "J", "Q", "K", "A"] as const;
export const SUITS = ["hearts", "spades", "diamonds", "clubs"] as const;

export type Rank = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];

export type Card = {
  id: string;
  rank: Rank;
  suit: Suit;
};

export type BoardCell = {
  x: number;
  y: number;
  card: Card;
};

export type MatchKind = "rank" | "suit";

export type BoardMatch = {
  id: string;
  kind: MatchKind;
  cells: BoardCell[];
};

export type PokerHandType =
  | "straightFlush"
  | "fourKind"
  | "fullHouse"
  | "flush"
  | "straight"
  | "threeKind"
  | "twoPair"
  | "pair"
  | "highCard";

export type PokerEvaluation = {
  type: PokerHandType;
  label: string;
  power: number;
  multiplier: number;
};

export type MonsterType = "burnout" | "urgent" | "blame" | "meeting";

export type Monster = {
  id: string;
  type: MonsterType;
  name: string;
  hp: number;
  maxHp: number;
  speed: number;
  x: number;
};

export type UpgradeId =
  | "pairBoost"
  | "twoPairExtra"
  | "threeExtra"
  | "straightBoost"
  | "flushRadius"
  | "keepOne"
  | "shieldOnEarly"
  | "healOnKill";

export type Upgrade = {
  id: UpgradeId;
  name: string;
  description: string;
};

export type FloatingText = {
  id: string;
  text: string;
  x: number;
  y: number;
};
