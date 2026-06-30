import { describe, expect, it } from "vitest";
import { createCard } from "./cards";
import { createBoard, findMatches, findMatchesAfterSwap, hasAvailableSwap, recommendCard, removeMatchesAndRefill } from "./board";
import type { BoardCell } from "./types";

function cell(x: number, y: number, rank: Parameters<typeof createCard>[0], suit: Parameters<typeof createCard>[1]): BoardCell {
  return { x, y, card: createCard(rank, suit) };
}

describe("findMatches", () => {
  it("allows same-rank three runs", () => {
    const board = baseBoard();
    board[0][0] = cell(0, 0, "K", "hearts");
    board[0][1] = cell(1, 0, "K", "spades");
    board[0][2] = cell(2, 0, "K", "diamonds");

    expect(findMatches(board).some((match) => match.kind === "rank" && match.cells.length >= 3)).toBe(true);
  });

  it("allows same-suit three runs", () => {
    const board = baseBoard();
    board[0][0] = cell(0, 0, "7", "hearts");
    board[0][1] = cell(1, 0, "8", "hearts");
    board[0][2] = cell(2, 0, "9", "hearts");

    expect(findMatches(board).some((match) => match.kind === "suit" && match.cells.length >= 3)).toBe(true);
  });

  it("can still detect same-suit matches on reduced-rank boards", () => {
    const board = baseBoard();
    board[0][0] = cell(0, 0, "7", "hearts");
    board[0][1] = cell(1, 0, "8", "hearts");
    board[0][2] = cell(2, 0, "9", "hearts");

    expect(findMatches(board, { ranks: ["7", "8", "9", "10", "J"] }).some((match) => match.kind === "suit")).toBe(true);
  });
});

describe("createBoard", () => {
  it("generates a playable board without immediate matches", () => {
    const board = createBoard();

    expect(findMatches(board)).toHaveLength(0);
    expect(hasAvailableSwap(board)).toBe(true);
  });
});

describe("swap matching", () => {
  it("finds matches created by swapping adjacent cards", () => {
    const board = baseBoard();
    board[0][0] = cell(0, 0, "K", "hearts");
    board[0][1] = cell(1, 0, "7", "spades");
    board[0][2] = cell(2, 0, "K", "diamonds");
    board[1][1] = cell(1, 1, "K", "clubs");

    expect(findMatches(board).some((match) => match.kind === "rank")).toBe(false);

    const result = findMatchesAfterSwap(board, board[0][1], board[1][1]);
    expect(result.matches.some((match) => match.kind === "rank" && match.cells.length >= 3)).toBe(true);
  });

  it("reports whether a board has at least one legal swap", () => {
    const board = baseBoard();
    board[0][0] = cell(0, 0, "K", "hearts");
    board[0][1] = cell(1, 0, "7", "spades");
    board[0][2] = cell(2, 0, "K", "diamonds");
    board[1][1] = cell(1, 1, "K", "clubs");

    expect(hasAvailableSwap(board)).toBe(true);
  });
});

describe("removeMatchesAndRefill", () => {
  it("can preserve immediate matches for cascade resolution", () => {
    const board = baseBoard();
    board[5][0] = cell(0, 5, "K", "hearts");
    board[5][1] = cell(1, 5, "K", "spades");
    board[5][2] = cell(2, 5, "K", "diamonds");

    const matches = [
      {
        id: "manual-bottom",
        kind: "rank" as const,
        cells: [board[6][0], board[6][1], board[6][2]],
      },
    ];

    const refilled = removeMatchesAndRefill(board, matches, {
      clearImmediateMatches: false,
      ensurePlayableBoard: false,
    });

    expect(findMatches(refilled).some((match) => match.kind === "rank" && match.cells.length >= 3)).toBe(true);
  });
});

function baseBoard(): BoardCell[][] {
  const ranks = ["7", "8", "9", "10", "J", "Q", "K"] as const;
  const suits = ["hearts", "spades", "diamonds", "clubs"] as const;
  return Array.from({ length: 7 }, (_, y) =>
    Array.from({ length: 7 }, (_, x) => cell(x, y, ranks[(x + y * 2) % ranks.length], suits[(x + y) % suits.length])),
  );
}

describe("recommendCard", () => {
  it("prefers a legal card that improves the current hand", () => {
    const hand = [createCard("K", "hearts")];
    const cards = [createCard("8", "clubs"), createCard("K", "spades"), createCard("Q", "diamonds")];

    expect(recommendCard(cards, hand)?.id).toBe("spades-K");
  });

  it("returns null when all candidates are exact duplicates", () => {
    const hand = [createCard("K", "hearts")];
    expect(recommendCard([createCard("K", "hearts")], hand)).toBeNull();
  });
});
