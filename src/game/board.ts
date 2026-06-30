import { randomCardFrom } from "./cards";
import { scoreCandidate } from "./poker";
import { RANKS, SUITS, type BoardCell, type BoardMatch, type Card, type MatchKind, type Rank, type Suit } from "./types";

export const BOARD_SIZE = 7;

export type BoardRules = {
  allowedMatchKinds?: readonly MatchKind[];
  ranks?: readonly Rank[];
  suits?: readonly Suit[];
};

const defaultBoardRules: Required<BoardRules> = {
  allowedMatchKinds: ["rank", "suit"],
  ranks: RANKS,
  suits: SUITS,
};

export function createBoard(rules: BoardRules = {}): BoardCell[][] {
  const resolvedRules = resolveBoardRules(rules);
  for (let guard = 0; guard < 100; guard += 1) {
    const board = createBoardWithoutImmediateMatches(resolvedRules);
    if (hasAvailableSwap(board, resolvedRules)) return board;
  }

  return createBoardWithoutImmediateMatches(resolvedRules);
}

export function findMatches(board: BoardCell[][], rules: BoardRules = {}): BoardMatch[] {
  const resolvedRules = resolveBoardRules(rules);
  const matches: BoardMatch[] = [];

  for (let y = 0; y < BOARD_SIZE; y += 1) {
    collectLineMatches(board[y], matches, resolvedRules.allowedMatchKinds);
  }

  for (let x = 0; x < BOARD_SIZE; x += 1) {
    collectLineMatches(
      Array.from({ length: BOARD_SIZE }, (_, y) => board[y][x]),
      matches,
      resolvedRules.allowedMatchKinds,
    );
  }

  return matches;
}

function collectLineMatches(line: BoardCell[], matches: BoardMatch[], allowedMatchKinds: readonly MatchKind[]): void {
  for (const kind of allowedMatchKinds) {
    collectRuns(line, kind, 3, matches);
  }
}

function collectRuns(
  line: BoardCell[],
  key: "rank" | "suit",
  minLength: number,
  matches: BoardMatch[],
): void {
  let runStart = 0;

  for (let index = 1; index <= line.length; index += 1) {
    const prev = line[index - 1];
    const current = line[index];
    const isSame = current && current.card[key] === prev.card[key];
    if (isSame) continue;

    const run = line.slice(runStart, index);
    if (run.length >= minLength) {
      matches.push({
        id: `${key}-${run.map((cell) => `${cell.x}-${cell.y}`).join("-")}`,
        kind: key,
        cells: run,
      });
    }
    runStart = index;
  }
}

function createBoardWithoutImmediateMatches(rules: Required<BoardRules>): BoardCell[][] {
  const board: BoardCell[][] = Array.from({ length: BOARD_SIZE }, () => []);

  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      let card = randomCardFrom(rules.ranks, rules.suits);
      let guard = 0;
      while (wouldCreateImmediateRun(board, x, y, card, rules.allowedMatchKinds) && guard < 100) {
        card = randomCardFrom(rules.ranks, rules.suits);
        guard += 1;
      }
      board[y][x] = { x, y, card };
    }
  }

  return board;
}

function wouldCreateImmediateRun(
  board: BoardCell[][],
  x: number,
  y: number,
  card: Card,
  allowedMatchKinds: readonly MatchKind[],
): boolean {
  return allowedMatchKinds.some((kind) => {
    const left1 = board[y]?.[x - 1]?.card;
    const left2 = board[y]?.[x - 2]?.card;
    const up1 = board[y - 1]?.[x]?.card;
    const up2 = board[y - 2]?.[x]?.card;

    return (left1?.[kind] === card[kind] && left2?.[kind] === card[kind]) || (up1?.[kind] === card[kind] && up2?.[kind] === card[kind]);
  });
}

type RefillOptions = {
  clearImmediateMatches?: boolean;
  ensurePlayableBoard?: boolean;
  rules?: BoardRules;
};

