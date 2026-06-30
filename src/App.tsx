import { useEffect, useState, type CSSProperties, type PointerEvent } from "react";
import { Play, RotateCcw } from "lucide-react";
import { cardLabel, suitLabels } from "./game/cards";
import {
  areAdjacent,
  createBoard,
  ensurePlayable,
  findMatches,
  findMatchesAfterSwap,
  removeMatchesAndRefill,
} from "./game/board";
import { createWave, moveMonsters, resolveSkill } from "./game/combat";
import { evaluatePokerHand } from "./game/poker";
import { SKILL_PREVIEWS } from "./game/skillPreview";
import { fillSkillSlots, pickCardsForSkillSlots } from "./game/skillSlots";
import type { BoardCell, BoardMatch, Card, FloatingText, Monster, PokerEvaluation } from "./game/types";

type Phase = "ready" | "combat" | "swapping" | "refilling" | "ended";
type MatchBurst = {
  detail: string;
  id: number;
  label: string;
};
type EnergyParticle = {
  delay: number;
  id: string;
  kind: "attack" | "skill";
  tx: string;
  ty: string;
  x: string;
  y: string;
};
type SkillShowcase = {
  cards: Card[];
  evaluation: PokerEvaluation;
  id: number;
};

const MAX_WAVE = 5;
const MAX_SPIRIT = 15;
const SKILL_SLOT_LIMIT = 5;
const MAX_CASCADE_STEPS = 5;
const SKILL_EFFECTS = [
  { hand: "高牌", effect: "单体小伤害" },
  { hand: "一对", effect: "单体强化伤害" },
  { hand: "两对", effect: "攻击前排 2 个" },
  { hand: "三条", effect: "对最近目标连击" },
  { hand: "顺子", effect: "穿透攻击全体" },
  { hand: "同花", effect: "范围攻击前排" },
  { hand: "葫芦", effect: "高额单体爆发" },
  { hand: "四条", effect: "超高单体爆发" },
  { hand: "同花顺", effect: "最强爆发" },
];

