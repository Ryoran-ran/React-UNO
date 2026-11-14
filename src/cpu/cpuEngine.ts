import { COLORS, type Card, type NormalColor } from '../types/card';
import type { GameAction, GameState } from '../types/game';
import type { Difficulty } from '../types/rules';
import { playableCards } from '../engine/cardValidator';
import { nextPlayerId } from '../engine/turnManager';
export interface CpuObservation {
  selfId: string; hand: Card[]; others: { id: string; count: number; hand?: Card[] }[];
  direction: 1 | -1; attackColor?: NormalColor;
}
export function observeForCpu(state: GameState, playerId: string): CpuObservation {
  return {
    selfId: playerId, hand: state.players.find(p => p.id === playerId)!.hand,
    others: state.players.filter(p => p.id !== playerId && p.rank === null).map(p => ({
      id: p.id, count: p.hand.length,
      ...(state.settings.handVisibility === 'all' || (state.settings.handVisibility === 'cpu' && p.type === 'cpu') ? { hand: p.hand } : {}),
    })), direction: state.direction, attackColor: state.pendingAttack?.attackColor,
  };
}
function chooseColor(hand: Card[], difficulty: Difficulty, random: number, visibleNext?: Card[]): NormalColor {
  if (difficulty === 'easy') return COLORS[Math.floor(random * 4) % 4];
  return [...COLORS].sort((a, b) => {
    const score = (color: NormalColor) => hand.filter(c => c.color === color).length * 5 - (difficulty === 'hard' ? (visibleNext?.filter(c => c.color === color).length ?? 0) : 0);
    return score(b) - score(a);
  })[0];
}
// The strategy receives only a visibility-filtered observation and legal cards.
export function selectCpuCard(observation: CpuObservation, legal: Card[], difficulty: Difficulty, nextId: string, random: number): Card | undefined {
  if (!legal.length) return undefined;
  if (difficulty === 'easy') return legal[Math.floor(random * legal.length) % legal.length];
  const next = observation.others.find(p => p.id === nextId);
  const urgent = (next?.count ?? 7) <= 2;
  const score = (card: Card) => {
    let score = observation.hand.filter(c => c.color && c.color === card.color).length * 3;
    if (card.kind === 'wild') score -= 6;
    if (card.kind === 'wild4') score += urgent ? 20 : -3;
    if (card.kind === 'draw2') score += urgent ? 14 : 2;
    if (card.kind === 'skip' || card.kind === 'reverse') score += urgent ? 10 : difficulty === 'hard' && !observation.attackColor ? -7 : 2;
    if (difficulty === 'hard' && next?.hand && card.color) {
      score -= next.hand.filter(c => c.color === card.color).length * 2;
      if (card.kind === 'draw2' && next.hand.some(c => c.kind === 'reverse' && c.color === card.color)) score -= 12;
    }
    return score;
  };
  return [...legal].sort((a, b) => score(b) - score(a))[0];
}
export function chooseCpuAction(state: GameState, random = 0.5): GameAction | null {
  if (state.phase !== 'normalTurn' && state.phase !== 'attackResponse' && state.phase !== 'selectingColor') return null;
  const player = state.players.find(p => p.id === state.turnPlayerId);
  if (!player || player.type !== 'cpu') return null;
  const observation = observeForCpu(state, player.id);
  const nextId = nextPlayerId(state);
  const difficulty = state.settings.cpuDifficulty;
  if (state.phase === 'selectingColor') return { type: 'SELECT_COLOR', playerId: player.id, color: chooseColor(observation.hand, difficulty, random, observation.others.find(p => p.id === nextId)?.hand) };
  const card = selectCpuCard(observation, playableCards(state), difficulty, nextId, random);
  if (card) return { type: 'PLAY_CARD', playerId: player.id, cardId: card.id };
  return { type: state.phase === 'attackResponse' ? 'ACCEPT_DRAW_ATTACK' : 'DRAW_CARD', playerId: player.id };
}
