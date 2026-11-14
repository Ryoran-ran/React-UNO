import type { Card } from '../types/card';
import type { GameState } from '../types/game';
export function standardCanPlay(state: GameState, card: Card): boolean {
  const top = state.discardPile.at(-1);
  return card.kind === 'wild' || card.kind === 'wild4' || card.color === state.activeColor ||
    (card.kind === 'number' && top?.kind === 'number' && card.value === top.value) ||
    (card.kind !== 'number' && card.kind === top?.kind);
}
