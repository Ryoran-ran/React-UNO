import { normalizeSettings, type GameSettings } from '../types/rules';
import type { GameState } from '../types/game';
import { createDeck } from './deckManager';
import { randomStep, shuffle } from '../utils/shuffle';
import { activatePhase } from './turnManager';
export function createGame(settings: Partial<GameSettings> = {}, seed = 1): GameState {
  const normalized = normalizeSettings(settings);
  const deck = shuffle(createDeck(), seed >>> 0);
  const players = Array.from({ length: normalized.playerCount }, (_, i) => ({
    id: `p${i}`, name: normalized.playerNames[i], type: i < normalized.humanPlayerCount ? 'human' as const : 'cpu' as const,
    hand: deck.items.splice(0, 7), rank: null,
  }));
  const index = deck.items.findIndex(c => c.kind === 'number');
  const [top] = deck.items.splice(index, 1);
  const [random, rngState] = randomStep(deck.seed);
  const first = players[Math.floor(random * players.length)];
  const state: GameState = {
    settings: normalized, players, drawPile: deck.items, discardPile: [top], activeColor: top.color!, direction: 1,
    turnPlayerId: first.id, phase: 'normalTurn', pendingAttack: null, colorSelection: null, handoffPhase: null,
    viewerId: normalized.humanPlayerCount === 1 || normalized.handVisibility === 'all' ? 'p0' : null, finishQueue: [], rankings: [],
    events: [{ id: 1, type: 'system', text: 'カードを7枚ずつ配りました。ゲームスタート！' }], eventSequence: 1,
    rngState, turnCount: 1, consecutivePasses: 0, stalemate: false,
  };
  activatePhase(state, first.id, 'normalTurn');
  return state;
}
