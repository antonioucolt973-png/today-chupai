import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_SAVE, GAME_SAVE_KEY, loadGameSave, mergeGameSave, saveGameSave } from "./save";

function createStorage(initial?: string) {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(GAME_SAVE_KEY, initial);
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

describe("game save", () => {
  it("uses defaults when there is no save", () => {
    expect(loadGameSave(createStorage())).toEqual(DEFAULT_GAME_SAVE);
  });

  it("recovers from malformed or invalid data", () => {
    expect(loadGameSave(createStorage("not-json"))).toEqual(DEFAULT_GAME_SAVE);
    expect(loadGameSave(createStorage(JSON.stringify({ highScore: -10, farthestWave: 0 })))).toMatchObject({
      highScore: 0,
      farthestWave: 1,
      tutorialCompleted: false,
    });
  });

  it("keeps records and tutorial completion when merging progress", () => {
    const progressed = mergeGameSave(DEFAULT_GAME_SAVE, {
      highScore: 900,
      farthestWave: 4,
      tutorialCompleted: true,
    });
    const lowerResult = mergeGameSave(progressed, { highScore: 300, farthestWave: 2 });

    expect(lowerResult).toMatchObject({ highScore: 900, farthestWave: 4, tutorialCompleted: true });
  });

  it("round-trips through storage", () => {
    const storage = createStorage();
    const save = mergeGameSave(DEFAULT_GAME_SAVE, { highScore: 1200, farthestWave: 5, tutorialCompleted: true });

    saveGameSave(save, storage);

    expect(loadGameSave(storage)).toEqual(save);
  });
});
