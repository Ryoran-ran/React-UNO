export type Difficulty = 'easy' | 'normal' | 'hard';
export interface DrawRules {
  mode: 'stack' | 'cancel' | 'forced';
  allowMixedStacking: boolean;
  allowReverseReflect: boolean;
  allowSkipTransfer: boolean;
  allowChainReflect: boolean;
  allowChainTransfer: boolean;
  continueAfterDraw: boolean;
}
export interface GameSettings {
  playerCount: number;
  humanPlayerCount: number;
  playerNames: string[];
  cpuDifficulty: Difficulty;
  cpuDelay: number;
  gameMode: 'first' | 'ranking';
  handVisibility: 'hidden' | 'all' | 'cpu';
  drawBehavior: 'drawOnceAndPass' | 'drawUntilPlayable';
  allowVoluntaryDraw: boolean;
  showUnoEffect: boolean;
  reducedMotion: boolean;
  drawRules: DrawRules;
  wild4ColorTiming: 'immediate' | 'afterAttack';
}
export const DEFAULT_SETTINGS: GameSettings = {
  playerCount: 4, humanPlayerCount: 1, playerNames: ['あなた', 'ソラ', 'リン', 'ナギ', 'ハル', 'アオ', 'ユイ', 'レイ'],
  cpuDifficulty: 'normal', cpuDelay: 950, gameMode: 'first', handVisibility: 'hidden',
  drawBehavior: 'drawOnceAndPass', allowVoluntaryDraw: true, showUnoEffect: true, reducedMotion: false,
  drawRules: { mode: 'stack', allowMixedStacking: false, allowReverseReflect: true, allowSkipTransfer: true, allowChainReflect: true, allowChainTransfer: true, continueAfterDraw: false },
  wild4ColorTiming: 'immediate',
};
export function normalizeSettings(input: Partial<GameSettings> = {}): GameSettings {
  const s = { ...DEFAULT_SETTINGS, ...input, drawRules: { ...DEFAULT_SETTINGS.drawRules, ...input.drawRules } };
  const clamp = (value: number, low: number, high: number, fallback: number) => Number.isFinite(value) ? Math.min(high, Math.max(low, Math.trunc(value))) : fallback;
  s.playerCount = clamp(s.playerCount, 2, 8, 4);
  s.humanPlayerCount = clamp(s.humanPlayerCount, 1, s.playerCount, 1);
  s.cpuDelay = clamp(s.cpuDelay, 200, 2500, 950);
  s.playerNames = Array.from({ length: 8 }, (_, i) => typeof input.playerNames?.[i] === 'string' && input.playerNames[i].trim() ? input.playerNames[i].trim().slice(0, 16) : DEFAULT_SETTINGS.playerNames[i]);
  if (!['first', 'ranking'].includes(s.gameMode)) s.gameMode = 'first';
  if (!['hidden', 'all', 'cpu'].includes(s.handVisibility)) s.handVisibility = 'hidden';
  if (!['easy', 'normal', 'hard'].includes(s.cpuDifficulty)) s.cpuDifficulty = 'normal';
  if (!['stack', 'cancel', 'forced'].includes(s.drawRules.mode)) s.drawRules.mode = 'stack';
  if (!['immediate', 'afterAttack'].includes(s.wild4ColorTiming)) s.wild4ColorTiming = 'immediate';
  if (!['drawOnceAndPass', 'drawUntilPlayable'].includes(s.drawBehavior)) s.drawBehavior = 'drawOnceAndPass';
  for (const key of ['allowVoluntaryDraw', 'showUnoEffect', 'reducedMotion'] as const) if (typeof s[key] !== 'boolean') s[key] = DEFAULT_SETTINGS[key];
  for (const key of ['allowMixedStacking', 'allowReverseReflect', 'allowSkipTransfer', 'allowChainReflect', 'allowChainTransfer', 'continueAfterDraw'] as const) if (typeof s.drawRules[key] !== 'boolean') s.drawRules[key] = DEFAULT_SETTINGS.drawRules[key];
  return s;
}
