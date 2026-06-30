import { describe, expect, it } from "vitest";
import { createCard } from "./cards";
import { cardsToGainFromMatches, fillSkillSlots, pickCardsForSkillSlots } from "./skillSlots";
import type { BoardMatch } from "./types";

function match(cards: ReturnType<typeof createCard>[]): BoardMatch {
  return {
    id: cards.map((card) => card.id).join("-"),
    kind: "rank",
    cells: cards.map((card, index) => ({ x: index, y: 0, card })),
  };
}

describe("cardsToGainFromMatches", () => {
  it("scales card gain by match size and simultaneous groups", () => {
    expect(cardsToGainFromMatches([match([createCard("7", "hearts"), createCard("7", "spades"), createCard("7", "clubs")])])).toBe(1);
    expect(
      cardsToGainFromMatches([
        match([createCard("7", "hearts"), createCard("7", "spades"), createCard("7", "clubs"), createCard("7", "diamonds")]),
      ]),
    ).toBe(2);
    expect(
      cardsToGainFromMatches([
        match([
          createCard("7", "hearts"),
          createCard("7", "spades"),
          createCard("7", "clubs"),
          createCard("7", "diamonds"),
          createCard("8", "hearts"),
        ]),
      ]),
    ).toBe(3);
    expect(
      cardsToGainFromMatches([
        match([createCard("7", "hearts"), createCard("7", "spades"), createCard("7", "clubs")]),
        match([createCard("8", "hearts"), createCard("8", "spades"), createCard("8", "clubs")]),
      ]),
    ).toBe(3);
  });
});

describe("pickCardsForSkillSlots", () => {
  it("does not pick cards already in the skill slots", () => {
    const existing = [createCard("K", "hearts")];
    const picked = pickCardsForSkillSlots(
      [match([createCard("K", "hearts"), createCard("K", "spades"), createCard("K", "clubs")])],
      existing,
    );

    expect(picked).toHaveLength(1);
    expect(picked[0].id).not.toBe("hearts-K");
  });

  it("respects remaining slot capacity", () => {
    const existing = [
      createCard("7", "hearts"),
      createCard("8", "hearts"),
      createCard("9", "hearts"),
      createCard("10", "hearts"),
    ];
    const picked = pickCardsForSkillSlots(
      [
        match([
          createCard("K", "hearts"),
          createCard("K", "spades"),
          createCard("K", "clubs"),
          createCard("K", "diamonds"),
          createCard("Q", "clubs"),
        ]),
      ],
      existing,
    );

    expect(picked).toHaveLength(1);
  });
});

describe("fillSkillSlots", () => {
  it("keeps cards when the skill slots are not full yet", () => {
    const result = fillSkillSlots([createCard("7", "hearts")], [createCard("8", "spades")]);

    expect(result.readyCards).toBeNull();
    expect(result.slots.map((card) => card.id)).toEqual(["hearts-7", "spades-8"]);
  });

  it("returns ready cards and clears slots when five cards are collected", () => {
    const result = fillSkillSlots(
      [
        createCard("7", "hearts"),
        createCard("8", "spades"),
        createCard("9", "clubs"),
        createCard("10", "diamonds"),
      ],
      [createCard("J", "hearts")],
    );

    expect(result.slots).toEqual([]);
    expect(result.readyCards?.map((card) => card.rank)).toEqual(["7", "8", "9", "10", "J"]);
  });
});
