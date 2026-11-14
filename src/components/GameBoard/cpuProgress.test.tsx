// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GameBoard } from './GameBoard';
import { useGameStore } from '../../stores/gameStore';
import { createGame } from '../../engine/gameEngine';
import type { GameState } from '../../types/game';
import { PLACEMENT_DURATION } from '../CardMotion/useCardMotion';
import { DEFENSE_IMPACT_DURATION, DEFENSE_RESOLVE_DURATION } from '../ActionEffect/effectDescription';

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.spyOn(Math, 'random').mockReturnValue(.5);
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false, media: '', onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 100, 60, 90));
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount()); host.remove();
  useGameStore.setState({ game: null });
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
});

function finalPair() {
  const game = createGame({ gameMode: 'ranking', cpuDelay: 200 }, 42);
  game.phase = 'normalTurn'; game.turnPlayerId = 'p2'; game.viewerId = 'p0'; game.direction = -1;
  game.players[1].rank = 1; game.players[1].hand = [];
  game.players[3].rank = 2; game.players[3].hand = [];
  game.rankings = ['p1', 'p3']; game.turnCount = 70;
  game.discardPile = [{ id: 'top', kind: 'number', color: 'red', value: 3 }]; game.activeColor = 'red';
  return game;
}

async function mount(game: GameState) {
  useGameStore.setState({ game });
  await act(async () => root.render(<GameBoard onHelp={() => {}}/>));
}

async function nextTimer() { await act(async () => vi.advanceTimersToNextTimerAsync()); }

it('continues a CPU turn with one unplayable card after two players have finished', async () => {
  const game = finalPair();
  game.players[2].hand = [{ id: 'cpu-last', kind: 'number', color: 'green', value: 7 }];
  await mount(game);
  await nextTimer();
  expect(useGameStore.getState().game!.turnPlayerId).toBe('p0');
  expect(useGameStore.getState().game!.players[2].hand).toHaveLength(2);
});

it.each(['skip', 'reverse'] as const)('continues the CPU after a %s grants another turn in the final pair', async kind => {
  const game = finalPair();
  game.players[2].hand = [{ id: 'effect', kind, color: 'red' }, { id: 'cpu-last', kind: 'number', color: 'green', value: 7 }];
  await mount(game);
  for (let step = 0; step < 10 && useGameStore.getState().game!.turnPlayerId !== 'p0'; step++) await nextTimer();
  expect(useGameStore.getState().game!.turnPlayerId).toBe('p0');
  expect(useGameStore.getState().game!.players[2].hand).toHaveLength(2);
});

it.each(['number', 'wild', 'skip', 'reverse'] as const)('shows the final rankings after the last CPU plays a %s', async kind => {
  const game = finalPair();
  game.players[2].hand = [{ id: 'cpu-last', kind, color: kind === 'wild' ? null : 'red', ...(kind === 'number' ? { value: 9 } : {}) }];
  await mount(game);
  for (let step = 0; step < 12 && vi.getTimerCount(); step++) await nextTimer();
  const final = useGameStore.getState().game!;
  expect(final.phase).toBe('gameOver');
  expect(final.rankings).toEqual(['p1', 'p3', 'p2', 'p0']);
  expect(final.players[2].hand).toHaveLength(0);
  expect(host.querySelector('[aria-labelledby="result-title"]')).not.toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});

it('finishes defense feedback before requesting the deferred wild color', async () => {
  const game = createGame({ cpuDelay: 200, wild4ColorTiming: 'afterAttack' }, 42);
  game.settings.drawRules.mode = 'cancel'; game.phase = 'attackResponse'; game.turnPlayerId = 'p0'; game.viewerId = 'p0';
  game.pendingAttack = { amount: 8, attackColor: 'red', lastDrawType: 'wild4', targetPlayerId: 'p0', reflectCount: 0, transferCount: 0, lastWild4PlayerId: 'p1' };
  game.players[0].hand = [{ id: 'counter', kind: 'wild4', color: null }, { id: 'keep', kind: 'number', color: 'blue', value: 7 }];
  await mount(game);
  await act(async () => host.querySelector<HTMLButtonElement>('button[data-card-id="counter"]')!.click());
  expect(useGameStore.getState().game!.phase).toBe('selectingColor');
  await act(async () => vi.advanceTimersByTime(PLACEMENT_DURATION + 140));
  expect(host.querySelector('[data-defense-impact="true"]')).not.toBeNull();
  expect(host.querySelector('[aria-labelledby="color-title"]')).toBeNull();
  await act(async () => vi.advanceTimersByTime(DEFENSE_IMPACT_DURATION));
  expect(host.querySelector('[data-defense-impact="true"]')).toBeNull();
  expect(host.querySelector('[aria-labelledby="color-title"]')).toBeNull();
  await act(async () => vi.advanceTimersByTime(DEFENSE_RESOLVE_DURATION));
  expect(host.querySelector('[aria-labelledby="color-title"]')).not.toBeNull();
  expect(document.querySelector('[data-action-effect]')).toBeNull();
});

it.each([42, 139])('finishes an animated ranking game with CPU scheduling, seed %i', async seed => {
  const game = createGame({ gameMode: 'ranking', cpuDelay: 200 }, seed);
  game.players.forEach(player => { player.type = 'cpu'; });
  await mount(game);
  for (let step = 0; step < 2500 && useGameStore.getState().game!.phase !== 'gameOver'; step++) {
    const before = useGameStore.getState().game!;
    expect(vi.getTimerCount(), `No pending CPU/animation timer at turn ${before.turnCount}, ${before.phase}`).toBeGreaterThan(0);
    await nextTimer();
  }
  expect(useGameStore.getState().game!.phase).toBe('gameOver');
  expect(useGameStore.getState().game!.rankings).toHaveLength(4);
  for (let step = 0; step < 12 && vi.getTimerCount(); step++) await nextTimer();
  expect(host.querySelector('[aria-labelledby="result-title"]')).not.toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});
