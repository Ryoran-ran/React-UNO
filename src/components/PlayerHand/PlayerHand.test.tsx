// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PlayerHand } from './PlayerHand';
import { GameBoard } from '../GameBoard/GameBoard';
import { createGame } from '../../engine/gameEngine';
import { useGameStore } from '../../stores/gameStore';
import type { GameAction, GameState } from '../../types/game';

let root: Root;
let host: HTMLDivElement;
let dispatch: ReturnType<typeof vi.fn<(action: GameAction) => void>>;
beforeEach(() => {
  vi.useFakeTimers(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false, media: '', onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(this: HTMLElement) {
    if (this.hasAttribute('data-card-id') && this.parentElement?.hasAttribute('data-card-source')) {
      const siblings = [...this.parentElement.querySelectorAll('[data-card-id]')];
      return new DOMRect(50 + siblings.indexOf(this) * 60, this.closest('[data-expanded-hand]') ? 100 : 300, 60, 90);
    }
    return new DOMRect(50, 280, 450, 110);
  });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host); dispatch = vi.fn<(action: GameAction) => void>();
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); useGameStore.setState({ game: null });
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
});
function table() {
  const game = createGame({}, 42); game.turnPlayerId = 'p0'; game.viewerId = 'p0'; game.phase = 'normalTurn'; game.activeColor = 'red';
  game.discardPile = [{ id: 'top', kind: 'number', color: 'red', value: 5 }];
  game.players[0].hand = [
    { id: 'wild4', kind: 'wild4', color: null }, { id: 'g1', kind: 'number', color: 'green', value: 1 },
    { id: 'r8', kind: 'number', color: 'red', value: 8 }, { id: 'b2', kind: 'number', color: 'blue', value: 2 },
    { id: 'wild', kind: 'wild', color: null }, { id: 'rskip', kind: 'skip', color: 'red' }, { id: 'y7', kind: 'number', color: 'yellow', value: 7 },
  ];
  return game;
}
const colorOrder = ['r8', 'rskip', 'b2', 'g1', 'y7', 'wild', 'wild4'];
const numberOrder = ['g1', 'b2', 'y7', 'r8', 'rskip', 'wild', 'wild4'];
function hand(scope: ParentNode = host) { return scope.querySelector<HTMLElement>('[data-player-id="p0"] [data-card-source]')!; }
function ids(scope: ParentNode = host) { return [...hand(scope).querySelectorAll<HTMLElement>('[data-card-id]')].map(card => card.dataset.cardId); }
async function clickText(text: string, scope: ParentNode = document) {
  const button = [...scope.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.startsWith(text));
  expect(button, `Missing button ${text}`).toBeDefined(); await act(async () => button!.click());
}
async function click(selector: string, scope: ParentNode = host) { await act(async () => scope.querySelector<HTMLButtonElement>(selector)!.click()); }
async function menu(choice: string, scope: ParentNode = host) { await clickText('並べ替え', scope); await clickText(choice, document.querySelector('[data-sort-menu]')!); }
async function mount(game: GameState, disabled = false) { await act(async () => root.render(<PlayerHand state={game} dispatch={dispatch} disabled={disabled}/>)); }
async function board(game: GameState, paused = false) { useGameStore.setState({ game }); await act(async () => root.render(<GameBoard onHelp={() => {}} paused={paused}/>)); }

it('sorts by color or number on request without changing the engine hand or playing a card', async () => {
  const game = table(); const original = structuredClone(game);
  await mount(game); expect(ids()).toEqual(colorOrder);
  await menu('数字順'); expect(ids()).toEqual(numberOrder);
  await menu('色順'); expect(ids()).toEqual(colorOrder);
  expect(game).toEqual(original); expect(dispatch).not.toHaveBeenCalled();
});

it('moves unplayable cards with selection and arrows, and resumes normal play after Done', async () => {
  await mount(table()); await menu('手動');
  const blue = host.querySelector<HTMLButtonElement>('[data-card-id="b2"]')!;
  expect(blue.disabled).toBe(false); await act(async () => blue.click());
  await click('[aria-label="選んだカードを左へ"]');
  expect(ids()).toEqual(['r8', 'b2', 'rskip', 'g1', 'y7', 'wild', 'wild4']);
  await click('[aria-label="選んだカードを右へ"]'); expect(ids()).toEqual(colorOrder);
  expect(dispatch).not.toHaveBeenCalled();
  await clickText('完了'); expect(blue.disabled).toBe(true);
  await click('[data-card-id="r8"]'); expect(dispatch).toHaveBeenCalledWith({ type: 'PLAY_CARD', playerId: 'p0', cardId: 'r8' });
});

