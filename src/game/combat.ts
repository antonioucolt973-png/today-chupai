import type { Monster, MonsterType, PokerEvaluation, Upgrade, UpgradeId } from "./types";

export const BASE_DAMAGE = 14;

const monsterConfig: Record<MonsterType, Omit<Monster, "id" | "x">> = {
  burnout: { type: "burnout", name: "内耗怪", hp: 10, maxHp: 10, speed: 100 / 18 },
  urgent: { type: "urgent", name: "催活怪", hp: 8, maxHp: 8, speed: 100 / 12 },
  blame: { type: "blame", name: "甩锅怪", hp: 24, maxHp: 24, speed: 100 / 22 },
  meeting: { type: "meeting", name: "会议怪", hp: 16, maxHp: 16, speed: 100 / 18 },
};

export const upgradePool: Upgrade[] = [
  { id: "pairBoost", name: "找到搭子", description: "一对伤害 +30%" },
  { id: "twoPairExtra", name: "双倍甩锅", description: "两对额外攻击 1 只怪" },
  { id: "threeExtra", name: "三连已读不回", description: "三条额外攻击 1 次" },
  { id: "straightBoost", name: "流程绿灯", description: "顺子穿透伤害 +20%" },
  { id: "flushRadius", name: "同事统一战线", description: "同花范围扩大" },
  { id: "keepOne", name: "这张先留着", description: "出牌后保留最右侧 1 张牌" },
  { id: "shieldOnEarly", name: "临时护盾", description: "1-4 张提前出牌获得 1 点精神值" },
  { id: "healOnKill", name: "摸鱼回血", description: "每次出牌若击杀怪物，回复 1 点精神值" },
];

export function createWave(wave: number): Monster[] {
  const countByWave = [0, 3, 4, 5, 6, 7];
  const count = countByWave[wave] ?? 7;
  const types: MonsterType[] =
    wave <= 2 ? ["burnout", "burnout", "meeting", "burnout"] : ["burnout", "urgent", "blame", "meeting"];
  return Array.from({ length: count }, (_, index) => {
    const type = types[(index + wave) % types.length];
    const base = monsterConfig[type];
    const hp = wave === 1 ? 8 : wave === 2 ? Math.max(10, Math.round(base.hp * 0.75)) : Math.round(base.hp + (wave - 2) * 2);
    const speedScale = wave === 1 ? 0.42 : wave === 2 ? 0.52 : wave === 3 ? 0.72 : 0.9;
    return {
      ...base,
      id: `w${wave}-m${index}-${Math.random().toString(16).slice(2)}`,
      hp,
      maxHp: hp,
      speed: base.speed * speedScale,
      x: wave === 1 ? 96 + index * 7 : wave === 2 ? 94 + index * 8 : 90 + index * 7,
    };
  });
}

export function moveMonsters(monsters: Monster[], seconds: number): {
  survivors: Monster[];
  leaks: number;
} {
  let leaks = 0;
  const survivors: Monster[] = [];

  for (const monster of monsters) {
    const moved = { ...monster, x: monster.x - monster.speed * seconds };
    if (moved.x <= 0) leaks += 1;
    else survivors.push(moved);
  }

  return { survivors, leaks };
}

export function resolveSkill(
  monsters: Monster[],
  evaluation: PokerEvaluation,
  upgrades: UpgradeId[],
): { monsters: Monster[]; killed: number; damage: number; targets: string[] } {
  const sorted = [...monsters].sort((a, b) => a.x - b.x);
  let damage = Math.round(BASE_DAMAGE * adjustedMultiplier(evaluation, upgrades));
  const targetIds = new Set<string>();

  if (evaluation.type === "straightFlush") {
    damage = Math.round(damage * 1.25);
    sorted.forEach((monster) => targetIds.add(monster.id));
  } else if (evaluation.type === "fourKind") {
    sorted.forEach((monster) => targetIds.add(monster.id));
  } else if (evaluation.type === "fullHouse") {
    sorted.slice(0, Math.min(3, sorted.length)).forEach((monster) => targetIds.add(monster.id));
  } else if (evaluation.type === "twoPair") {
    const count = upgrades.includes("twoPairExtra") ? 3 : 2;
    sorted.slice(0, count).forEach((monster) => targetIds.add(monster.id));
  } else if (evaluation.type === "threeKind") {
    const hits = upgrades.includes("threeExtra") ? 4 : 3;
    sorted.slice(0, Math.min(1, sorted.length)).forEach((monster) => targetIds.add(monster.id));
    const target = sorted[0];
    if (target) {
      return applyRepeatedHit(monsters, target.id, Math.round(BASE_DAMAGE), hits);
    }
  } else if (evaluation.type === "straight") {
    sorted.forEach((monster) => targetIds.add(monster.id));
  } else if (evaluation.type === "flush") {
    const first = sorted[0];
    if (first) {
      const radius = upgrades.includes("flushRadius") ? 36 : 24;
      sorted.filter((monster) => monster.x <= first.x + radius).forEach((monster) => targetIds.add(monster.id));
    }
  } else {
    sorted.slice(0, 1).forEach((monster) => targetIds.add(monster.id));
  }

  let killed = 0;
  const next = monsters
    .map((monster) => {
      if (!targetIds.has(monster.id)) return monster;
      return { ...monster, hp: monster.hp - damage };
    })
    .filter((monster) => {
      const alive = monster.hp > 0;
      if (!alive) killed += 1;
      return alive;
    });

  return { monsters: next, killed, damage, targets: [...targetIds] };
}

function adjustedMultiplier(evaluation: PokerEvaluation, upgrades: UpgradeId[]): number {
  let multiplier = evaluation.multiplier;
  if (evaluation.type === "pair" && upgrades.includes("pairBoost")) multiplier *= 1.3;
  if (evaluation.type === "straight" && upgrades.includes("straightBoost")) multiplier *= 1.2;
  return multiplier;
}

function applyRepeatedHit(
  monsters: Monster[],
  targetId: string,
  damagePerHit: number,
  hits: number,
): { monsters: Monster[]; killed: number; damage: number; targets: string[] } {
  let killed = 0;
  const totalDamage = damagePerHit * hits;
  const next = monsters
    .map((monster) => (monster.id === targetId ? { ...monster, hp: monster.hp - totalDamage } : monster))
    .filter((monster) => {
      const alive = monster.hp > 0;
      if (!alive) killed += 1;
      return alive;
    });
  return { monsters: next, killed, damage: totalDamage, targets: [targetId] };
}

export function pickUpgrades(existing: UpgradeId[]): Upgrade[] {
  const available = upgradePool.filter((upgrade) => !existing.includes(upgrade.id));
  return available.sort(() => Math.random() - 0.5).slice(0, 3);
}