export function App() {
  const [board, setBoard] = useState(() => createBoard());
  const [monsters, setMonsters] = useState<Monster[]>(() => createWave(1));
  const [phase, setPhase] = useState<Phase>("ready");
  const [wave, setWave] = useState(1);
  const [spirit, setSpirit] = useState(MAX_SPIRIT);
  const [selectedCell, setSelectedCell] = useState<BoardCell | null>(null);
  const [dragCell, setDragCell] = useState<BoardCell | null>(null);
  const [swapFeedback, setSwapFeedback] = useState<{
    dx: number;
    dy: number;
    from: string;
    to: string;
    status: "valid" | "invalid";
  } | null>(null);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [lastCombo, setLastCombo] = useState("交换消除，自动攻击");
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [skillCards, setSkillCards] = useState<Card[]>([]);
  const [gainedCardIds, setGainedCardIds] = useState<string[]>([]);
  const [lastSkill, setLastSkill] = useState<PokerEvaluation | null>(null);
  const [matchedCellKeys, setMatchedCellKeys] = useState<string[]>([]);
  const [refillWave, setRefillWave] = useState(0);
  const [skillBurst, setSkillBurst] = useState(false);
  const [skillCast, setSkillCast] = useState<PokerEvaluation | null>(null);
  const [skillShowcase, setSkillShowcase] = useState<SkillShowcase | null>(null);
  const [matchBurst, setMatchBurst] = useState<MatchBurst | null>(null);
  const [energyParticles, setEnergyParticles] = useState<EnergyParticle[]>([]);
  const [hitMonsterIds, setHitMonsterIds] = useState<string[]>([]);
  const [result, setResult] = useState<"win" | "lose" | null>(null);

  useEffect(() => {
    if (phase !== "combat") return;

    const timer = window.setInterval(() => {
      setMonsters((current) => {
        const { survivors, leaks } = moveMonsters(current, 0.2);
        if (leaks > 0) {
          setSpirit((value) => Math.max(0, value - leaks));
        }
        return survivors;
      });
    }, 200);

    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (spirit <= 0 && phase !== "ended") {
      setResult("lose");
      setPhase("ended");
    }
  }, [phase, spirit]);

  useEffect(() => {
    if (phase !== "combat" || monsters.length > 0) return;

    if (wave >= MAX_WAVE) {
      setResult("win");
      setPhase("ended");
      return;
    }

    const nextWave = wave + 1;
    setWave(nextWave);
    setMonsters(createWave(nextWave));
    setCombo(0);
    setLastCombo(`第 ${nextWave} 波来了`);
  }, [monsters.length, phase, wave]);

  function showSwapFeedback(first: BoardCell, second: BoardCell, status: "valid" | "invalid") {
    setSwapFeedback({
      dx: second.x - first.x,
      dy: second.y - first.y,
      from: `${first.x}-${first.y}`,
      to: `${second.x}-${second.y}`,
      status,
    });
    window.setTimeout(() => setSwapFeedback(null), status === "valid" ? 680 : 360);
  }

  function trySwap(first: BoardCell, second: BoardCell) {
    if (!areAdjacent(first, second)) {
      clearSelection();
      return;
    }

    const swapResult = findMatchesAfterSwap(board, first, second);
    if (swapResult.matches.length === 0) {
      showSwapFeedback(first, second, "invalid");
      clearSelection();
      setMatchedCellKeys([]);
      setCombo(0);
      setLastCombo("没有组成消除");
      return;
    }

    showSwapFeedback(first, second, "valid");
    setBoard(swapResult.board);
    setMatchedCellKeys(getMatchedCellKeys(swapResult.matches));
    clearSelection();
    setPhase("swapping");

    window.setTimeout(() => {
      resolveMatches(swapResult.board, swapResult.matches, 1, monsters, skillCards, combo, wave);
    }, 560);
  }

  function resolveMatches(
    sourceBoard: BoardCell[][],
    matches: BoardMatch[],
    cascadeStep: number,
    sourceMonsters: Monster[],
    sourceSkillCards: Card[],
    sourceCombo: number,
    sourceWave: number,
  ) {
    const nextCombo = sourceCombo + 1;
    const outcome = applyMatchesToMonsters(sourceMonsters, matches, nextCombo);
    const waveBridge = bridgeEmptyWave(outcome.monsters, sourceWave);
    const gainedCards = pickCardsForSkillSlots(matches, sourceSkillCards, SKILL_SLOT_LIMIT);
    const skillSlotResult = fillSkillSlots(sourceSkillCards, gainedCards, SKILL_SLOT_LIMIT);
    const skillEvaluation = skillSlotResult.readyCards ? evaluatePokerHand(skillSlotResult.readyCards) : null;
    const releasedCards = skillSlotResult.readyCards ?? null;
    const skillOutcome = skillEvaluation ? resolveSkill(waveBridge.monsters, skillEvaluation, []) : null;
    const nextMonsters = skillOutcome?.monsters ?? waveBridge.monsters;
    const nextSkillCards = skillSlotResult.slots;
    const skillTexts = skillOutcome ? createSkillFloatingTexts(waveBridge.monsters, skillOutcome.targets, skillOutcome.damage) : [];
    const hitIds = [...new Set([...outcome.targetIds, ...(skillOutcome?.targets ?? [])])];
    const particles = createEnergyParticles(matches, gainedCards.length, hitIds.length);
    const refilledBoard = removeMatchesAndRefill(sourceBoard, matches, {
      clearImmediateMatches: cascadeStep >= MAX_CASCADE_STEPS,
      ensurePlayableBoard: false,
    });
    const cascadeMatches = cascadeStep < MAX_CASCADE_STEPS ? findMatches(refilledBoard) : [];
    const hasCascade = cascadeMatches.length > 0;
    const visibleBoard = hasCascade ? refilledBoard : ensurePlayable(refilledBoard);

    if (waveBridge.wave !== sourceWave) {
      setWave(waveBridge.wave);
    }
    setMonsters(nextMonsters);
    setFloatingTexts([...outcome.texts, ...skillTexts]);
    setScore((value) => value + outcome.score);
    setCombo(nextCombo);
    setMatchBurst({
      id: Date.now(),
      label: nextCombo > 1 ? `${nextCombo} 连消！` : "消除！",
      detail: `+${outcome.score} 分`,
    });
    setEnergyParticles(particles);
    setHitMonsterIds(hitIds);
    setSkillCards(nextSkillCards);
    setGainedCardIds(gainedCards.map((card) => card.id));
    setLastSkill(skillEvaluation);
    setSkillBurst(Boolean(skillEvaluation));
    setSkillCast(skillEvaluation);
    setSkillShowcase(
      skillEvaluation && releasedCards
        ? {
            cards: releasedCards,
            evaluation: skillEvaluation,
            id: Date.now(),
          }
        : null,
    );
    setMatchedCellKeys([]);
    setLastCombo(
      skillEvaluation
        ? `${cascadeStep > 1 ? `连锁 ${cascadeStep}！` : ""}${outcome.label}${waveBridge.advanced ? `，第 ${waveBridge.wave} 波接上` : ""}，技能释放：${skillEvaluation.label}`
        : `${cascadeStep > 1 ? `连锁 ${cascadeStep}！` : ""}${outcome.label}${
            gainedCards.length > 0 ? `，获得 ${gainedCards.length} 张` : "，技能槽已满或重复"
          }${waveBridge.advanced ? `，第 ${waveBridge.wave} 波接上` : ""}${hasCascade ? "，继续连锁" : ""}`,
    );
    setBoard(visibleBoard);
    setRefillWave((value) => value + 1);
    setPhase("refilling");

    if (hasCascade) {
      window.setTimeout(() => {
        setMatchedCellKeys(getMatchedCellKeys(cascadeMatches));
        setPhase("swapping");
        setLastCombo(`连锁 ${cascadeStep + 1}！`);
        window.setTimeout(() => {
          resolveMatches(refilledBoard, cascadeMatches, cascadeStep + 1, nextMonsters, nextSkillCards, nextCombo, waveBridge.wave);
        }, 560);
      }, 420);
    } else {
      window.setTimeout(() => setPhase("combat"), 360);
      window.setTimeout(() => {
        setFloatingTexts([]);
        setGainedCardIds([]);
        setMatchedCellKeys([]);
        setSkillBurst(false);
        setSkillCast(null);
        setSkillShowcase(null);
        setMatchBurst(null);
        setEnergyParticles([]);
        setHitMonsterIds([]);
      }, skillEvaluation ? 3200 : 920);
    }
  }

  function clearSelection() {
    setSelectedCell(null);
    setDragCell(null);
  }

  function onCellPointerDown(cell: BoardCell, event: PointerEvent<HTMLButtonElement>) {
    if (phase !== "combat") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedCell(cell);
    setDragCell(cell);
  }

  function onCellPointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (phase !== "combat" || !dragCell) return;

    const target = document.elementFromPoint(event.clientX, event.clientY);
    const tile = target?.closest<HTMLButtonElement>(".card-tile");
    const x = Number(tile?.dataset.x);
    const y = Number(tile?.dataset.y);
    const targetCell = Number.isInteger(x) && Number.isInteger(y) ? board[y]?.[x] : null;

    if (targetCell && (targetCell.x !== dragCell.x || targetCell.y !== dragCell.y)) {
      trySwap(dragCell, targetCell);
      return;
    }

    clearSelection();
  }

  function onCellClick(cell: BoardCell) {
    if (phase !== "combat") return;

    if (!selectedCell) {
      setSelectedCell(cell);
      return;
    }

    if (selectedCell.x === cell.x && selectedCell.y === cell.y) {
      clearSelection();
      return;
    }

    trySwap(selectedCell, cell);
  }

  function restart() {
    setBoard(createBoard());
    setMonsters(createWave(1));
    setPhase("ready");
    setWave(1);
    setSpirit(MAX_SPIRIT);
    clearSelection();
    setSwapFeedback(null);
    setFloatingTexts([]);
    setMatchedCellKeys([]);
    setRefillWave(0);
    setLastCombo("交换消除，自动攻击");
    setScore(0);
    setCombo(0);
    setSkillCards([]);
    setGainedCardIds([]);
    setLastSkill(null);
    setSkillBurst(false);
    setSkillCast(null);
    setSkillShowcase(null);
    setMatchBurst(null);
    setEnergyParticles([]);
    setHitMonsterIds([]);
    setResult(null);
  }

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <h1>今天也要出牌</h1>
          <p>拖动交换，三消打怪。</p>
        </div>
        <div className="stats">
          <Stat label="波次" value={`${wave}/${MAX_WAVE}`} />
          <Stat label="精神值" value={`${spirit}/${MAX_SPIRIT}`} danger={spirit <= 4} />
          <Stat label="分数" value={`${score}`} />
        </div>
      </header>

      <section className="game-shell">
        <section className="board-panel">
          <div className="section-title">
            <span>扑克牌棋盘</span>
            <span>同点数或同花色都能消</span>
          </div>
          <div
            className={`board ${phase === "refilling" ? "refilling" : ""} ${matchBurst ? "match-active" : ""} ${
              combo >= 2 ? "combo-hot" : ""
            }`}
            aria-label="扑克牌棋盘"
          >
            {matchBurst && (
              <div key={matchBurst.id} className="match-burst" aria-hidden="true">
                <strong>{matchBurst.label}</strong>
                <span>{matchBurst.detail}</span>
              </div>
            )}
            {energyParticles.map((particle) => (
              <span
                key={particle.id}
                className={`energy-particle ${particle.kind}`}
                style={
                  {
                    "--particle-delay": `${particle.delay}ms`,
                    "--particle-tx": particle.tx,
                    "--particle-ty": particle.ty,
                    left: particle.x,
                    top: particle.y,
                  } as CSSProperties
                }
                aria-hidden="true"
              />
            ))}
            {board.flat().map((cell) => {
              const selected = selectedCell?.x === cell.x && selectedCell.y === cell.y;
              const adjacent = selectedCell ? areAdjacent(selectedCell, cell) : false;
              const cellKey = `${cell.x}-${cell.y}`;
              const matched = matchedCellKeys.includes(cellKey);
              const matchedIndex = matched ? matchedCellKeys.indexOf(cellKey) : 0;
              const feedbackClass =
                swapFeedback?.from === cellKey
                  ? `swap-${swapFeedback.status} swap-from`
                  : swapFeedback?.to === cellKey
                    ? `swap-${swapFeedback.status} swap-to`
                    : "";
              const swapStyle =
                swapFeedback?.from === cellKey
                  ? ({
                      "--swap-start-x": `${swapFeedback.dx * 112}%`,
                      "--swap-start-y": `${swapFeedback.dy * 112}%`,
                      "--drop-delay": `${cell.y * 34 + cell.x * 8}ms`,
                      "--match-delay": `${matchedIndex * 38}ms`,
                    } as CSSProperties)
                  : swapFeedback?.to === cellKey
                    ? ({
                        "--swap-start-x": `${swapFeedback.dx * -112}%`,
                        "--swap-start-y": `${swapFeedback.dy * -112}%`,
                        "--drop-delay": `${cell.y * 34 + cell.x * 8}ms`,
                        "--match-delay": `${matchedIndex * 38}ms`,
                      } as CSSProperties)
                    : ({
                        "--drop-delay": `${cell.y * 34 + cell.x * 8}ms`,
                        "--match-delay": `${matchedIndex * 38}ms`,
                      } as CSSProperties);
              return (
                <button
                  key={`${cell.x}-${cell.y}-${refillWave}`}
                  className={`card-tile ${cell.card.suit} ${selected ? "selected" : ""} ${adjacent ? "adjacent" : ""} ${matched ? "matched" : ""} ${feedbackClass}`}
                  data-x={cell.x}
                  data-y={cell.y}
                  style={swapStyle}
                  onClick={() => onCellClick(cell)}
                  onPointerDown={(event) => onCellPointerDown(cell, event)}
                  onPointerUp={onCellPointerUp}
                  onPointerCancel={clearSelection}
                  disabled={phase !== "combat"}
                  aria-label={`${cardLabel(cell.card)}，拖动到相邻牌交换`}
                >
                  <span className="card-rank">{cell.card.rank}</span>
                  <strong className="card-suit">{suitLabels[cell.card.suit]}</strong>
                  {matched &&
                    Array.from({ length: 5 }, (_, index) => (
                      <i key={index} className={`match-spark spark-${index + 1}`} aria-hidden="true" />
                    ))}
                </button>
              );
            })}
          </div>
        </section>

        <section className="battle-panel">
          <div className="section-title">
            <span>怪物压力</span>
            <span>
              {phase === "ready"
                ? "等待开局"
                : phase === "swapping"
                  ? "消除中"
                  : phase === "refilling"
                    ? "补牌中"
                    : "推进中"}
            </span>
          </div>
          <div
            className={`lane ${hitMonsterIds.length > 0 ? "attack-burst" : ""} ${skillBurst ? "skill-burst" : ""} ${
              skillCast ? `skill-${skillCast.type}` : ""
            }`}
          >
            <div className="base">工位</div>
            {skillCast && <SkillVisualLayer showcase={skillShowcase} />}
            {[...monsters].sort((first, second) => second.x - first.x).map((monster) => (
              <div
                key={monster.id}
                className={`monster ${monster.type} ${hitMonsterIds.includes(monster.id) ? "hit" : ""}`}
                style={{ left: `${monster.x}%` }}
                title={`${monster.name} ${monster.hp}/${monster.maxHp}`}
              >
                <span>{monster.name}</span>
                <meter min={0} max={monster.maxHp} value={monster.hp} />
              </div>
            ))}
            {floatingTexts.map((item) => (
              <div key={item.id} className="damage-text" style={{ left: `${item.x}%`, top: `${item.y}%` }}>
                {item.text}
              </div>
            ))}
          </div>
          <div className="combat-log">{lastCombo}</div>
        </section>
      </section>

      <section className={`skill-slot-panel ${lastSkill ? "released" : ""}`}>
        <div>
          <span className="label">技能槽</span>
          <strong>
            {skillCards.length}/{SKILL_SLOT_LIMIT}
          </strong>
        </div>
        <div className="skill-slots" aria-label="技能槽">
          {Array.from({ length: SKILL_SLOT_LIMIT }, (_, index) => {
            const card = skillCards[index];
            return card ? (
              <div
                key={`${card.id}-${index}`}
                className={`skill-slot filled ${card.suit} ${gainedCardIds.includes(card.id) ? "gained" : ""}`}
              >
                <span>{card.rank}</span>
                <strong>{suitLabels[card.suit]}</strong>
              </div>
            ) : (
              <div key={`empty-${index}`} className="skill-slot empty">
                空
              </div>
            );
          })}
        </div>
        <div>
          <span className="label">下一步</span>
          <strong>{lastSkill ? `刚释放：${lastSkill.label}` : "集满 5 张自动释放技能"}</strong>
        </div>
        <div className="skill-mini-reference" aria-label="技能效果表">
          <span className="label">技能效果</span>
          <div>
            {SKILL_EFFECTS.map((item) => (
              <span key={item.hand} title={item.effect}>
                <b>{item.hand}</b>
                {item.effect}
              </span>
            ))}
          </div>
        </div>
      </section>

      {phase === "ready" && (
        <div className="modal">
          <div className="dialog">
            <h2>开始消除</h2>
            <p>拖动相邻牌交换，凑 3 张同点数或同花色就会消除。技能会自动释放。</p>
            <button className="primary-button" onClick={() => setPhase("combat")}>
              <Play size={18} />
              开始
            </button>
          </div>
        </div>
      )}

      {phase === "ended" && (
        <div className="modal">
          <div className="dialog">
            <h2>{result === "win" ? "今天守住了！" : "今天没守住……"}</h2>
            <p>
              最终分数：{score}。第 {wave} 波结束。
            </p>
            <button className="primary-button" onClick={restart}>
              <RotateCcw size={18} />
              再来一局
            </button>
          </div>
        </div>
      )}

      {import.meta.env.DEV && <SkillEffectPreviewer />}
    </main>
  );
}

