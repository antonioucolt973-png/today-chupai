import { describe, expect, it } from "vitest";
import { SKILL_PREVIEWS } from "./skillPreview";
import type { PokerHandType } from "./types";

describe("skill preview catalog", () => {
  it("provides one valid preview hand for every poker hand type", () => {
    const expectedTypes: PokerHandType[] = [
      "highCard",
      "pair",
      "twoPair",
      "threeKind",
      "straight",
      "flush",
      "fullHouse",
      "fourKind",
      "straightFlush",
    ];

    expect(SKILL_PREVIEWS.map((preview) => preview.evaluation.type)).toEqual(expectedTypes);
    expect(SKILL_PREVIEWS.every((preview) => preview.cards.length === 5)).toBe(true);
  });
});
