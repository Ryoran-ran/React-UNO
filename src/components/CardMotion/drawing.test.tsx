// @vitest-environment happy-dom
import { act, useCallback, useLayoutEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameAction, GameState } from '../../types/game';
import { createGame } from '../../engine/gameEngine';
import { gameReducer } from '../../engine/gameReducer';
import { PlayerHand } from '../PlayerHand/PlayerHand';
import { useHandOrder } from '../PlayerHand/useHandOrder';
import { PlayerArea } from '../PlayerArea/PlayerArea';
import { CardMotion } from './CardMotion';
import { useCardMotion, DRAW_DURATION, PLACEMENT_DURATION } from './useCardMotion';
import { ActionEffectOverlay } from '../ActionEffect/ActionEffectOverlay';
import { ACTION_EFFECT_DURATION, DEFENSE_IMPACT_DURATION, DEFENSE_RESOLVE_DURATION } from '../ActionEffect/effectDescription';

let latest: { state: GameState; motion: ReturnType<typeof useCardMotion> };
let root: Root;
let container: HTMLDivElement;
let animate: ReturnType<typeof vi.fn>;
let originalAnimate: PropertyDescriptor | undefined;

function Harness({ initial }: { initial: GameState }) {
  const [state, setState] = useState(initial);
  const dispatch = useCallback((action: GameAction) => setState(previous => gameReducer(previous, action)), []);
  const motion = useCardMotion(state, dispatch);
  const order = useHandOrder(state.players.find(player => player.id === state.viewerId), state.eventSequence === 1);
  const prepare = useCallback(() => motion.prepareHandReorder(state.viewerId ?? undefined), [motion.prepareHandReorder, state.viewerId]);
  useLayoutEffect(() => { motion.refreshHandLayout(); }, [order.cards, motion.refreshHandLayout]);
  latest = { state, motion };
  return <div ref={motion.boardRef}><button data-draw-source onClick={() => motion.dispatchWithMotion({ type: state.pendingAttack ? 'ACCEPT_DRAW_ATTACK' : 'DRAW_CARD', playerId: state.turnPlayerId })}>Draw</button><div data-discard-target/>
    <PlayerArea state={state} player={state.players[1]} index={1} hiddenCardIds={motion.hiddenDrawIds}/>
    <PlayerHand state={state} dispatch={motion.dispatchWithMotion} hiddenCardIds={motion.hiddenDrawIds} disabled={motion.busy} order={order} onPrepareReorder={prepare}/>
    <CardMotion flights={motion.flights} onFinish={motion.finishFlight}/>
    <ActionEffectOverlay effect={motion.actionEffect}/>
  </div>;
}

function table() {
  const state = createGame({}, 42);
  state.phase = 'normalTurn'; state.turnPlayerId = 'p0'; state.viewerId = 'p0'; state.activeColor = 'red';
  state.discardPile = [{ id: 'top', kind: 'number', color: 'red', value: 5 }];
  state.players[0].hand = [1, 2, 3].map(value => ({ id: `old-${value}`, kind: 'number', color: 'red', value }));
  state.drawPile = [{ id: 'incoming', kind: 'number', color: 'green', value: 8 }];
  return state;
}