function SkillVisualLayer({ showcase }: { showcase: SkillShowcase | null }) {
  if (!showcase) return null;

  return (
    <>
      <div className="skill-cinematic" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="skill-banner">{showcase.evaluation.label}</div>
      <div
        key={showcase.id}
        className={`skill-showcase showcase-${showcase.evaluation.type}`}
        aria-hidden="true"
      >
        <div className="showcase-kicker">SKILL READY</div>
        <div className="showcase-title">{showcase.evaluation.label}</div>
        <div className="showcase-cards">
          {showcase.cards.map((card, index) => (
            <div
              key={`${card.id}-${index}`}
              className={`showcase-card ${card.suit}`}
              style={{ "--card-index": index } as CSSProperties}
            >
              <span>{card.rank}</span>
              <strong>{suitLabels[card.suit]}</strong>
            </div>
          ))}
        </div>
      </div>
      <div className="skill-vfx" aria-hidden="true" />
      <div className="skill-impact" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </>
  );
}

function SkillEffectPreviewer() {
  const [isOpen, setIsOpen] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [playbackId, setPlaybackId] = useState(1);
  const selected = SKILL_PREVIEWS[selectedIndex];

  function play(index = selectedIndex) {
    setSelectedIndex(index);
    setPlaybackId((value) => value + 1);
  }

  return (
    <aside className={`skill-previewer ${isOpen ? "open" : "collapsed"}`} aria-label="开发环境技能特效预览器">
      <div className="skill-previewer-header">
        <div>
          <span>DEV TOOL</span>
          <strong>技能特效预览器</strong>
        </div>
        <button className="ghost-button" type="button" onClick={() => setIsOpen((value) => !value)}>
          {isOpen ? "收起" : "展开"}
        </button>
      </div>
      {isOpen && (
        <div className="skill-previewer-body">
          <div className="skill-preview-controls" role="group" aria-label="选择要预览的牌型">
            {SKILL_PREVIEWS.map((preview, index) => (
              <button
                key={preview.evaluation.type}
                type="button"
                className={index === selectedIndex ? "active" : ""}
                aria-pressed={index === selectedIndex}
                onClick={() => play(index)}
              >
                {preview.evaluation.label}
              </button>
            ))}
            <button className="replay" type="button" onClick={() => play()}>
              重新播放
            </button>
          </div>
          <div className="skill-preview-meta" aria-live="polite">
            <strong>{selected.evaluation.label}</strong>
            <span>{selected.effect}</span>
            <span>动画序号 #{playbackId}</span>
          </div>
          <div
            key={playbackId}
            className={`lane skill-preview-stage skill-burst skill-${selected.evaluation.type}`}
            aria-label={`正在预览：${selected.evaluation.label}`}
          >
            <div className="base">预览</div>
            <SkillVisualLayer
              showcase={{ cards: selected.cards, evaluation: selected.evaluation, id: playbackId }}
            />
            {[24, 48, 72].map((left, index) => (
              <div key={left} className="monster burnout hit" style={{ left: `${left}%` }} aria-hidden="true">
                <span>目标 {index + 1}</span>
                <meter min={0} max={10} value={10 - index * 2} />
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

function applyMatchesToMonsters(
  monsters: Monster[],
  matches: BoardMatch[],
  combo: number,
): { label: string; monsters: Monster[]; score: number; targetIds: string[]; texts: FloatingText[] } {
  const damageByMonster = new Map<string, number>();
  const sorted = [...monsters].sort((a, b) => a.x - b.x);
  let totalDamage = 0;
  let score = 0;

  for (const match of matches) {
    const matchBonus = match.cells.length >= 5 ? 1.8 : match.cells.length === 4 ? 1.35 : 1;
    const comboBonus = 1 + Math.min(combo - 1, 5) * 0.15;
    const baseDamage = Math.round(match.cells.length * (match.kind === "rank" ? 12 : 8) * matchBonus * comboBonus);
    const targets = match.kind === "rank" ? sorted.slice(0, 1) : sorted.slice(0, Math.min(3, sorted.length));

    for (const target of targets) {
      damageByMonster.set(target.id, (damageByMonster.get(target.id) ?? 0) + baseDamage);
      totalDamage += baseDamage;
    }
    score += Math.round(baseDamage * targets.length + match.cells.length * 10 * comboBonus);
  }

  let killed = 0;
  const nextMonsters = monsters
    .map((monster) => {
      const damage = damageByMonster.get(monster.id) ?? 0;
      return damage > 0 ? { ...monster, hp: monster.hp - damage } : monster;
    })
    .filter((monster) => {
      const alive = monster.hp > 0;
      if (!alive) killed += 1;
      return alive;
    });

  const texts: FloatingText[] = [...damageByMonster.entries()].map(([id, damage], index) => {
    const target = monsters.find((monster) => monster.id === id);
    return {
      id: `${id}-${Date.now()}`,
      text: `-${damage}`,
      x: target?.x ?? 50,
      y: 20 + index * 10,
    };
  });

  const label = `${combo} 连消：${totalDamage} 伤害${killed > 0 ? `，击倒 ${killed} 个` : ""}`;
  return { label, monsters: nextMonsters, score, targetIds: [...damageByMonster.keys()], texts };
}

function createSkillFloatingTexts(monsters: Monster[], targetIds: string[], damage: number): FloatingText[] {
  return targetIds.map((id, index) => {
    const target = monsters.find((monster) => monster.id === id);
    return {
      id: `skill-${id}-${Date.now()}`,
      text: `技能 -${damage}`,
      x: target?.x ?? 50,
      y: 58 + index * 10,
    };
  });
}

function createEnergyParticles(matches: BoardMatch[], gainedCards: number, targetCount: number): EnergyParticle[] {
  const cells = matches.flatMap((match) => match.cells);
  const selectedCells = cells.slice(0, Math.min(cells.length, 10));
  const stamp = Date.now();
  const particles: EnergyParticle[] = [];

  selectedCells.forEach((cell, index) => {
    particles.push({
      delay: index * 26,
      id: `attack-${cell.x}-${cell.y}-${index}-${stamp}`,
      kind: "attack",
      tx: `${72 + Math.min(targetCount, 3) * 8}%`,
      ty: `${-10 + (index % 3) * 14}%`,
      x: `${((cell.x + 0.5) / 7) * 100}%`,
      y: `${((cell.y + 0.5) / 7) * 100}%`,
    });
  });

  selectedCells.slice(0, Math.max(1, gainedCards)).forEach((cell, index) => {
    particles.push({
      delay: 80 + index * 42,
      id: `skill-${cell.x}-${cell.y}-${index}-${stamp}`,
      kind: "skill",
      tx: `${-18 + index * 4}%`,
      ty: `${60 + (index % 2) * 8}%`,
      x: `${((cell.x + 0.5) / 7) * 100}%`,
      y: `${((cell.y + 0.5) / 7) * 100}%`,
    });
  });

  return particles;
}

function bridgeEmptyWave(monsters: Monster[], currentWave: number): {
  advanced: boolean;
  monsters: Monster[];
  wave: number;
} {
  if (monsters.length > 0 || currentWave >= MAX_WAVE) {
    return { advanced: false, monsters, wave: currentWave };
  }

  const nextWave = currentWave + 1;
  return {
    advanced: true,
    monsters: createWave(nextWave),
    wave: nextWave,
  };
}

function getMatchedCellKeys(matches: BoardMatch[]): string[] {
  return [...new Set(matches.flatMap((match) => match.cells.map((cell) => `${cell.x}-${cell.y}`)))];
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={`stat ${danger ? "danger" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
