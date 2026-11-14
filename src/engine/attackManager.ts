import type { Card } from '../types/card';
import type { GameState } from '../types/game';
export type Defense = 'stack' | 'cancel' | 'reflect' | 'transfer';
export function defenseType(state: GameState, card: Card): Defense | null {
  const attack = state.pendingAttack; if (!attack) return null;
  const rules = state.settings.drawRules;
  if (card.kind === 'draw2' || card.kind === 'wild4') {
    const same = card.kind === attack.lastDrawType;
    if (rules.mode === 'stack' && (same || rules.allowMixedStacking)) return 'stack';
    if (rules.mode === 'cancel' && same) return 'cancel';
  }
  if (card.color !== attack.attackColor) return null;
  if (card.kind === 'reverse' && rules.allowReverseReflect && (rules.allowChainReflect || attack.reflectCount === 0)) return 'reflect';
  if (card.kind === 'skip' && rules.allowSkipTransfer && (rules.allowChainTransfer || attack.transferCount === 0)) return 'transfer';
  return null;
}