beforeEach(() => {
  vi.useFakeTimers(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false, media: '', onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true });
  originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate');
  animate = vi.fn(() => ({ cancel: vi.fn() }));
  Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(this: HTMLElement) {
    if (this.hasAttribute('data-draw-source')) return new DOMRect(300, 100, 60, 90);
    if (this.hasAttribute('data-discard-target')) return new DOMRect(410, 100, 60, 90);
    const seat = this.closest<HTMLElement>('[data-player-id]');
    const own = seat?.dataset.playerId === 'p0';
    if (this.hasAttribute('data-player-id')) return own ? new DOMRect(100, 350, 600, 150) : new DOMRect(700, 40, 180, 90);
    if (this.hasAttribute('data-card-source')) return own ? new DOMRect(100, 380, 600, 100) : new DOMRect(700, 75, 150, 45);
    if (this.hasAttribute('data-card-id') && seat) {
      const siblings = [...this.parentElement!.querySelectorAll<HTMLElement>('[data-card-id]')];
      const index = siblings.indexOf(this);
      const [x = 0, y = 0] = this.style.translate.split(' ').map(value => parseFloat(value) || 0);
      return new DOMRect((own ? 100 - (siblings.length - 3) * 12 + index * 60 : 700 + index * 12) + x, (own ? 390 : 80) + y, own ? 50 : 27, own ? 75 : 39);
    }
    if (this.parentElement?.hasAttribute('data-card-source')) return new DOMRect(720, 80, 27, 39);
    return new DOMRect();
  });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
  if (originalAnimate) Object.defineProperty(HTMLElement.prototype, 'animate', originalAnimate);
  else Reflect.deleteProperty(HTMLElement.prototype, 'animate');
});
async function mount(state: GameState) { await act(async () => root.render(<Harness initial={state}/>)); }
async function draw() { await act(async () => container.querySelector<HTMLButtonElement>('[data-draw-source]')!.click()); }
async function orderBy(text: string) {
  await act(async () => [...container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.startsWith('並べ替え'))!.click());
  await act(async () => [...document.querySelectorAll<HTMLButtonElement>('[data-sort-menu] button')].find(button => button.textContent?.startsWith(text))!.click());
}

