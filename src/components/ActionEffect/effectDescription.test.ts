import { describe, expect, it } from 'vitest';
import { createGame } from '../../engine/gameEngine';
import { gameReducer } from '../../engine/gameReducer';
import { actionEffectBetween } from './effectDescription';
import type { GameState } from '../../types/game';

function table(count = 4) {
  const state = createGame({ playerCount: count }, 42);
  state.phase = 'normalTurn'; state.turnPlayerId = 'p0'; state.viewerId = 'p0'; state.activeColor = 'red';
  state.discardPile = [{ id: 'top', kind: 'number', color: 'red', value: 5 }];
  state.players[0].hand = [{ id: 'skip', kind: 'skip', color: 'red' }, { id: 'reverse', kind: 'reverse', color: 'red' }, { id: 'keep', kind: 'number', color: 'blue', value: 4 }];
  return state;
}
function play(state: GameState, id: string) { return gameReducer(state, { type: 'PLAY_CARD', playerId: state.turnPlayerId, cardId: id }); }

describe('special-card feedback follows the actual resolved play', () => {
  it.each([1, -1] as const)('names the skipped player in direction %i', direction => {
    const before = table(); before.direction = direction;
    const after = play(before, 'skip'); const effect = actionEffectBetween(before, after, 'p0')!;
    expect(effect.kind).toBe('skip'); expect(effect.targetId).toBe(direction === 1 ? 'p1' : 'p3');
    expect(effect.detail).toContain(before.players[direction === 1 ? 1 : 3].name); expect(effect.targetLabel).toBe('お休み');
    expect(after.turnPlayerId).toBe('p2');
  });
  it('excludes already finished players from the skipped target', () => {
    const before = table(); before.players[1].rank = 1; before.rankings = ['p1'];
    const after = play(before, 'skip'); expect(actionEffectBetween(before, after, 'p0')?.targetId).toBe('p2');
  });
  it.each([1, -1] as const)('shows the new reverse direction from %i', direction => {
    const before = table(); before.direction = direction;
    const after = play(before, 'reverse'); const effect = actionEffectBetween(before, after, 'p0')!;
    expect(effect.kind).toBe('reverse'); expect(effect.direction).toBe(-direction); expect(effect.targetId).toBe(after.turnPlayerId);
    expect(effect.detail).toContain(direction === 1 ? '反時計回り' : '時計回り');
  });
  it('makes the repeated turn explicit for two-player reverse', () => {
    const before = table(2); const after = play(before, 'reverse'); const effect = actionEffectBetween(before, after, 'p0')!;
    expect(effect.targetId).toBe('p0'); expect(effect.targetLabel).toBe('もう一度'); expect(effect.detail).toContain('もう一度');
  });
  it('also handles the final two active players in ranking games', () => {
    const before = table(); before.players[1].rank = 1; before.players[3].rank = 2; before.rankings = ['p1', 'p3'];
    const after = play(before, 'reverse'); expect(actionEffectBetween(before, after, 'p0')?.targetLabel).toBe('もう一度');
  });
  it.each(['skip', 'reverse'] as const)('distinguishes attack response %s from its normal effect', kind => {
    const before = table(); before.phase = 'attackResponse';
    before.pendingAttack = { amount: 8, attackColor: 'red', lastDrawType: 'wild4', targetPlayerId: 'p0', reflectCount: 0, transferCount: 0, lastWild4PlayerId: 'p3' };
    const after = play(before, kind); const effect = actionEffectBetween(before, after, 'p0')!;
    expect(effect.kind).toBe(kind === 'skip' ? 'transfer' : 'reflect'); expect(effect.targetId).toBe(kind === 'skip' ? 'p1' : 'p3');
    expect(effect.detail).toContain('+8'); expect(effect.detail).toContain(after.players.find(player => player.id === effect.targetId)!.name);
    expect(effect.targetLabel).toBe('反撃の番'); expect(after.pendingAttack?.amount).toBe(8);
    expect(effect.defense).toBe(kind === 'skip' ? 'transfer' : 'reflect');
    expect(effect.card.id).toBe(kind);
  });
  it.each(['stack', 'cancel'] as const)('describes a successful %s defense using the resolved penalty', mode => {
    const before = table(); before.phase = 'attackResponse'; before.settings.drawRules.mode = mode;
    before.pendingAttack = { amount: 6, attackColor: 'red', lastDrawType: 'draw2', targetPlayerId: 'p0', reflectCount: 0, transferCount: 0, lastWild4PlayerId: null };
    before.players[0].hand.push({ id: 'defense-draw', kind: 'draw2', color: 'blue' });
    const after = play(before, 'defense-draw'); const snapshot = structuredClone(after);
    const effect = actionEffectBetween(before, after, 'p0')!;
    expect(effect.kind).toBe(mode); expect(effect.defense).toBe(mode);
    expect(effect.card.id).toBe('defense-draw'); expect(effect.detail).toContain('+6');
    if (mode === 'stack') {
      expect(effect.detail).toContain('+8'); expect(effect.targetId).toBe('p1');
    } else {
      expect(effect.targetId).toBeNull(); expect(after.pendingAttack).toBeNull();
    }
    expect(after).toEqual(snapshot);
  });
  it('does not fabricate an effect for an illegal defense, color choice, or unrelated card', () => {
    const before = table(); before.phase = 'attackResponse';
    before.pendingAttack = { amount: 2, attackColor: 'blue', lastDrawType: 'draw2', targetPlayerId: 'p0', reflectCount: 0, transferCount: 0, lastWild4PlayerId: null };
    const rejected = play(before, 'skip'); expect(actionEffectBetween(before, rejected, 'p0')).toBeNull();
    const normal = table(); normal.players[0].hand.push({ id: 'number', kind: 'number', color: 'red', value: 2 });
    expect(actionEffectBetween(normal, play(normal, 'number'), 'p0')).toBeNull();
  });
  it('works for an automatically played special card without modifying either game state', () => {
    const before = table(); before.settings.drawBehavior = 'drawUntilPlayable'; before.drawPile = [{ id: 'drawn-skip', kind: 'skip', color: 'red' }];
    const after = gameReducer(before, { type: 'DRAW_CARD', playerId: 'p0' });
    const snapshot = structuredClone(after); expect(actionEffectBetween(before, after, 'p0')?.kind).toBe('skip'); expect(after).toEqual(snapshot);
  });
  it('does not claim a new turn after a final reverse wins the game', () => {
    const before = table(); before.players[0].hand = [before.players[0].hand[1]];
    const after = play(before, 'reverse'); expect(after.phase).toBe('gameOver'); expect(actionEffectBetween(before, after, 'p0')?.targetId).toBeNull();
  });
});