export function removeMatchesAndRefill(
  board: BoardCell[][],
  matches: BoardMatch[],
  options: RefillOptions = {},
): BoardCell[][] {
  const resolvedRules = resolveBoardRules(options.rules);
  const clearMatches = options.clearImmediateMatches ?? true;
  const shouldEnsurePlayable = options.ensurePlayableBoard ?? true;
  const removed = new Set(matches.flatMap((match) => match.cells.map((cell) => `${cell.x}-${cell.y}`)));
  if (removed.size === 0) return board;

  let next: BoardCell[][] = Array.from({ length: BOARD_SIZE }, (_, y) =>
    Array.from({ length: BOARD_SIZE }, (_, x) => ({ ...board[y][x] })),
  );

  for (let x = 0; x < BOARD_SIZE; x += 1) {
    const remaining: Card[] = [];
    for (let y = BOARD_SIZE - 1; y >= 0; y -= 1) {
      if (!removed.has(`${x}-${y}`)) {
        remaining.push(board[y][x].card);
      }
    }

    for (let y = BOARD_SIZE - 1; y >= 0; y -= 1) {
      const card = remaining.shift() ?? randomCardFrom(resolvedRules.ranks, resolvedRules.suits);
      next[y][x] = { x, y, card };
    }
  }

  if (clearMatches) {
    next = clearImmediateMatches(next, resolvedRules);
  }
  return shouldEnsurePlayable ? ensurePlayable(next, resolvedRules) : next;
}

function clearImmediateMatches(board: BoardCell[][], rules: Required<BoardRules>): BoardCell[][] {
  let next = board;
  let guard = 0;
  while (findMatches(next, rules).length > 0 && guard < 20) {
    const matches = findMatches(next, rules);
    const removed = new Set(matches.flatMap((match) => match.cells.map((cell) => `${cell.x}-${cell.y}`)));
    next = Array.from({ length: BOARD_SIZE }, (_, y) =>
      Array.from({ length: BOARD_SIZE }, (_, x) => ({
        x,
        y,
        card: removed.has(`${x}-${y}`) ? randomCardFrom(rules.ranks, rules.suits) : next[y][x].card,
      })),
    );
    guard += 1;
  }
  return next;
}

export function ensurePlayable(board: BoardCell[][], rules: BoardRules = {}): BoardCell[][] {
  const resolvedRules = resolveBoardRules(rules);
  let next = board;
  let guard = 0;
  while (!hasAvailableSwap(next, resolvedRules) && guard < 50) {
    next = createBoard(resolvedRules);
    guard += 1;
  }
  return next;
}

export function swapCells(board: BoardCell[][], first: BoardCell, second: BoardCell): BoardCell[][] {
  const next = Array.from({ length: BOARD_SIZE }, (_, y) =>
    Array.from({ length: BOARD_SIZE }, (_, x) => ({ ...board[y][x] })),
  );
  next[first.y][first.x] = { x: first.x, y: first.y, card: second.card };
  next[second.y][second.x] = { x: second.x, y: second.y, card: first.card };
  return next;
}

export function areAdjacent(first: BoardCell, second: BoardCell): boolean {
  return Math.abs(first.x - second.x) + Math.abs(first.y - second.y) === 1;
}

export function findMatchesAfterSwap(
  board: BoardCell[][],
  first: BoardCell,
  second: BoardCell,
  rules: BoardRules = {},
): { board: BoardCell[][]; matches: BoardMatch[] } {
  if (!areAdjacent(first, second)) return { board, matches: [] };
  const swapped = swapCells(board, first, second);
  return { board: swapped, matches: findMatches(swapped, rules) };
}

export function hasAvailableSwap(board: BoardCell[][], rules: BoardRules = {}): boolean {
  const resolvedRules = resolveBoardRules(rules);
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      const cell = board[y][x];
      const right = board[y][x + 1];
      const down = board[y + 1]?.[x];
      if (right && findMatchesAfterSwap(board, cell, right, resolvedRules).matches.length > 0) return true;
      if (down && findMatchesAfterSwap(board, cell, down, resolvedRules).matches.length > 0) return true;
    }
  }
  return false;
}

export function mergeMatches(matches: BoardMatch[]): BoardMatch {
  const map = new Map<string, BoardCell>();
  for (const match of matches) {
    for (const cell of match.cells) {
      map.set(`${cell.x}-${cell.y}`, cell);
    }
  }
  return {
    id: `swap-${[...map.keys()].join("-")}`,
    kind: matches[0]?.kind ?? "rank",
    cells: [...map.values()],
  };
}

export function recommendCard(cards: Card[], hand: Card[]): Card | null {
  const legal = cards.filter((card) => !hand.some((held) => held.id === card.id));
  if (legal.length === 0) return null;
  return legal.sort((a, b) => scoreCandidate(hand, b) - scoreCandidate(hand, a))[0];
}

function resolveBoardRules(rules: BoardRules = {}): Required<BoardRules> {
  return {
    allowedMatchKinds: rules.allowedMatchKinds ?? defaultBoardRules.allowedMatchKinds,
    ranks: rules.ranks ?? defaultBoardRules.ranks,
    suits: rules.suits ?? defaultBoardRules.suits,
  };
}
