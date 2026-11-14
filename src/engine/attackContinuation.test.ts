import { describe, expect, it } from 'vitest';
import { createGame } from './gameEngine';
import { gameReducer } from './gameReducer';
import { chooseCpuAction } from '../cpu/cpuEngine';
import { canPlayCard } from './cardValidator';
import { DEFAULT_SETTINGS, normalizeSettings } from '../types/rules';

function attack(kind: 'draw2' | 'wild4' = 'draw2', afterAttack = false) {
  let state = createGame({}, 42);
  state.turnPlayerId = 'p0'; state.viewerId = 'p0'; state.phase = 'normalTurn'; state.activeColor = 'red';
  state.discardPile = [{ id: 'top', kind: 'number', color: 'red', value: 5 }];
  state.players[0].hand = [{ id: 'attack', kind, color: kind === 'wild4' ? null : 'red' }, { id: 'keep', kind: 'number', color: 'blue', value: 8 }];
  state.players[1].hand = [{ id: 'response', kind: 'number', color: 'red', value: 7 }];
  state.settings.wild4ColorTiming = afterAttack ? 'afterAttack' : 'immediate';
  state = gameReducer(state, { type: 'PLAY_CARD', playerId: 'p0', cardId: 'attack', ...(kind === 'wild4' && !afterAttack ? { color: 'red' as const } : {}) });
  return state;
}

describe('optional normal turn after accepting a draw attack', () => {
  it.each(['draw2', 'wild4'] as const)('retains the original skipped turn for %s by default', kind => {
    const state = attack(kind);
    const after = gameReducer(state, { type: 'ACCEPT_DRAW_ATTACK', playerId: 'p1' });
    expect(after.turnPlayerId).toBe('p2'); expect(after.pendingAttack).toBeNull();
  });
  it.each(['draw2', 'wild4'] as const)('lets the target play normally after receiving %s when enabled', kind => {
    const state = attack(kind); state.settings.drawRules.continueAfterDraw = true;
    const beforeCount = state.players[1].hand.length;
    const after = gameReducer(state, { type: 'ACCEPT_DRAW_ATTACK', playerId: 'p1' });
    expect(after.players[1].hand).toHaveLength(beforeCount + (kind === 'draw2' ? 2 : 4));
    expect(after.turnPlayerId).toBe('p1'); expect(after.phase).toBe('normalTurn'); expect(after.pendingAttack).toBeNull();
    expect(canPlayCard(after, 'p1', after.players[1].hand.find(card => card.id === 'response')!)).toBe(true);
    const played = gameReducer(after, { type: 'PLAY_CARD', playerId: 'p1', cardId: 'response' });
    expect(played.discardPile.at(-1)?.id).toBe('response');
    const cpu = chooseCpuAction(after); expect(cpu).not.toBeNull(); expect(gameReducer(after, cpu!)).not.toBe(after);
  });
  it('finishes deferred color selection before returning to the target normal turn', () => {
    const state = attack('wild4', true); state.settings.drawRules.continueAfterDraw = true;
    const accepted = gameReducer(state, { type: 'ACCEPT_DRAW_ATTACK', playerId: 'p1' });
    expect(accepted.phase).toBe('selectingColor'); expect(accepted.turnPlayerId).toBe('p0');
    expect(accepted.colorSelection?.nextPlayerId).toBe('p1');
    const selected = gameReducer(accepted, { type: 'SELECT_COLOR', playerId: 'p0', color: 'blue' });
    expect(selected.turnPlayerId).toBe('p1'); expect(selected.activeColor).toBe('blue'); expect(selected.phase).toBe('normalTurn');
  });
  it('returns a reflected attack recipient to their normal turn', () => {
    let state = attack(); state.settings.drawRules.continueAfterDraw = true;
    state.players[1].hand.push({ id: 'reflect', kind: 'reverse', color: 'red' });
    state = gameReducer(state, { type: 'PLAY_CARD', playerId: 'p1', cardId: 'reflect' });
    state = gameReducer(state, { type: 'ACCEPT_DRAW_ATTACK', playerId: 'p0' });
    expect(state.turnPlayerId).toBe('p0'); expect(state.direction).toBe(-1); expect(state.phase).toBe('normalTurn');
  });
  it('continues after a transferred attack but does not extend a card cancellation', () => {
    let state = attack(); state.settings.drawRules.continueAfterDraw = true;
    state.players[1].hand.push({ id: 'transfer', kind: 'skip', color: 'red' });
    state = gameReducer(state, { type: 'PLAY_CARD', playerId: 'p1', cardId: 'transfer' });
    state = gameReducer(state, { type: 'ACCEPT_DRAW_ATTACK', playerId: 'p2' }); expect(state.turnPlayerId).toBe('p2');
    let cancel = attack(); cancel.settings.drawRules.continueAfterDraw = true; cancel.settings.drawRules.mode = 'cancel';
    cancel.players[1].hand.push({ id: 'cancel', kind: 'draw2', color: 'blue' });
    cancel = gameReducer(cancel, { type: 'PLAY_CARD', playerId: 'p1', cardId: 'cancel' });
    expect(cancel.turnPlayerId).toBe('p2'); expect(cancel.pendingAttack).toBeNull();
  });
  it('keeps ordinary draw-once-and-pass unchanged', () => {
    const state = createGame({}, 42); state.settings.drawRules.continueAfterDraw = true;
    state.phase = 'normalTurn'; state.turnPlayerId = 'p0'; state.viewerId = 'p0';
    const after = gameReducer(state, { type: 'DRAW_CARD', playerId: 'p0' });
    expect(after.turnPlayerId).toBe('p1');
  });
  it('settles an attacker win before offering the target another action', () => {
    let state = attack(); state.settings.drawRules.continueAfterDraw = true;
    state.players[0].hand = []; state.finishQueue = ['p0'];
    state = gameReducer(state, { type: 'ACCEPT_DRAW_ATTACK', playerId: 'p1' });
    expect(state.phase).toBe('gameOver'); expect(state.rankings).toEqual(['p0']);
  });
  it('continues in ranking games after removing a finished attacker', () => {
    let state = attack(); state.settings.gameMode = 'ranking'; state.settings.drawRules.continueAfterDraw = true;
    state.players[0].hand = []; state.finishQueue = ['p0'];
    state = gameReducer(state, { type: 'ACCEPT_DRAW_ATTACK', playerId: 'p1' });
    expect(state.rankings).toEqual(['p0']); expect(state.turnPlayerId).toBe('p1'); expect(state.phase).toBe('normalTurn');
  });
  it('completes a depleted attack and still offers a normal turn', () => {
    let state = attack(); state.settings.drawRules.continueAfterDraw = true;
    state.drawPile = []; state.discardPile = [state.discardPile.at(-1)!];
    state = gameReducer(state, { type: 'ACCEPT_DRAW_ATTACK', playerId: 'p1' });
    expect(state.pendingAttack).toBeNull(); expect(state.phase).toBe('normalTurn'); expect(state.turnPlayerId).toBe('p1');
  });
  it('normalizes older stored rule settings and persists an explicit enabled value', () => {
    const { continueAfterDraw: omitted, ...oldRules } = DEFAULT_SETTINGS.drawRules;
    expect(omitted).toBe(false);
    expect(normalizeSettings({ drawRules: oldRules as typeof DEFAULT_SETTINGS.drawRules }).drawRules.continueAfterDraw).toBe(false);
    expect(normalizeSettings({ drawRules: { ...DEFAULT_SETTINGS.drawRules, continueAfterDraw: true } }).drawRules.continueAfterDraw).toBe(true);
  });
});
