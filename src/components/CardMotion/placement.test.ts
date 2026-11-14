import { describe, expect, it } from 'vitest';
import { createGame } from '../../engine/gameEngine';
import { gameReducer } from '../../engine/gameReducer';
import { cardTilt, playedCardBetween } from './placement';
import type { Card } from '../../types/card';

function table() {
  const state = createGame({}, 42);
  state.phase = 'normalTurn'; state.turnPlayerId = 'p0'; state.activeColor = 'red';
  state.discardPile = [{ id: 'table', kind: 'number', color: 'red', value: 5 }];
  state.players[0].hand = [{ id: 'hand', kind: 'number', color: 'red', value: 7 }, { id: 'keep', kind: 'number', color: 'blue', value: 2 }];
  return state;
}

describe('card placement observes public plays without affecting the engine', () => {
  it('animates a completed play by its actual player, never another player', () => {
    const before = table();
    const after = gameReducer(before, { type: 'PLAY_CARD', playerId: 'p0', cardId: 'hand' });
    expect(playedCardBetween(before, after, 'p0')?.card.id).toBe('hand');
    expect(playedCardBetween(before, after, 'p1')).toBeNull();
    expect(before.players[0].hand).toHaveLength(2);
  });
  it('does not show a private card when drawing once or rejecting a play', () => {
    const before = table();
    const drawn = gameReducer(before, { type: 'DRAW_CARD', playerId: 'p0' });
    expect(playedCardBetween(before, drawn, 'p0')).toBeNull();
    const invalid = gameReducer(before, { type: 'PLAY_CARD', playerId: 'p0', cardId: 'keep' });
    expect(playedCardBetween(before, invalid, 'p0')).toBeNull();
  });
  it('animates an automatically played draw, but does not replay its color selection', () => {
    const before = table(); before.settings.drawBehavior = 'drawUntilPlayable';
    before.drawPile = [{ id: 'new-wild', kind: 'wild', color: null }];
    const played = gameReducer(before, { type: 'DRAW_CARD', playerId: 'p0' });
    expect(playedCardBetween(before, played, 'p0')?.card.id).toBe('new-wild');
    const colored = gameReducer(played, { type: 'SELECT_COLOR', playerId: 'p0', color: 'green' });
    expect(playedCardBetween(played, colored, 'p0')).toBeNull();
  });
  it('animates a public CPU play even though its remaining hand is hidden', () => {
    const before = table(); before.turnPlayerId = 'p1';
    const cpuCard: Card = { id: 'cpu-play', kind: 'number', color: 'red', value: 3 };
    before.players[1].hand = [cpuCard, ...before.players[1].hand];
    const after = gameReducer(before, { type: 'PLAY_CARD', playerId: 'p1', cardId: cpuCard.id });
    expect(playedCardBetween(before, after, 'p1')?.card).toEqual(cpuCard);
  });
  it('does not animate initial dealing or a restart as a placement', () => {
    const before = table();
    expect(playedCardBetween(before, createGame({}, 100), 'p0')).toBeNull();
  });
  it('keeps the landing angle deterministic, bounded, and varied across cards', () => {
    const angles = Array.from({ length: 108 }, (_, i) => cardTilt(`card-${i}`));
    expect(angles.every(angle => Math.abs(angle) <= 7)).toBe(true);
    expect(new Set(angles).size).toBeGreaterThan(8);
    expect(cardTilt('card-42')).toBe(cardTilt('card-42'));
  });
});
