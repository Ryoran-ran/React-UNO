import { COLORS, type Card } from '../../types/card';

export type HandSort = 'color' | 'number';
const colorOrder = (card: Card) => card.color === null ? COLORS.length : COLORS.indexOf(card.color);
const kindOrder: Record<string, number> = { number: 0, skip: 1, reverse: 2, draw2: 3, wild: 4, wild4: 5 };
const symbolOrder = (card: Card) => card.kind === 'number' ? card.value ?? 0 : 10 + (kindOrder[card.kind] ?? 6);

export function sortHand(cards: readonly Card[], order: HandSort): Card[] {
  return [...cards].sort((a, b) => order === 'color'
    ? colorOrder(a) - colorOrder(b) || symbolOrder(a) - symbolOrder(b)
    : symbolOrder(a) - symbolOrder(b) || colorOrder(a) - colorOrder(b));
}

export function initialHandOrder(cards: readonly Card[]): Card[] {
  return sortHand(cards, 'color');
}

export function moveHandCard(cards: readonly Card[], cardId: string, targetId: string): Card[] {
  const from = cards.findIndex(card => card.id === cardId);
  const to = cards.findIndex(card => card.id === targetId);
  const result = [...cards];
  if (from < 0 || to < 0 || from === to) return result;
  const [card] = result.splice(from, 1);
  result.splice(to, 0, card);
  return result;
}

export function appendNewCards(previous: readonly Card[], current: readonly Card[]): Card[] {
  const remaining = new Map(current.map(card => [card.id, card]));
  const ordered = previous.flatMap(card => {
    const present = remaining.get(card.id);
    remaining.delete(card.id);
    return present ? [present] : [];
  });
  return [...ordered, ...remaining.values()];
}