it('supports keyboard movement, maintains focus on the moved card, and finishes with Escape', async () => {
  await mount(table()); await menu('手動');
  const red = host.querySelector<HTMLButtonElement>('[data-card-id="r8"]')!;
  expect(document.activeElement).toBe(red);
  await act(async () => red.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true })));
  expect(ids().at(-1)).toBe('r8'); expect(document.activeElement).toBe(red);
  await act(async () => red.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true })));
  expect(ids()).toEqual(colorOrder);
  await act(async () => red.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })));
  expect(ids().slice(0, 2)).toEqual(['rskip', 'r8']);
  await act(async () => red.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
  expect(host.querySelector('[data-reordering]')).toBeNull(); expect(document.activeElement?.textContent).toContain('並べ替え');
  expect(dispatch).not.toHaveBeenCalled();
});

it.each(['mouse', 'touch'])('drags a card using a %s pointer without playing it on release', async pointerType => {
  await mount(table()); await menu('手動');
  const red = host.querySelector<HTMLElement>('[data-card-id="r8"]')!; const row = hand();
  const pointer = (type: string, x: number) => new PointerEvent(type, { pointerId: 1, pointerType, isPrimary: true, button: 0, clientX: x, clientY: 340, bubbles: true, cancelable: true });
  await act(async () => red.dispatchEvent(pointer('pointerdown', 80)));
  await act(async () => row.dispatchEvent(pointer('pointermove', 200)));
  // Touch capture transfers from the original button to the hand during a drag.
  await act(async () => red.dispatchEvent(pointer('lostpointercapture', 200)));
  await act(async () => row.dispatchEvent(pointer('pointermove', 440)));
  expect(red.style.translate).toBe('360px 0px');
  await act(async () => { row.dispatchEvent(pointer('pointerup', 440)); red.click(); });
  expect(ids()).toEqual([...colorOrder.slice(1), 'r8']); expect(red.style.translate).toBe('');
  expect(dispatch).not.toHaveBeenCalled();
  await act(async () => vi.advanceTimersByTime(0)); await clickText('完了');
  expect(host.querySelector('[data-reordering]')).toBeNull();
});

it('cancels a pointer gesture and restores the card position without reordering', async () => {
  await mount(table()); await menu('手動');
  const red = host.querySelector<HTMLElement>('[data-card-id="r8"]')!; const row = hand();
  const event = (type: string, x: number) => new PointerEvent(type, { pointerId: 2, isPrimary: true, button: 0, clientX: x, clientY: 340, bubbles: true });
  await act(async () => red.dispatchEvent(event('pointerdown', 80)));
  await act(async () => row.dispatchEvent(event('pointermove', 200)));
  await act(async () => row.dispatchEvent(event('pointercancel', 200)));
  expect(ids()).toEqual(colorOrder); expect(red.style.translate).toBe(''); expect(dispatch).not.toHaveBeenCalled();
});

it('preserves the manual order across draws and removes a played card without sorting the rest', async () => {
  const game = table(); await mount(game); await menu('手動');
  const red = host.querySelector<HTMLElement>('[data-card-id="r8"]')!;
  await act(async () => red.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true })));
  await clickText('完了');
  const next = structuredClone(game); next.eventSequence++;
  next.players[0].hand.push({ id: 'incoming', kind: 'number', color: 'red', value: 0 });
  await mount(next); expect(ids()).toEqual([...colorOrder.slice(1), 'r8', 'incoming']);
  const played = structuredClone(next); played.eventSequence++; played.players[0].hand = played.players[0].hand.filter(card => card.id !== 'g1');
  await mount(played); expect(ids()).toEqual([...colorOrder.slice(1).filter(id => id !== 'g1'), 'r8', 'incoming']);
});

it('allows both sorting and manual ordering while card play is disabled by an animation', async () => {
  await mount(table(), true); await menu('数字順'); expect(ids()).toEqual(numberOrder);
  await menu('手動');
  await click('[data-card-id="r8"]'); await click('[aria-label="選んだカードを左へ"]');
  expect(ids()).toEqual(['g1', 'b2', 'r8', 'y7', 'rskip', 'wild', 'wild4']);
  expect(dispatch).not.toHaveBeenCalled();
  await clickText('完了');
  expect(host.querySelector<HTMLButtonElement>('[data-card-id="r8"]')!.disabled).toBe(true);
});

it('shares order between the table hand and expanded hand', async () => {
  const game = table(); await board(game, true); await menu('数字順');
  await clickText('手札一覧');
  const dialog = host.querySelector('[aria-label="手札一覧"]')!;
  expect(ids(dialog)).toEqual(numberOrder);
  await menu('色順', dialog);
  expect(ids(dialog)).toEqual(colorOrder); expect(ids()).toEqual(colorOrder);
  await menu('手動', dialog);
  const red = dialog.querySelector<HTMLElement>('[data-card-id="r8"]')!;
  await act(async () => red.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true })));
  const manualOrder = [...colorOrder.slice(1), 'r8'];
  expect(ids(dialog)).toEqual(manualOrder); expect(ids()).toEqual(manualOrder);
  await act(async () => red.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
  expect(host.querySelector('[aria-label="手札一覧"]')).not.toBeNull();
  await click('[aria-label="閉じる"]', dialog);
  expect(ids()).toEqual(manualOrder); expect(useGameStore.getState().game).toBe(game);
});

