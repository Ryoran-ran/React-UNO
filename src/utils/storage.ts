import { normalizeSettings, type GameSettings } from '../types/rules';
const KEY = 'iroha-settings-v1';
export function loadSettings(): GameSettings {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return normalizeSettings(parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Partial<GameSettings> : {});
  } catch { return normalizeSettings(); }
}
export function saveSettings(settings: GameSettings): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); return true; } catch { return false; }
}
