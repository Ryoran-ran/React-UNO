import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSettings, saveSettings } from './storage';
import { normalizeSettings } from '../types/rules';
afterEach(() => vi.unstubAllGlobals());
describe('settings persistence', () => {
  it('round-trips configured rules and player names', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
    const settings = normalizeSettings({ playerCount: 8, humanPlayerCount: 3, wild4ColorTiming: 'afterAttack', playerNames: ['花', '月', '星'] });
    settings.drawRules.mode = 'cancel'; settings.drawRules.allowChainReflect = false; settings.drawRules.continueAfterDraw = true;
    expect(saveSettings(settings)).toBe(true); expect(loadSettings()).toEqual(settings);
  });
  it('recovers from corrupt JSON and invalid settings', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{oops' }); expect(loadSettings()).toEqual(normalizeSettings());
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ playerCount: -10, humanPlayerCount: 100, drawRules: { mode: 'invalid', allowMixedStacking: 'yes' }, gameMode: 'invalid' }) });
    const settings = loadSettings(); expect(settings.playerCount).toBe(2); expect(settings.humanPlayerCount).toBe(2);
    expect(settings.drawRules.mode).toBe('stack'); expect(settings.drawRules.allowMixedStacking).toBe(false); expect(settings.gameMode).toBe('first');
  });
  it('works with unavailable or blocked browser storage', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); } });
    expect(loadSettings()).toEqual(normalizeSettings()); expect(saveSettings(normalizeSettings())).toBe(false);
  });
});
