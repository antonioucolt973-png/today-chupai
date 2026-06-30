import { describe, expect, it } from "vitest";
import { createWave, resolveSkill } from "./combat";
import type { Monster, PokerEvaluation, PokerHandType } from "./types";

describe("createWave", () => {
  it("keeps the first two waves readable for new players", () => {
    const waveOne = createWave(1);
    const waveTwo = createWave(2);

    expect(waveOne).toHaveLength(3);
    expect(waveTwo).toHaveLength(4);
    expect(Math.max(...waveOne.map((monster) => monster.hp))).toBeLessThanOrEqual(8);
    expect(Math.max(...waveTwo.map((monster) => monster.hp))).toBeLessThanOrEqual(12);
    expect(Math.max(...waveTwo.map((monster) => monster.speed))).toBeLessThan(5);
  });
});

describe("resolveSkill", () => {
  it("uses visibly different targeting by poker hand type", () => {
    const monsters = testMonsters();

    expect(resolveSkill(monsters, evalHand("highCard"), []).targets).toHaveLength(1);
    expect(resolveSkill(monsters, evalHand("twoPair"), []).targets).toHaveLength(2);
    expect(resolveSkill(monsters, evalHand("fullHouse"), []).targets).toHaveLength(3);
    expect(resolveSkill(monsters, evalHand("fourKind"), []).targets).toHaveLength(4);
    expect(resolveSkill(monsters, evalHand("straightFlush"), []).targets).toHaveLength(4);
  });

  it("keeps three kind as repeated focused hits", () => {
    const monsters = testMonsters();
    const result = resolveSkill(monsters, evalHand("threeKind"), []);

    expect(result.targets).toHaveLength(1);
    expect(result.damage).toBe(42);
  });
});

function evalHand(type: PokerHandType): PokerEvaluation {
  const multipliers: Record<PokerHandType, number> = {
    highCard: 1,
    pair: 1.4,
    twoPair: 2,
    threeKind: 3,
    straight: 3.4,
    flush: 3.6,
    fullHouse: 5,
    fourKind: 7,
    straightFlush: 12,
  };

  return {
    type,
    label: type,
    power: 1,
    multiplier: multipliers[type],
  };
}

function testMonsters(): Monster[] {
  return [
    monster("a", 20, 12),
    monster("b", 35, 12),
    monster("c", 55, 12),
    monster("d", 75, 12),
  ];
}

function monster(id: string, x: number, hp: number): Monster {
  return {
    id,
    type: "burnout",
    name: id,
    hp,
    maxHp: hp,
    speed: 1,
    x,
  };
}
