import type { Card } from '../types/card';
import type { GameState } from '../types/game';
export interface CardEffect { draw?: number; reverse?: boolean; skip?: boolean; chooseColor?: boolean }
export interface CardRule {
  canPlay?: (state: Readonly<GameState>, card: Card) => boolean;
  effect: (card: Card) => CardEffect;
}
const rules = new Map<string, CardRule>([
  ['number', { effect: () => ({}) }], ['skip', { effect: () => ({ skip: true }) }],
  ['reverse', { effect: () => ({ reverse: true }) }], ['draw2', { effect: () => ({ draw: 2 }) }],
  ['wild', { effect: () => ({ chooseColor: true }) }], ['wild4', { effect: () => ({ draw: 4, chooseColor: true }) }],
]);
// Custom cards can reuse declarative effects without coupling them to React.
export function registerCardRule(kind: string, rule: CardRule): () => void {
  const previous = rules.get(kind); rules.set(kind, rule);
  return () => { if (previous) rules.set(kind, previous); else rules.delete(kind); };
}
export function getCardRule(kind: string): CardRule | undefined { return rules.get(kind); }
