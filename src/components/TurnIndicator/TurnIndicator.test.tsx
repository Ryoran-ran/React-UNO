import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createGame } from '../../engine/gameEngine';
import { PlayerArea } from '../PlayerArea/PlayerArea';
import { PlayerHand } from '../PlayerHand/PlayerHand';
import { TurnIndicator } from './TurnIndicator';
import { getTurnPresentation } from './turnPresentation';

function table(count = 4) {
  const state = createGame({ playerCount: count }, 42);
  state.phase = 'normalTurn'; state.turnPlayerId = 'p0'; state.viewerId = 'p0';
  return state;
}

describe('clear, phase-aware turn cues', () => {
  it('announces the viewer turn prominently and marks their hand', () => {
    const state = table();
    const html = renderToStaticMarkup(<TurnIndicator state={state} paused={false} choosingColor={false}/>);
    expect(html.replace(/<[^>]*>/g, '')).toContain('あなたの番'); expect(html).toContain('role="status"');
    const hand = renderToStaticMarkup(<PlayerHand state={state} dispatch={() => {}}/>);
    expect(hand).toContain('あなたの番'); expect(hand).toContain('aria-current="step"');
  });
  it('names the current CPU and distinguishes thinking from a human turn', () => {
    const state = table(); state.turnPlayerId = 'p1';
    const presentation = getTurnPresentation(state);
    expect(presentation.title).toBe(`${state.players[1].name}の番`); expect(presentation.detail).toContain('CPUが考えています');
    expect(presentation.self).toBe(false);
  });
  it.each([2, 3, 4, 5, 6, 7, 8])('marks exactly one visible seat or own hand with %i players', count => {
    const state = table(count);
    for (const current of state.players) {
      state.turnPlayerId = current.id;
      const seats = state.players.filter(player => player.id !== state.viewerId).map((player, index) => renderToStaticMarkup(<PlayerArea state={state} player={player} index={index}/>)).join('');
      const hand = renderToStaticMarkup(<PlayerHand state={state} dispatch={() => {}}/>);
      expect((`${seats}${hand}`.match(/aria-current="step"/g) ?? []).length).toBe(1);
      if (current.id !== state.viewerId) expect(seats).toContain('現在の手番');
    }
  });
  it('makes an incoming penalty explicit and labels the responding seat', () => {
    const state = table(); state.phase = 'attackResponse';
    state.pendingAttack = { amount: 8, attackColor: 'red', lastDrawType: 'wild4', targetPlayerId: 'p0', reflectCount: 0, transferCount: 0, lastWild4PlayerId: 'p3' };
    expect(getTurnPresentation(state).detail).toContain('+8の攻撃');
    expect(getTurnPresentation(state).detail).toContain('反撃かドローを選ぶ');
    expect(renderToStaticMarkup(<PlayerHand state={state} dispatch={() => {}}/>)).toContain('反撃中');
  });
  it('distinguishes color selection, modal pauses and human handoff', () => {
    const state = table(); const snapshot = structuredClone(state);
    expect(getTurnPresentation(state, false, true).detail).toContain('色を選んでください');
    expect(getTurnPresentation(state, true).detail).toContain('一時停止');
    expect(state).toEqual(snapshot);
    state.phase = 'selectingColor'; expect(getTurnPresentation(state).detail).toContain('色を選んでください');
    state.phase = 'playerHandoff'; state.turnPlayerId = 'p1'; state.players[1].type = 'human';
    expect(getTurnPresentation(state).title).toBe(`${state.players[1].name}の番`);
    expect(getTurnPresentation(state).detail).toContain('端末を渡してください');
  });
  it('clears turn markings once the game is over', () => {
    const state = table(); state.phase = 'gameOver';
    expect(getTurnPresentation(state).title).toBe('対戦終了');
    for (const [index, player] of state.players.entries()) expect(renderToStaticMarkup(<PlayerArea state={state} player={player} index={index}/>)).not.toContain('aria-current="step"');
    expect(renderToStaticMarkup(<PlayerHand state={state} dispatch={() => {}}/>)).not.toContain('aria-current="step"');
  });
});
