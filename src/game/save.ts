export const GAME_SAVE_KEY = "today-chupai:save";
export const GAME_SAVE_VERSION = 1;

export type GameSave = {
  version: typeof GAME_SAVE_VERSION;
  highScore: number;
  farthestWave: number;
  tutorialCompleted: boolean;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export const DEFAULT_GAME_SAVE: GameSave = {
  version: GAME_SAVE_VERSION,
  highScore: 0,
  farthestWave: 1,
  tutorialCompleted: false,
};

export function loadGameSave(storage = getBrowserStorage()): GameSave {
  if (!storage) return { ...DEFAULT_GAME_SAVE };

  try {
    const raw = storage.getItem(GAME_SAVE_KEY);
    if (!raw) return { ...DEFAULT_GAME_SAVE };
    return normalizeGameSave(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_GAME_SAVE };
  }
}

export function saveGameSave(save: GameSave, storage = getBrowserStorage()): void {
  if (!storage) return;

  try {
    storage.setItem(GAME_SAVE_KEY, JSON.stringify(normalizeGameSave(save)));
  } catch {
    // Storage may be disabled or full in an embedded WebView. The game remains playable in memory.
  }
}

export function mergeGameSave(current: GameSave, patch: Partial<Omit<GameSave, "version">>): GameSave {
  return normalizeGameSave({
    ...current,
    ...patch,
    highScore: Math.max(current.highScore, patch.highScore ?? 0),
    farthestWave: Math.max(current.farthestWave, patch.farthestWave ?? 1),
    tutorialCompleted: current.tutorialCompleted || Boolean(patch.tutorialCompleted),
  });
}

function normalizeGameSave(value: unknown): GameSave {
  if (!value || typeof value !== "object") return { ...DEFAULT_GAME_SAVE };

  const candidate = value as Partial<GameSave>;
  return {
    version: GAME_SAVE_VERSION,
    highScore: toNonNegativeInteger(candidate.highScore, 0),
    farthestWave: Math.max(1, toNonNegativeInteger(candidate.farthestWave, 1)),
    tutorialCompleted: candidate.tutorialCompleted === true,
  };
}

function toNonNegativeInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
}

function getBrowserStorage(): StorageLike | undefined {
  if (typeof window === "undefined") return undefined;

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
