// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GameBoard } from '../GameBoard/GameBoard';
import { useGameStore } from '../../stores/gameStore';
import { createGame } from '../../engine/gameEngine';
import { gameReducer } from '../../engine/gameReducer';
import { COLOR_NAMES } from '../../types/card';
import type { GameState } from '../../types/game';
import { DRAW_DURATION, PLACEMENT_DURATION } from '../CardMotion/useCardMotion';
import { DEFENSE_IMPACT_DURATION, DEFENSE_RESOLVE_DURATION } from '../ActionEffect/effectDescription';
import { COLOR_NOTICE_DURATION } from './colorTransition';

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  vi.useFakeTimers(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
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

function table(kind: 'wild' | 'wild4' = 'wild') {
  const game = createGame({}, 42);
  game.turnPlayerId = 'p0'; game.phase = 'normalTurn'; game.viewerId = 'p0'; game.activeColor = 'red';
  game.discardPile = [{ id: 'top', kind: 'number', color: 'red', value: 5 }];
  game.players[0].hand = [{ id: 'wild-card', kind, color: null }, { id: 'keep', kind: 'number', color: 'green', value: 9 }];
  return game;
}
async function mount(game: GameState) {
  useGameStore.setState({ game });
  await act(async () => root.render(<GameBoard onHelp={() => {}}/>));
}
async function time(ms: number) { await act(async () => vi.advanceTimersByTime(ms)); }
async function click(selector: string) { await act(async () => host.querySelector<HTMLButtonElement>(selector)!.click()); }
const active = () => host.querySelector('[data-active-color]')?.getAttribute('data-active-color');
const notice = () => host.querySelector('[data-color-announcement]');
async function chooseBlue() { await click('button[data-card-id="wild-card"]'); await click('button[aria-label="青にしてカードを出す"]'); }

it.each(['red', 'blue'] as const)('reveals a manual %s choice on landing and keeps the selected wild color visible afterwards', async color => {
  await mount(table());
  await click('button[data-card-id="wild-card"]');
  await click('button[aria-label="色選択を取り消す"]');
  expect(active()).toBe('red'); expect(notice()).toBeNull();
  await click('button[data-card-id="wild-card"]');
  await click(`button[aria-label="${COLOR_NAMES[color]}にしてカードを出す"]`);
  expect(useGameStore.getState().game!.activeColor).toBe(color);
  expect(active()).toBe('red'); expect(notice()).toBeNull();
  expect(host.querySelector('[data-wild-color]')).toBeNull();
  await time(PLACEMENT_DURATION + 140);
  expect(active()).toBe(color); expect(notice()?.getAttribute('data-color-announcement')).toBe(color);
  expect(notice()?.textContent).toContain(color === 'red' ? '赤を継続' : '青に変更');
  expect(host.querySelector('[data-wild-color]')?.getAttribute('data-wild-color')).toBe(color);
  const committed = useGameStore.getState().game;
  await time(COLOR_NOTICE_DURATION - 1);
  expect(notice()).not.toBeNull(); expect(useGameStore.getState().game).toBe(committed);
  await time(1);
  expect(notice()).toBeNull(); expect(active()).toBe(color);
  expect(host.querySelector('[data-wild-color]')?.getAttribute('data-wild-color')).toBe(color);
});

it('shows the CPU selection wait before announcing its chosen color', async () => {
  const game = table(); game.turnPlayerId = 'p1'; game.settings.cpuDelay = 200;
  game.players[1].hand = game.players[0].hand; game.players[0].hand = [{ id: 'human', kind: 'number', color: 'blue', value: 2 }];
  await mount(game);
  await time(200);
  expect(useGameStore.getState().game!.phase).toBe('selectingColor'); expect(notice()).toBeNull(); expect(active()).toBe('red');
  await time(PLACEMENT_DURATION + 140);
  expect(active()).toBe('pending'); expect(host.textContent).toContain('次の色を選択中');
  expect(host.querySelector('[data-wild-color]')).toBeNull();
  await time(200);
  expect(active()).toBe('green'); expect(notice()?.textContent).toContain('緑に変更');
  const committed = useGameStore.getState().game;
  await time(COLOR_NOTICE_DURATION - 1);
  expect(useGameStore.getState().game).toBe(committed);
  await time(1); expect(notice()).toBeNull();
});

it('explains deferred +4 color timing and waits until the penalty is drawn', async () => {
  const game = table('wild4'); game.settings.wild4ColorTiming = 'afterAttack'; game.settings.cpuDelay = 200;
  game.players[1].hand = [{ id: 'cpu-number', kind: 'number', color: 'blue', value: 2 }];
  const attacked = gameReducer(game, { type: 'PLAY_CARD', playerId: 'p0', cardId: 'wild-card' });
  await mount(attacked);
  expect(host.textContent).toContain('色指定は攻撃後'); expect(active()).toBe('red'); expect(notice()).toBeNull();
  await time(200);
  expect(host.querySelector('[aria-labelledby="color-title"]')).toBeNull();
  await time(DRAW_DURATION + 3 * 55 + 140);
  expect(host.querySelector('[aria-labelledby="color-title"]')).not.toBeNull(); expect(active()).toBe('pending');
  await click('button[aria-label="青を指定"]');
  expect(active()).toBe('blue'); expect(notice()?.textContent).toContain('青に変更');
});

it('keeps readable color feedback with motion disabled', async () => {
  const game = table(); game.settings.reducedMotion = true;
  await mount(game); await chooseBlue();
  expect(active()).toBe('blue'); expect(notice()?.textContent).toContain('青に変更');
  await time(COLOR_NOTICE_DURATION); expect(notice()).toBeNull();
});

it('also switches an ordinary card color on landing without announcing a wild selection', async () => {
  const game = table();
  game.players[0].hand = [{ id: 'color-card', kind: 'number', color: 'blue', value: 5 }, { id: 'keep', kind: 'number', color: 'green', value: 9 }];
  await mount(game); await click('button[data-card-id="color-card"]');
  expect(useGameStore.getState().game!.activeColor).toBe('blue'); expect(active()).toBe('red');
  await time(PLACEMENT_DURATION + 140);
  expect(active()).toBe('blue'); expect(notice()).toBeNull();
});

it('settles on the committed color when a viewport change cancels the flight', async () => {
  await mount(table()); await chooseBlue(); expect(active()).toBe('red');
  await act(async () => window.dispatchEvent(new Event('resize')));
  expect(active()).toBe('blue'); expect(notice()).toBeNull();
  await time(PLACEMENT_DURATION + 140); expect(active()).toBe('blue'); expect(notice()).toBeNull();
});

it.each(['stack', 'cancel'] as const)('announces the wild4 color after the %s defense finishes its impact', async mode => {
  const game = table('wild4'); game.phase = 'attackResponse'; game.settings.drawRules.mode = mode;
  game.pendingAttack = { amount: 4, attackColor: 'red', lastDrawType: 'wild4', targetPlayerId: 'p0', reflectCount: 0, transferCount: 0, lastWild4PlayerId: 'p3' };
  await mount(game); await chooseBlue();
  expect(active()).toBe('red');
  await time(PLACEMENT_DURATION + 140);
  expect(active()).toBe('blue'); expect(document.querySelector('[data-effect-stage="impact"]')).not.toBeNull(); expect(notice()).toBeNull();
  await time(DEFENSE_IMPACT_DURATION);
  expect(document.querySelector('[data-effect-stage="resolve"]')).not.toBeNull(); expect(notice()).toBeNull();
  await time(DEFENSE_RESOLVE_DURATION);
  expect(document.querySelector('[data-action-effect]')).toBeNull(); expect(notice()?.textContent).toContain('青に変更');
  await time(COLOR_NOTICE_DURATION); expect(notice()).toBeNull();
});
