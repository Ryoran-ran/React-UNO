import type { Card } from '../types/card';
import type { GameState } from '../types/game';
import { defenseType } from './attackManager';
import { standardCanPlay } from '../rules/standardRules';
import { getCardRule } from '../rules/ruleRegistry';
export function canPlayCard(state: GameState, playerId: string, card: Card): boolean {
  if (state.turnPlayerId !== playerId || !state.players.find(p => p.id === playerId && p.rank === null)?.hand.some(c => c.id === card.id)) return false;
  if (state.phase === 'attackResponse') return state.pendingAttack?.targetPlayerId === playerId && defenseType(state, card) !== null;
  if (state.phase !== 'normalTurn' || state.pendingAttack) return false;
  const rule = getCardRule(card.kind); if (!rule) return false;
  return rule.canPlay ? rule.canPlay(state, card) : standardCanPlay(state, card);
}
export function playableCards(state: GameState, playerId = state.turnPlayerId): Card[] {
  return state.players.find(p => p.id === playerId)?.hand.filter(c => canPlayCard(state, playerId, c)) ?? [];
}
export function canDraw(state: GameState, playerId: string): boolean {
  return state.phase === 'normalTurn' && !state.pendingAttack && state.turnPlayerId === playerId && (state.settings.allowVoluntaryDraw || playableCards(state, playerId).length === 0);
}
export function needsColorOnPlay(state: GameState, card: Card): boolean {
  return getCardRule(card.kind)?.effect(card).chooseColor === true && !(card.kind === 'wild4' && state.settings.wild4ColorTiming === 'afterAttack');
}