it('allows drawing while manually ordering and keeps manual mode active during the draw', async () => {
  const game = table(); await board(game); await menu('手動');
  expect(host.querySelector<HTMLButtonElement>('[data-draw-source]')!.disabled).toBe(false);
  await click('[data-draw-source]'); expect(useGameStore.getState().game!.players[0].hand).toHaveLength(8);
  expect(host.querySelector('[data-reordering]')).not.toBeNull();
  await click('[data-card-id="r8"]'); await click('[aria-label="選んだカードを右へ"]');
  expect(ids().slice(0, 2)).toEqual(['rskip', 'r8']);
  await clickText('完了');
  expect(host.querySelector('[data-reordering]')).toBeNull();
});

it.each([false, true])('continues CPU play while manually ordering, expanded=%s', async expanded => {
  const game = table(); game.turnPlayerId = 'p1'; game.settings.cpuDelay = 200;
  game.players[1].hand = [{ id: 'cpu-red', kind: 'number', color: 'red', value: 3 }, { id: 'cpu-blue', kind: 'number', color: 'blue', value: 4 }];
  await board(game);
  if (expanded) await clickText('手札一覧');
  const scope = expanded ? host.querySelector('[aria-label="手札一覧"]')! : host;
  await menu('手動', scope);
  await act(async () => vi.advanceTimersByTime(200));
  expect(useGameStore.getState().game).not.toBe(game); expect(useGameStore.getState().game!.turnCount).toBe(2);
  expect(scope.querySelector('[data-reordering]')).not.toBeNull();
  await click('[data-card-id="r8"]', scope); await click('[aria-label="選んだカードを右へ"]', scope);
  expect(ids(scope).slice(0, 2)).toEqual(['rskip', 'r8']);
  await clickText('完了', scope); await menu('数字順', scope);
  expect(ids(scope)).toEqual(numberOrder);
});

it('retargets a draw when opening and closing the expanded hand during its animation', async () => {
  const game = table(); game.drawPile = [{ id: 'incoming', kind: 'number', color: 'green', value: 8 }];
  await board(game, true); await click('[data-draw-source]');
  const flight = () => document.querySelector<HTMLElement>('body > [aria-hidden="true"] [data-card-id="incoming"]')?.closest<HTMLElement>('[style]');
  expect(flight()?.style.top).toBe('300px');
  await clickText('手札一覧'); expect(flight()?.style.top).toBe('100px');
  const dialog = host.querySelector('[aria-label="手札一覧"]')!;
  await menu('数字順', dialog); expect(flight()?.style.top).toBe('100px');
  await click('[aria-label="閉じる"]', dialog); expect(flight()?.style.top).toBe('300px');
  await act(async () => vi.advanceTimersByTime(1000)); expect(flight()).toBeUndefined();
});

it('keeps a drag active when the CPU changes turns without changing the human hand', async () => {
  const game = table(); game.turnPlayerId = 'p1'; game.settings.cpuDelay = 200;
  game.players[1].hand = [{ id: 'cpu-red', kind: 'number', color: 'red', value: 3 }, { id: 'cpu-blue', kind: 'number', color: 'blue', value: 4 }];
  await board(game); await menu('手動');
  const card = host.querySelector<HTMLElement>('[data-card-id="r8"]')!; const row = hand();
  const event = (type: string, x: number) => new PointerEvent(type, { pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: 340, bubbles: true, cancelable: true });
  await act(async () => card.dispatchEvent(event('pointerdown', 80)));
  await act(async () => row.dispatchEvent(event('pointermove', 200)));
  await act(async () => vi.advanceTimersByTime(200));
  expect(useGameStore.getState().game!.turnCount).toBe(2); expect(card.style.translate).toBe('120px 0px');
  await act(async () => row.dispatchEvent(event('pointerup', 200)));
  expect(ids().slice(0, 3)).toEqual(['rskip', 'b2', 'r8']); expect(card.style.translate).toBe('');
});

it('keeps a separate order for each human and resets ordering for a new match', async () => {
  const game = table(); game.settings.humanPlayerCount = 2; game.players[1].type = 'human';
  await board(game, true); await menu('数字順');
  const other = structuredClone(game); other.eventSequence = 2; other.turnPlayerId = 'p1'; other.viewerId = 'p1';
  await act(async () => useGameStore.setState({ game: other }));
  const back = structuredClone(other); back.eventSequence = 3; back.turnPlayerId = 'p0'; back.viewerId = 'p0';
  await act(async () => useGameStore.setState({ game: back }));
  expect(ids()).toEqual(numberOrder);
  await act(async () => useGameStore.setState({ game: table() }));
  expect(ids()).toEqual(colorOrder);
});
