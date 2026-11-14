import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createGame } from '../engine/gameEngine';
import { gameReducer } from '../engine/gameReducer';
import { PlayerArea } from './PlayerArea/PlayerArea';
import { PlayerHand } from './PlayerHand/PlayerHand';
import { Card } from './Card/Card';
import { observeForCpu, chooseCpuAction } from '../cpu/cpuEngine';
import type { NormalColor } from '../types/card';

describe('actual rendered hands and CPU information boundaries', () => {
  it.each(['hidden', 'all', 'cpu'] as const)('renders only permitted opponent card faces in %s', visibility => {
    const state = createGame({ handVisibility: visibility }, 12);
    state.players[1].hand = [{ id: 'secret', color: 'blue', kind: 'number', value: 8 }];
    const html = renderToStaticMarkup(<PlayerArea state={state} player={state.players[1]} index={1}/>);
    expect(html.includes('aria-label="青 8"')).toBe(visibility !== 'hidden');
    state.players[1].type = 'human';
    const humanHtml = renderToStaticMarkup(<PlayerArea state={state} player={state.players[1]} index={1}/>);
    expect(humanHtml.includes('aria-label="青 8"')).toBe(visibility === 'all');
  });
  it('does not render previous human hand faces under the handoff screen', () => {
    const state = createGame({ playerCount: 2, humanPlayerCount: 2 }, 4);
    state.phase = 'playerHandoff'; state.viewerId = 'p0';
    const html = renderToStaticMarkup(<PlayerHand state={state} dispatch={() => {}}/>);
    expect(html).not.toContain('を出す'); expect(html).not.toContain('<button');
    for (const player of state.players) expect(renderToStaticMarkup(<PlayerArea state={state} player={player} index={0}/>)).not.toContain('aria-label="赤 ');
  });
  it('does not pass the backing card to a hidden card DOM', () => {
    const html = renderToStaticMarkup(<Card card={{ id: 'secret', kind: 'wild4', color: null }} hidden/>);
    expect(html).not.toContain('+4'); expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('secret'); expect(html).not.toContain('data-card-id');
  });
  it('shows UNO above the owner hand without exposing hidden hand faces', () => {
    const state = createGame({}, 9); state.viewerId = 'p0'; state.phase = 'normalTurn';
    const hand = renderToStaticMarkup(<PlayerHand state={state} dispatch={() => {}} uno/>);
    expect(hand).toContain('UNO!'); expect(hand).toContain('data-player-id="p0"');
    const opponent = renderToStaticMarkup(<PlayerArea state={state} player={state.players[1]} index={1} uno/>);
    expect(opponent).toContain('UNO!'); expect(opponent).not.toContain('data-card-id');
    state.phase = 'playerHandoff'; expect(renderToStaticMarkup(<PlayerHand state={state} dispatch={() => {}} uno/>)).not.toContain('UNO!');
  });
  it('keeps every human hand visible in all-public mode even if a CPU starts', () => {
    const state = createGame({ humanPlayerCount: 2, handVisibility: 'all' }, 9);
    expect(state.viewerId).not.toBeNull();
  });
  it('renders every public face even if a player holds more than 30 cards', () => {
    const state = createGame({ handVisibility: 'all' }, 9);
    state.players[1].hand = Array.from({ length: 40 }, (_, i) => ({ id: `many-${i}`, color: 'yellow' as const, kind: 'number', value: i % 10 }));
    const html = renderToStaticMarkup(<PlayerArea state={state} player={state.players[1]} index={1}/>);
    expect((html.match(/aria-label="黄 /g) ?? []).length).toBe(40);
  });
  it.each(['easy', 'normal', 'hard'] as const)('CPU %s never uses hidden opponent card values', difficulty => {
    const state = createGame({ cpuDifficulty: difficulty, handVisibility: 'hidden' }, 19);
    state.turnPlayerId = 'p1'; state.phase = 'normalTurn';
    const action = chooseCpuAction(state, 0.3);
    const modified = structuredClone(state);
    modified.players[0].hand = state.players[0].hand.map(c => ({ ...c, color: 'red' as NormalColor, kind: 'reverse' }));
    expect(observeForCpu(modified, 'p1').others.every(p => !p.hand)).toBe(true);
    expect(chooseCpuAction(modified, 0.3)).toEqual(action);
    expect(gameReducer(state, action!)).not.toBe(state);
  });
});