describe('draw animation lifecycle and stable hand positions', () => {
  it('flies from the deck, holds existing cards, then settles only after drawing finishes', async () => {
    await mount(table());
    const oldCard = container.querySelector<HTMLElement>('[data-card-id="old-1"]')!;
    const before = oldCard.getBoundingClientRect();
    await draw();
    expect(latest.motion.flights).toHaveLength(1); expect(latest.motion.flights[0].kind).toBe('draw');
    expect(latest.motion.flights[0].source.left).toBe(300); expect(latest.motion.flights[0].card?.id).toBe('incoming');
    expect(latest.motion.hiddenDrawIds).toEqual(['incoming']); expect(latest.motion.busy).toBe(true);
    expect(oldCard.getBoundingClientRect().left).toBe(before.left); expect(oldCard.style.translate).not.toBe('');
    await act(async () => vi.advanceTimersByTime(1000));
    expect(latest.motion.busy).toBe(false); expect(oldCard.style.translate).toBe(''); expect(animate).toHaveBeenCalled();
  });
  it('deals a four-card penalty in sequence and keeps every arrival until the batch is complete', async () => {
    const state = table(); state.phase = 'attackResponse';
    state.pendingAttack = { amount: 4, attackColor: 'red', lastDrawType: 'wild4', targetPlayerId: 'p0', reflectCount: 0, transferCount: 0, lastWild4PlayerId: 'p1' };
    state.drawPile = [4, 5, 6, 7].map(value => ({ id: `deal-${value}`, kind: 'number', color: 'blue', value }));
    await mount(state); await draw();
    expect(latest.motion.flights).toHaveLength(4); expect(latest.motion.flights.map(flight => flight.delay)).toEqual([0, 55, 110, 165]);
    expect(latest.motion.hiddenDrawIds).toHaveLength(4); expect(document.body.textContent).toContain('+4枚');
    const first = latest.motion.flights[0].id; const last = latest.motion.flights.at(-1)!.id;
    await act(async () => latest.motion.finishFlight(first)); expect(latest.motion.flights).toHaveLength(4);
    await act(async () => latest.motion.finishFlight(last)); expect(latest.motion.flights).toHaveLength(0);
    expect(latest.state.players[0].hand).toHaveLength(7);
  });
  it('keeps a CPU draw face and private card ID out of the animation DOM', async () => {
    const state = table(); state.turnPlayerId = 'p1';
    state.players[1].hand = [{ id: 'private-old', kind: 'number', color: 'blue', value: 2 }];
    state.drawPile = [{ id: 'private-secret', kind: 'wild4', color: null }];
    await mount(state); await draw();
    expect(latest.motion.flights[0].hidden).toBe(true); expect(latest.motion.flights[0].card).toBeNull();
    expect(document.body.innerHTML).not.toContain('private-secret'); expect(document.body.innerHTML).not.toContain('+4');
  });
  it('cleans up position locks and timers when the viewport changes', async () => {
    await mount(table()); await draw();
    await act(async () => window.dispatchEvent(new Event('resize')));
    expect(latest.motion.busy).toBe(false); expect(container.querySelector<HTMLElement>('[data-card-id="old-1"]')!.style.translate).toBe('');
    await act(async () => vi.advanceTimersByTime(2000)); expect(latest.motion.flights).toHaveLength(0);
  });
  it('sorts during an active draw, releases old position locks, and retargets the arriving card', async () => {
    const state = table(); state.drawPile[0].value = 0;
    await mount(state); await draw();
    const original = latest.motion.flights[0]; const resolved = latest.state;
    expect(original.destination.left).toBe(268);
    expect(container.querySelector<HTMLElement>('[data-card-id="old-1"]')!.style.translate).not.toBe('');
    await orderBy('数字順');
    expect(latest.state).toBe(resolved); expect(latest.motion.flights).toHaveLength(1);
    expect(latest.motion.flights[0].id).toBe(original.id); expect(latest.motion.flights[0].destination.left).toBe(88);
    expect(latest.motion.hiddenDrawIds).toEqual(['incoming']);
    expect(container.querySelector<HTMLElement>('[data-card-id="old-1"]')!.style.translate).toBe('');
    await act(async () => vi.advanceTimersByTime(1000));
    expect(latest.motion.busy).toBe(false);
    expect(container.querySelector<HTMLElement>('[data-card-id="old-1"]')!.style.translate).toBe('');
    const hand = container.querySelector('[data-player-id="p0"] [data-card-source]')!;
    expect([...hand.querySelectorAll<HTMLElement>('[data-card-id]')].map(card => card.dataset.cardId)).toEqual(['incoming', 'old-1', 'old-2', 'old-3']);
  });
  it('allows a touch drag during a draw and keeps its position after the arrival completes', async () => {
    await mount(table()); await draw(); await orderBy('手動');
    const card = container.querySelector<HTMLElement>('[data-card-id="old-1"]')!;
    const hand = container.querySelector<HTMLElement>('[data-player-id="p0"] [data-card-source]')!;
    const event = (type: string, x: number) => new PointerEvent(type, { pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, clientX: x, clientY: 420, bubbles: true, cancelable: true });
    await act(async () => card.dispatchEvent(event('pointerdown', 113)));
    await act(async () => hand.dispatchEvent(event('pointermove', 233)));
    await act(async () => hand.dispatchEvent(event('pointerup', 233)));
    expect(card.style.translate).toBe(''); expect(latest.motion.flights).toHaveLength(1);
    const ids = () => [...hand.querySelectorAll<HTMLElement>('[data-card-id]')].map(element => element.dataset.cardId);
    expect(ids()).toEqual(['old-2', 'old-3', 'old-1', 'incoming']);
    await act(async () => vi.advanceTimersByTime(1000));
    expect(latest.motion.busy).toBe(false); expect(card.style.translate).toBe('');
    expect(ids()).toEqual(['old-2', 'old-3', 'old-1', 'incoming']);
  });
  it('cancels obsolete drag coordinates when a draw changes the hand, leaving manual mode available', async () => {
    await mount(table()); await orderBy('手動');
    const card = container.querySelector<HTMLElement>('[data-card-id="old-1"]')!;
    const hand = container.querySelector<HTMLElement>('[data-player-id="p0"] [data-card-source]')!;
    const event = (type: string, x: number) => new PointerEvent(type, { pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: 420, bubbles: true, cancelable: true });
    await act(async () => card.dispatchEvent(event('pointerdown', 125)));
    await act(async () => hand.dispatchEvent(event('pointermove', 245)));
    expect(card.style.translate).toBe('120px 0px');
    await draw();
    expect(card.style.translate).toBe(''); expect(hand.getAttribute('data-reordering')).toBe('true');
    await act(async () => hand.dispatchEvent(event('pointerup', 245)));
    await act(async () => vi.advanceTimersByTime(1000));
    expect(card.style.translate).toBe(''); expect(latest.motion.busy).toBe(false);
  });
  it('releases a completed draw settle animation before manual interaction starts', async () => {
    await mount(table()); await draw();
    await act(async () => latest.motion.finishFlight(latest.motion.flights[0].id));
    expect(animate).toHaveBeenCalled();
    await orderBy('手動');
    for (const result of animate.mock.results) expect(result.value.cancel).toHaveBeenCalled();
  });
  it('skips the visual effect under reduced motion while applying the draw normally', async () => {
    const state = table(); state.settings.reducedMotion = true;
    await mount(state); await draw();
    expect(latest.motion.flights).toHaveLength(0); expect(latest.state.players[0].hand).toHaveLength(4);
  });
  it('handles an exhausted deck without a phantom flight', async () => {
    const state = table(); state.drawPile = [];
    await mount(state); await draw(); expect(latest.motion.flights).toHaveLength(0); expect(latest.state.turnPlayerId).toBe('p1');
  });
  it('finishes intermediate draws before the automatic draw-until-playable card is placed', async () => {
    const state = table(); state.settings.drawBehavior = 'drawUntilPlayable';
    state.drawPile = [{ id: 'auto-play', kind: 'number', color: 'red', value: 8 }, { id: 'draw-blue', kind: 'number', color: 'blue', value: 8 }, { id: 'draw-green', kind: 'number', color: 'green', value: 8 }];
    await mount(state); await draw();
    const draws = latest.motion.flights.filter(flight => flight.kind === 'draw');
    const play = latest.motion.flights.find(flight => flight.kind === 'play')!;
    expect(draws).toHaveLength(2); expect(play.delay).toBe(DRAW_DURATION + 55); expect(play.cardId).toBe('auto-play');
    await act(async () => latest.motion.finishFlight(draws.at(-1)!.id)); expect(latest.motion.busy).toBe(true);
    expect(container.querySelector<HTMLElement>('[data-card-id="old-1"]')!.style.translate).not.toBe('');
    await act(async () => latest.motion.finishFlight(play.id)); expect(latest.motion.busy).toBe(false);
  });
  it('shows a skip stamp only after landing and releases input when the short effect finishes', async () => {
    const state = table(); state.players[0].hand.push({ id: 'skip-card', kind: 'skip', color: 'red' });
    await mount(state);
    await act(async () => latest.motion.dispatchWithMotion({ type: 'PLAY_CARD', playerId: 'p0', cardId: 'skip-card' }));
    expect(latest.motion.actionEffect).toBeNull(); expect(latest.state.turnPlayerId).toBe('p2');
    const resolvedState = latest.state;
    await act(async () => latest.motion.finishFlight(latest.motion.flights[0].id));
    expect(latest.motion.flights).toHaveLength(0); expect(latest.motion.busy).toBe(true);
    expect(latest.motion.actionEffect?.kind).toBe('skip'); expect(latest.motion.actionEffect?.targetId).toBe('p1');
    expect(document.body.textContent).toContain('スキップ！'); expect(document.body.textContent).toContain('お休み');
    await act(async () => vi.advanceTimersByTime(ACTION_EFFECT_DURATION + 1));
    expect(latest.motion.actionEffect).toBeNull(); expect(latest.motion.busy).toBe(false); expect(latest.state).toBe(resolvedState);
  });
  it('clears a direction effect on resize and leaves no delayed overlay behind', async () => {
    const state = table(); state.players[0].hand.push({ id: 'reverse-card', kind: 'reverse', color: 'red' });
    await mount(state);
    await act(async () => latest.motion.dispatchWithMotion({ type: 'PLAY_CARD', playerId: 'p0', cardId: 'reverse-card' }));
    await act(async () => latest.motion.finishFlight(latest.motion.flights[0].id));
    expect(latest.motion.actionEffect?.direction).toBe(-1);
    await act(async () => window.dispatchEvent(new Event('resize')));
    expect(latest.motion.busy).toBe(false); expect(document.body.textContent).not.toContain('リバース！');
    await act(async () => vi.advanceTimersByTime(3000)); expect(latest.motion.actionEffect).toBeNull();
  });
  it('respects reduced motion for special cards without changing their effect', async () => {
    const state = table(); state.settings.reducedMotion = true; state.players[0].hand.push({ id: 'reverse-card', kind: 'reverse', color: 'red' });
    await mount(state);
    await act(async () => latest.motion.dispatchWithMotion({ type: 'PLAY_CARD', playerId: 'p0', cardId: 'reverse-card' }));
    expect(latest.state.direction).toBe(-1); expect(latest.motion.actionEffect).toBeNull(); expect(latest.motion.busy).toBe(false);
  });
  it.each(['reflect', 'transfer', 'stack', 'cancel'] as const)('holds a %s defense on impact, then resumes and releases input without animation events', async defense => {
    const state = table(); state.phase = 'attackResponse';
    state.settings.drawRules.mode = defense === 'cancel' ? 'cancel' : 'stack';
    state.pendingAttack = { amount: 6, attackColor: 'red', lastDrawType: 'draw2', targetPlayerId: 'p0', reflectCount: 0, transferCount: 0, lastWild4PlayerId: null };
    state.players[0].hand.push({ id: 'defense-card', kind: defense === 'reflect' ? 'reverse' : defense === 'transfer' ? 'skip' : 'draw2', color: 'red' });
    await mount(state);
    await act(async () => latest.motion.dispatchWithMotion({ type: 'PLAY_CARD', playerId: 'p0', cardId: 'defense-card' }));
    expect(latest.motion.actionEffect).toBeNull();
    const resolved = latest.state;
    await act(async () => vi.advanceTimersByTime(PLACEMENT_DURATION + 140));
    expect(latest.motion.flights).toHaveLength(0); expect(latest.motion.busy).toBe(true);
    expect(latest.motion.actionEffect?.stage).toBe('impact'); expect(latest.motion.actionEffect?.defense).toBe(defense);
    const overlay = document.querySelector(`[data-action-effect="${defense}"]`)!;
    expect(overlay.getAttribute('data-effect-stage')).toBe('impact'); expect(overlay.querySelector('svg')).toBeNull();
    expect(overlay.querySelector('[aria-hidden="true"] [data-card-id="defense-card"]')).not.toBeNull();
    await act(async () => vi.advanceTimersByTime(DEFENSE_IMPACT_DURATION - 1));
    expect(latest.motion.actionEffect?.stage).toBe('impact');
    await act(async () => vi.advanceTimersByTime(1));
    expect(latest.motion.actionEffect?.stage).toBe('resolve'); expect(latest.motion.busy).toBe(true);
    await act(async () => vi.advanceTimersByTime(DEFENSE_RESOLVE_DURATION));
    expect(latest.motion.actionEffect).toBeNull(); expect(latest.motion.busy).toBe(false);
    expect(latest.state).toBe(resolved);
  });
  it.each(['impact', 'resolve'] as const)('cancels a defense during %s on resize without restoring it later', async stage => {
    const state = table(); state.phase = 'attackResponse';
    state.pendingAttack = { amount: 2, attackColor: 'red', lastDrawType: 'draw2', targetPlayerId: 'p0', reflectCount: 0, transferCount: 0, lastWild4PlayerId: null };
    state.players[0].hand.push({ id: 'defense-card', kind: 'reverse', color: 'red' });
    await mount(state);
    await act(async () => latest.motion.dispatchWithMotion({ type: 'PLAY_CARD', playerId: 'p0', cardId: 'defense-card' }));
    await act(async () => latest.motion.finishFlight(latest.motion.flights[0].id));
    if (stage === 'resolve') await act(async () => vi.advanceTimersByTime(DEFENSE_IMPACT_DURATION));
    expect(latest.motion.actionEffect?.stage).toBe(stage);
    await act(async () => window.dispatchEvent(new Event('resize')));
    await act(async () => vi.advanceTimersByTime(2000));
    expect(latest.motion.actionEffect).toBeNull(); expect(latest.motion.busy).toBe(false);
    expect(document.querySelector('[data-action-effect]')).toBeNull();
  });
});
