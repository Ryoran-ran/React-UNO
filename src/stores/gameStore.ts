import { create } from 'zustand';
import type { GameAction, GameState } from '../types/game';
import { normalizeSettings, type GameSettings } from '../types/rules';
import { createGame } from '../engine/gameEngine';
import { gameReducer } from '../engine/gameReducer';
import { loadSettings, saveSettings } from '../utils/storage';
interface GameStore {
  settings: GameSettings; game: GameState | null; storageAvailable: boolean;
  updateSettings: (settings: GameSettings) => void;
  startGame: () => void; dispatch: (action: GameAction) => void; leaveGame: () => void;
}
export const useGameStore = create<GameStore>((set, get) => ({
  settings: loadSettings(), game: null, storageAvailable: true,
  updateSettings: settings => { const normalized = normalizeSettings(settings); set({ settings: normalized, storageAvailable: saveSettings(normalized) }); },
  startGame: () => set({ game: createGame(get().settings, Math.floor(Math.random() * 4294967296)) }),
  dispatch: action => { const game = get().game; if (game) set({ game: gameReducer(game, action) }); },
  leaveGame: () => set({ game: null }),
}));
