import { describe, expect, it } from "vitest";
import { createCard } from "./cards";
import { evaluatePokerHand } from "./poker";

describe("evaluatePokerHand", () => {
  it("recognizes pair, two pair, and three kind", () => {
    expect(
      evaluatePokerHand([createCard("K", "hearts"), createCard("K", "spades")]).type,
    ).toBe("pair");

    expect(
      evaluatePokerHand([
        createCard("K", "hearts"),
        createCard("K", "spades"),
        createCard("Q", "hearts"),
        createCard("Q", "clubs"),
      ]).type,
    ).toBe("twoPair");

    expect(
      evaluatePokerHand([
        createCard("K", "hearts"),
        createCard("K", "spades"),
        createCard("K", "clubs"),
      ]).type,
    ).toBe("threeKind");
  });

  it("recognizes straight and flush only with five cards", () => {
    expect(
      evaluatePokerHand([
        createCard("7", "hearts"),
        createCard("8", "spades"),
        createCard("9", "clubs"),
        createCard("10", "diamonds"),
        createCard("J", "hearts"),
      ]).type,
    ).toBe("straight");

    expect(
      evaluatePokerHand([
        createCard("7", "hearts"),
        createCard("9", "hearts"),
        createCard("J", "hearts"),
        createCard("Q", "hearts"),
        createCard("A", "hearts"),
      ]).type,
    ).toBe("flush");

    expect(
      evaluatePokerHand([
        createCard("7", "hearts"),
        createCard("8", "hearts"),
        createCard("9", "hearts"),
        createCard("10", "hearts"),
        createCard("J", "hearts"),
      ]).type,
    ).toBe("straightFlush");
  });

  it("uses fixed priority when multiple hands are possible", () => {
    expect(
      evaluatePokerHand([
        createCard("7", "hearts"),
        createCard("8", "hearts"),
        createCard("9", "hearts"),
        createCard("10", "hearts"),
        createCard("J", "hearts"),
      ]).label,
    ).toBe("同花顺");
  });
});
