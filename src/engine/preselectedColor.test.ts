import { describe, expect, it } from 'vitest';
import { createGame } from './gameEngine';
import { gameReducer } from './gameReducer';
import { canPlayCard } from './cardValidator';
import { prepareColorChoice } from '../components/ColorPicker/colorChoice';
import { playedCardBetween } from '../components/CardMotion/placement';
import type { Card, NormalColor } from '../types/card';
import type { GameState } from '../types/game';

function table(kind: 'wild' | 'wild4' = 'wild') {
  const state = createGame({}, 42);
  state.turnPlayerId = 'p0'; state.viewerId = 'p0'; state.phase = 'normalTurn'; state.activeColor = 'red';
  state.discardPile = [{ id: 'top', kind: 'number', color: 'red', value: 5 }];
  state.players[0].hand = [{ id: 'choose', kind, color: null }, { id: 'keep', kind: 'number', color: 'red', value: 2 }];
  return state;
}
const gameplay = (state: GameState) => ({ ...state, events: [], eventSequence: 0 });

describe('choosing color before committing a play', () => {
  it('preparing or abandoning a choice leaves hands, turn, attack and pile untouched', () => {
    const state = table('wild4'); const before = structuredClone(state);
    const choice = prepareColorChoice(state, { type: 'PLAY_CARD', playerId: 'p0', cardId: 'choose' });
    expect(choice?.card.id).toBe('choose');
    expect(state).toEqual(before); expect(state.pendingAttack).toBeNull();
    expect(state.players[0].hand).toHaveLength(2); expect(state.discardPile).toHaveLength(1);
    expect(state.events.some(event => event.type === 'uno')).toBe(false);
  });
  it.each(['wild', 'wild4'] as const)('commits %s and the chosen color as one validated action', kind => {
    const state = table(kind);
    const after = gameReducer(state, { type: 'PLAY_CARD', playerId: 'p0', cardId: 'choose', color: 'blue' });
    expect(after.activeColor).toBe('blue'); expect(after.players[0].hand).toHaveLength(1);
    expect(after.discardPile.at(-1)?.id).toBe('choose'); expect(after.colorSelection).toBeNull();
    expect(after.phase).toBe(kind === 'wild' ? 'normalTurn' : 'attackResponse'); expect(after.turnPlayerId).toBe('p1');
    expect(after.events.filter(event => event.type === 'uno')).toHaveLength(1);
    expect(playedCardBetween(state, after, 'p0')?.card.id).toBe('choose');
    const played = gameReducer(state, { type: 'PLAY_CARD', playerId: 'p0', cardId: 'choose' });
    const twoSteps = gameReducer(played, { type: 'SELECT_COLOR', playerId: 'p0', color: 'blue' });
    expect(gameplay(after)).toEqual(gameplay(twoSteps));
  });
  it('allows a different card after the user abandons a wild choice', () => {
    const state = table(); prepareColorChoice(state, { type: 'PLAY_CARD', playerId: 'p0', cardId: 'choose' });
    const after = gameReducer(state, { type: 'PLAY_CARD', playerId: 'p0', cardId: 'keep' });
    expect(after.players[0].hand.map(card => card.id)).toEqual(['choose']); expect(after.discardPile.at(-1)?.id).toBe('keep');
  });
  it('uses the preselected attack color for reflection legality', () => {
    const state = table('wild4');
    const blue: Card = { id: 'blue-reverse', kind: 'reverse', color: 'blue' };
    const red: Card = { id: 'red-reverse', kind: 'reverse', color: 'red' };
    state.players[1].hand = [blue, red];
    const after = gameReducer(state, { type: 'PLAY_CARD', playerId: 'p0', cardId: 'choose', color: 'blue' });
    expect(after.pendingAttack?.attackColor).toBe('blue');
    expect(canPlayCard(after, 'p1', blue)).toBe(true); expect(canPlayCard(after, 'p1', red)).toBe(false);
    const reflected = gameReducer(after, { type: 'PLAY_CARD', playerId: 'p1', cardId: blue.id });
    expect(reflected.pendingAttack?.targetPlayerId).toBe('p0');
  });
  it.each(['stack', 'cancel'] as const)('confirms a +4 response with preselected color in %s mode', mode => {
    let state = table('wild4'); state.settings.drawRules.mode = mode;
    state.players[1].type = 'human';
    state.players[1].hand.push({ id: 'response', kind: 'wild4', color: null });
    state = gameReducer(state, { type: 'PLAY_CARD', playerId: 'p0', cardId: 'choose', color: 'blue' });
    expect(prepareColorChoice(state, { type: 'PLAY_CARD', playerId: 'p1', cardId: 'response' })).not.toBeNull();
    const after = gameReducer(state, { type: 'PLAY_CARD', playerId: 'p1', cardId: 'response', color: 'green' });
    expect(after.activeColor).toBe('green'); expect(after.turnPlayerId).toBe('p2'); expect(after.colorSelection).toBeNull();
    expect(after.pendingAttack?.amount ?? 0).toBe(mode === 'stack' ? 8 : 0);
  });
  it('waits for the selected color before confirming a final wild-card win', () => {
    const state = table(); state.players[0].hand = [state.players[0].hand[0]];
    prepareColorChoice(state, { type: 'PLAY_CARD', playerId: 'p0', cardId: 'choose' });
    expect(state.rankings).toEqual([]); expect(state.phase).toBe('normalTurn');
    const after = gameReducer(state, { type: 'PLAY_CARD', playerId: 'p0', cardId: 'choose', color: 'yellow' });
    expect(after.phase).toBe('gameOver'); expect(after.activeColor).toBe('yellow'); expect(after.rankings).toEqual(['p0']);
  });
  it('rejects invalid colors and colors attached to ordinary cards without mutation', () => {
    const state = table();
    expect(gameReducer(state, { type: 'PLAY_CARD', playerId: 'p0', cardId: 'choose', color: 'purple' as NormalColor })).toBe(state);
    expect(gameReducer(state, { type: 'PLAY_CARD', playerId: 'p0', cardId: 'keep', color: 'red' })).toBe(state);
    expect(gameReducer(state, { type: 'PLAY_CARD', playerId: 'p1', cardId: 'choose', color: 'red' })).toBe(state);
  });
  it('preserves deferred +4 and mandatory post-draw color selection rules', () => {
    const deferred = table('wild4'); deferred.settings.wild4ColorTiming = 'afterAttack';
    expect(prepareColorChoice(deferred, { type: 'PLAY_CARD', playerId: 'p0', cardId: 'choose' })).toBeNull();
    expect(gameReducer(deferred, { type: 'PLAY_CARD', playerId: 'p0', cardId: 'choose', color: 'blue' })).toBe(deferred);
    const played = gameReducer(deferred, { type: 'PLAY_CARD', playerId: 'p0', cardId: 'choose' });
    const accepted = gameReducer(played, { type: 'ACCEPT_DRAW_ATTACK', playerId: 'p1' });
    expect(accepted.phase).toBe('selectingColor'); expect(accepted.turnPlayerId).toBe('p0');
    const draw = table(); draw.settings.drawBehavior = 'drawUntilPlayable'; draw.drawPile = [{ id: 'drawn', kind: 'wild', color: null }];
    expect(prepareColorChoice(draw, { type: 'DRAW_CARD', playerId: 'p0' })).toBeNull();
    expect(gameReducer(draw, { type: 'DRAW_CARD', playerId: 'p0' }).phase).toBe('selectingColor');
  });
  it('does not prompt for CPU plays, illegal plays, or already chosen colors', () => {
    const state = table();
    expect(prepareColorChoice(state, { type: 'PLAY_CARD', playerId: 'p0', cardId: 'keep' })).toBeNull();
    expect(prepareColorChoice(state, { type: 'PLAY_CARD', playerId: 'p1', cardId: 'choose' })).toBeNull();
    expect(prepareColorChoice(state, { type: 'PLAY_CARD', playerId: 'p0', cardId: 'choose', color: 'red' })).toBeNull();
    state.players[0].type = 'cpu'; expect(prepareColorChoice(state, { type: 'PLAY_CARD', playerId: 'p0', cardId: 'choose' })).toBeNull();
  });
});
