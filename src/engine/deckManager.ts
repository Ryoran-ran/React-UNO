import { COLORS, type Card } from '../types/card';
import type { GameState } from '../types/game';
import { shuffle } from '../utils/shuffle';
export function createDeck(extraCards: Card[] = []): Card[] {
  const cards: Card[] = [];
  const add = (card: Omit<Card, 'id'>) => cards.push({ ...card, id: `card-${cards.length}` });
  for (const color of COLORS) {
    add({ color, kind: 'number', value: 0 });
    for (let value = 1; value <= 9; value++) for (let i = 0; i < 2; i++) add({ color, kind: 'number', value });
    for (const kind of ['skip', 'reverse', 'draw2']) for (let i = 0; i < 2; i++) add({ color, kind });
  }
  for (const kind of ['wild', 'wild4']) for (let i = 0; i < 4; i++) add({ color: null, kind });
  const result = [...cards, ...extraCards];
  if (new Set(result.map(c => c.id)).size !== result.length) throw new Error('カードIDが重複しています');
  return result;
}
// Mutates only the reducer's working copy; never discards the top card.
export function takeCard(state: GameState): Card | null {
  if (!state.drawPile.length && state.discardPile.length > 1) {
    const top = state.discardPile.at(-1)!;
    const recycled = shuffle(state.discardPile.slice(0, -1), state.rngState);
    state.drawPile = recycled.items; state.rngState = recycled.seed; state.discardPile = [top];
  }
  return state.drawPile.pop() ?? null;
}
export function drawCards(state: GameState, playerId: string, amount: number): number {
  const player = state.players.find(p => p.id === playerId)!;
  let drawn = 0;
  while (drawn < amount) { const card = takeCard(state); if (!card) break; player.hand.push(card); drawn++; }
  if (player.hand.length) state.finishQueue = state.finishQueue.filter(id => id !== playerId);
  return drawn;
}
