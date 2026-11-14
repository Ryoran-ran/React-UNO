import { describe, expect, it } from 'vitest';
import { appendNewCards, initialHandOrder, moveHandCard, sortHand } from './handOrder';
import type { Card } from '../../types/card';
const cards: Card[] = [{ id: 'a', kind: 'number', color: 'red', value: 2 }, { id: 'b', kind: 'number', color: 'blue', value: 5 }];
describe('stable hand ordering during draws', () => {
  it('sorts the initial hand without mutating it', () => {
    expect(initialHandOrder(cards).map(card => card.id)).toEqual(['a', 'b']); expect(cards.map(card => card.id)).toEqual(['a', 'b']);
  });
  it('appends incoming cards without moving existing cards into a new color order', () => {
    const previous = initialHandOrder(cards);
    const incoming: Card = { id: 'new', kind: 'number', color: 'blue', value: 0 };
    expect(appendNewCards(previous, [...cards, incoming]).map(card => card.id)).toEqual(['a', 'b', 'new']);
    expect(previous.map(card => card.id)).toEqual(['a', 'b']);
  });
  it('removes played cards while retaining the remaining order', () => {
    expect(appendNewCards(initialHandOrder(cards), [cards[0]]).map(card => card.id)).toEqual(['a']);
  });
  it('sorts color first or number first, leaving action cards and wilds in a defined order', () => {
    const hand: Card[] = [
      { id: 'wild4', kind: 'wild4', color: null }, { id: 'green1', kind: 'number', color: 'green', value: 1 },
      { id: 'red9', kind: 'number', color: 'red', value: 9 }, { id: 'blue1', kind: 'number', color: 'blue', value: 1 },
      { id: 'wild', kind: 'wild', color: null }, { id: 'skip', kind: 'skip', color: 'red' },
      { id: 'draw2', kind: 'draw2', color: 'red' }, { id: 'reverse', kind: 'reverse', color: 'red' },
      { id: 'yellow0', kind: 'number', color: 'yellow', value: 0 },
    ];
    const original = [...hand];
    expect(sortHand(hand, 'color').map(card => card.id)).toEqual(['red9', 'skip', 'reverse', 'draw2', 'blue1', 'green1', 'yellow0', 'wild', 'wild4']);
    expect(sortHand(hand, 'number').map(card => card.id)).toEqual(['yellow0', 'blue1', 'green1', 'red9', 'skip', 'reverse', 'draw2', 'wild', 'wild4']);
    expect(hand).toEqual(original);
  });
  it('moves an individual card in both directions without dropping duplicates or mutating the hand', () => {
    const hand = [...cards, { id: 'c', kind: 'number' as const, color: 'red' as const, value: 2 }];
    expect(moveHandCard(hand, 'a', 'c').map(card => card.id)).toEqual(['b', 'c', 'a']);
    expect(moveHandCard(hand, 'c', 'a').map(card => card.id)).toEqual(['c', 'a', 'b']);
    expect(moveHandCard(hand, 'missing', 'a')).toEqual(hand);
    expect(hand.map(card => card.id)).toEqual(['a', 'b', 'c']);
  });
});
