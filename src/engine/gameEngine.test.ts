import { describe, expect, it } from 'vitest';
import { createDeck, takeCard } from './deckManager';
import { createGame } from './gameEngine';
import { gameReducer } from './gameReducer';
import { canPlayCard, playableCards } from './cardValidator';
import { nextPlayerId } from './turnManager';
import { isHandVisible } from './visibility';
import { chooseCpuAction, observeForCpu } from '../cpu/cpuEngine';
import { DEFAULT_SETTINGS, normalizeSettings } from '../types/rules';
import { COLORS, type Card, type NormalColor } from '../types/card';
import type { GameState } from '../types/game';
import { registerCardRule } from '../rules/ruleRegistry';

let sequence = 0;
const card = (kind: Card['kind'], color: NormalColor | null = 'red', value?: number): Card => ({ id: `test-${++sequence}`, kind, color, value });
function fixture(count = 4): GameState {
  const state = createGame({ playerCount: count }, 42);
  state.turnPlayerId = 'p0'; state.phase = 'normalTurn'; state.viewerId = 'p0';
  state.discardPile = [card('number', 'red', 5)]; state.activeColor = 'red';
  state.players.forEach(p => p.hand = [card('number', 'blue', 3), card('number', 'green', 6), card('number', 'yellow', 9)]);
  return state;
}
function give(state: GameState, player: number, ...cards: Card[]): Card {
  state.players[player].hand.unshift(...cards); return cards[0];
}
function play(state: GameState, c: Card): GameState { return gameReducer(state, { type: 'PLAY_CARD', playerId: state.turnPlayerId, cardId: c.id }); }
function accept(state: GameState): GameState { return gameReducer(state, { type: 'ACCEPT_DRAW_ATTACK', playerId: state.turnPlayerId }); }
function color(state: GameState, color: NormalColor): GameState { return gameReducer(state, { type: 'SELECT_COLOR', playerId: state.turnPlayerId, color }); }

describe('Phase 1: deck and ordinary turns', () => {
  it('creates exactly 108 unique cards with the specified distribution', () => {
    const deck = createDeck(); expect(deck).toHaveLength(108); expect(new Set(deck.map(c => c.id)).size).toBe(108);
    for (const color of COLORS) {
      expect(deck.filter(c => c.color === color)).toHaveLength(25);
      expect(deck.filter(c => c.color === color && c.value === 0)).toHaveLength(1);
      for (let value = 1; value <= 9; value++) expect(deck.filter(c => c.color === color && c.value === value)).toHaveLength(2);
      for (const kind of ['skip', 'reverse', 'draw2']) expect(deck.filter(c => c.color === color && c.kind === kind)).toHaveLength(2);
    }
    expect(deck.filter(c => c.kind === 'wild')).toHaveLength(4); expect(deck.filter(c => c.kind === 'wild4')).toHaveLength(4);
  });
  it.each([2, 3, 4, 5, 6, 7, 8])('deals 7 cards to %i players, selects a numeric top and random first player', count => {
    for (let human = 1; human <= count; human++) {
      const state = createGame({ playerCount: count, humanPlayerCount: human }, 13);
      expect(state.players).toHaveLength(count); expect(state.players.filter(p => p.type === 'human')).toHaveLength(human);
      expect(state.players.every(p => p.hand.length === 7)).toBe(true); expect(state.discardPile[0].kind).toBe('number');
      expect(state.drawPile.length + count * 7 + 1).toBe(108); expect(state.direction).toBe(1);
    }
    expect(createGame({ playerCount: count }, 13)).toEqual(createGame({ playerCount: count }, 13));
  });
  it('validates color, number, kind, wild and ownership independently', () => {
    const state = fixture(); const cards = [card('number', 'red', 0), card('number', 'blue', 5), card('wild', null), card('number', 'blue', 4)];
    give(state, 0, ...cards);
    expect(cards.map(c => canPlayCard(state, 'p0', c))).toEqual([true, true, true, false]);
    expect(canPlayCard(state, 'p1', cards[0])).toBe(false);
    state.discardPile = [card('skip', 'red')]; const skip = give(state, 0, card('skip', 'blue')); expect(canPlayCard(state, 'p0', skip)).toBe(true);
  });
  it('reverses and skips the proper player without mutating the previous state', () => {
    const state = fixture(); const reverse = give(state, 0, card('reverse'));
    const result = play(state, reverse); expect(result.direction).toBe(-1); expect(result.turnPlayerId).toBe('p3'); expect(state.direction).toBe(1);
    expect(play(state, give(state, 0, card('skip'))).turnPlayerId).toBe('p2');
  });
  it.each(['skip', 'reverse'])('returns normal %s to the same player in two-player games', kind => {
    const state = fixture(2); expect(play(state, give(state, 0, card(kind))).turnPlayerId).toBe('p0');
  });
  it('recycles every discard except the top, including during a large penalty', () => {
    let state = fixture(); state.drawPile = [card('number', 'green', 1)];
    const recycled = card('number', 'blue', 8); state.discardPile.unshift(recycled);
    state = play(state, give(state, 0, card('draw2')));
    const top = state.discardPile.at(-1)!; const before = state.players[1].hand.length;
    state = accept(state); expect(state.players[1].hand).toHaveLength(before + 2); expect(state.discardPile).toEqual([top]);
    expect(state.pendingAttack).toBeNull(); expect(state.turnPlayerId).toBe('p2');
  });
  it('terminates when both piles are exhausted', () => {
    const state = fixture(); state.drawPile = []; expect(takeCard(state)).toBeNull();
    let result = state;
    for (let i = 0; i < 4; i++) result = gameReducer(result, { type: 'DRAW_CARD', playerId: result.turnPlayerId });
    expect(result.phase).toBe('gameOver'); expect(result.stalemate).toBe(true);
  });
  it('settles a normal win and rejects further actions', () => {
    const state = fixture(); state.players[0].hand = [card('number', 'red', 1)];
    const result = play(state, state.players[0].hand[0]); expect(result.phase).toBe('gameOver'); expect(result.rankings).toEqual(['p0']);
    expect(gameReducer(result, { type: 'DRAW_CARD', playerId: result.turnPlayerId })).toBe(result);
  });
  it('ignores invalid actions and color choices', () => {
    const state = fixture(); expect(gameReducer(state, { type: 'PLAY_CARD', playerId: 'p0', cardId: 'missing' })).toBe(state);
    expect(gameReducer(state, { type: 'DRAW_CARD', playerId: 'p1' })).toBe(state);
    expect(gameReducer(state, { type: 'SELECT_COLOR', playerId: 'p0', color: 'red' })).toBe(state);
  });
});

describe('Phase 2: independent attack rules and color timing', () => {
  it('stacks same-type draw cards across colors and tracks attack color', () => {
    let state = fixture(); state = play(state, give(state, 0, card('draw2')));
    state = play(state, give(state, 1, card('draw2', 'blue')));
    state = play(state, give(state, 2, card('draw2', 'green')));
    expect(state.pendingAttack?.amount).toBe(6); expect(state.pendingAttack?.attackColor).toBe('green'); expect(state.turnPlayerId).toBe('p3');
  });
  it('only allows mixed stacking in stack mode', () => {
    let state = fixture(); state = play(state, give(state, 0, card('draw2'))); const wild = give(state, 1, card('wild4', null));
    expect(canPlayCard(state, 'p1', wild)).toBe(false); state.settings.drawRules.allowMixedStacking = true;
    state = play(state, wild); expect(state.pendingAttack?.amount).toBe(6); expect(state.phase).toBe('selectingColor');
    state = color(state, 'yellow'); expect(state.pendingAttack?.attackColor).toBe('yellow');
  });
  it('cancels without passing the penalty or requiring color matching', () => {
    let state = fixture(); state.settings.drawRules.mode = 'cancel'; state = play(state, give(state, 0, card('draw2')));
    const cancel = give(state, 1, card('draw2', 'blue')); state = play(state, cancel);
    expect(state.pendingAttack).toBeNull(); expect(state.turnPlayerId).toBe('p2'); expect(state.discardPile.at(-1)?.id).toBe(cancel.id); expect(state.activeColor).toBe('blue');
  });
  it('forced mode still allows independently enabled reflection and transfer', () => {
    let state = fixture(); state.settings.drawRules.mode = 'forced'; state = play(state, give(state, 0, card('draw2')));
    const cards = [card('draw2'), card('reverse'), card('skip'), card('reverse', 'blue'), card('skip', 'blue')]; give(state, 1, ...cards);
    expect(cards.map(c => canPlayCard(state, 'p1', c))).toEqual([false, true, true, false, false]);
    state.settings.drawRules.allowReverseReflect = false; state.settings.drawRules.allowSkipTransfer = false;
    expect(playableCards(state)).toHaveLength(0);
  });
  it('reflects back to the attacker with reversed direction and unchanged amount', () => {
    let state = fixture(); state = play(state, give(state, 0, card('draw2'))); state = play(state, give(state, 1, card('reverse')));
    expect(state.direction).toBe(-1); expect(state.pendingAttack?.targetPlayerId).toBe('p0'); expect(state.pendingAttack?.amount).toBe(2);
    state.settings.drawRules.allowChainReflect = false; const repeat = give(state, 0, card('reverse')); expect(canPlayCard(state, 'p0', repeat)).toBe(false);
    state.settings.drawRules.allowChainReflect = true; expect(canPlayCard(state, 'p0', repeat)).toBe(true);
  });
  it('transfers one player forward and enforces the chain-transfer switch', () => {
    let state = fixture(); state = play(state, give(state, 0, card('draw2'))); state = play(state, give(state, 1, card('skip')));
    expect(state.direction).toBe(1); expect(state.pendingAttack?.targetPlayerId).toBe('p2'); expect(state.pendingAttack?.amount).toBe(2);
    state.settings.drawRules.allowChainTransfer = false; const skip = give(state, 2, card('skip')); expect(canPlayCard(state, 'p2', skip)).toBe(false);
  });
  it.each(['skip', 'reverse'])('sends a two-player attack back with %s', kind => {
    let state = fixture(2); state = play(state, give(state, 0, card('draw2'))); state = play(state, give(state, 1, card(kind)));
    expect(state.pendingAttack?.targetPlayerId).toBe('p0');
  });
  it('pauses immediate +4 until color selection and updates the last chooser on stacking', () => {
    let state = fixture(); state = play(state, give(state, 0, card('wild4', null)));
    expect(state.phase).toBe('selectingColor'); expect(gameReducer(state, { type: 'DRAW_CARD', playerId: 'p0' })).toBe(state);
    state = color(state, 'blue'); expect(state.pendingAttack?.attackColor).toBe('blue'); expect(state.turnPlayerId).toBe('p1');
    state = play(state, give(state, 1, card('wild4', null))); state = color(state, 'green');
    expect(state.pendingAttack?.lastWild4PlayerId).toBe('p1'); expect(state.pendingAttack?.amount).toBe(8); expect(state.activeColor).toBe('green');
  });
  it('defers +4 choice to the final +4 player even after +2 changes attack color', () => {
    let state = fixture(); state.settings.wild4ColorTiming = 'afterAttack'; state.settings.drawRules.allowMixedStacking = true;
    state = play(state, give(state, 0, card('wild4', null))); expect(state.phase).toBe('attackResponse'); expect(state.pendingAttack?.attackColor).toBe('red');
    state = play(state, give(state, 1, card('wild4', null))); state = play(state, give(state, 2, card('draw2', 'blue')));
    expect(state.pendingAttack?.attackColor).toBe('blue'); state = accept(state);
    expect(state.phase).toBe('selectingColor'); expect(state.turnPlayerId).toBe('p1'); expect(state.colorSelection?.playerId).toBe('p1');
    expect(state.pendingAttack).toBeNull(); state = color(state, 'green'); expect(state.activeColor).toBe('green'); expect(state.turnPlayerId).toBe('p0');
  });
  it.each(['immediate', 'afterAttack'] as const)('handles +4 cancellation with %s choice by the cancelling player', timing => {
    let state = fixture(); state.settings.drawRules.mode = 'cancel'; state.settings.wild4ColorTiming = timing;
    state = play(state, give(state, 0, card('wild4', null))); if (timing === 'immediate') state = color(state, 'red');
    state = play(state, give(state, 1, card('wild4', null))); expect(state.phase).toBe('selectingColor'); expect(state.turnPlayerId).toBe('p1');
    state = color(state, 'blue'); expect(state.pendingAttack).toBeNull(); expect(state.turnPlayerId).toBe('p2'); expect(state.activeColor).toBe('blue');
  });
  it('draws once and passes even if the new card is playable', () => {
    const state = fixture(); state.drawPile = [card('number', 'red', 8)]; const next = gameReducer(state, { type: 'DRAW_CARD', playerId: 'p0' });
    expect(next.players[0].hand).toHaveLength(4); expect(next.turnPlayerId).toBe('p1'); expect(next.discardPile).toHaveLength(1);
  });
  it('draws until playable, automatically plays it, and pauses for wild color', () => {
    const state = fixture(); state.settings.drawBehavior = 'drawUntilPlayable'; state.drawPile = [card('wild', null), card('number', 'blue', 8)];
    const next = gameReducer(state, { type: 'DRAW_CARD', playerId: 'p0' }); expect(next.players[0].hand).toHaveLength(4); expect(next.phase).toBe('selectingColor'); expect(next.drawPile).toHaveLength(0);
  });
  it('terminates draw-until-playable without a usable card or recyclable pile', () => {
    const state = fixture(); state.settings.drawBehavior = 'drawUntilPlayable'; state.drawPile = [card('number', 'blue', 8)];
    const next = gameReducer(state, { type: 'DRAW_CARD', playerId: 'p0' }); expect(next.players[0].hand).toHaveLength(4); expect(next.turnPlayerId).toBe('p1');
  });
  it('blocks voluntary drawing when disabled and a legal card exists', () => {
    const state = fixture(); state.settings.allowVoluntaryDraw = false; give(state, 0, card('wild', null));
    expect(gameReducer(state, { type: 'DRAW_CARD', playerId: 'p0' })).toBe(state);
  });
  it('waits for attack resolution before a win, allowing a reflected attack to defeat the finish', () => {
    let state = fixture(); state.players[0].hand = [card('draw2')]; state = play(state, state.players[0].hand[0]);
    expect(state.rankings).toEqual([]); state = play(state, give(state, 1, card('reverse'))); state = accept(state);
    expect(state.players[0].hand).toHaveLength(2); expect(state.rankings).toEqual([]); expect(state.phase).toBe('normalTurn');
  });
  it('settles multiple zero-card finishers in order after the penalty', () => {
    let state = fixture(); state.settings.gameMode = 'ranking'; state.players[0].hand = [card('draw2')]; state.players[1].hand = [card('draw2', 'blue')];
    state = play(state, state.players[0].hand[0]); state = play(state, state.players[1].hand[0]); expect(state.rankings).toEqual([]);
    state = accept(state); expect(state.rankings).toEqual(['p0', 'p1']); expect(state.turnPlayerId).toBe('p3'); expect(nextPlayerId(state)).toBe('p2');
    state.players[3].hand = [card('reverse', 'blue')]; state = play(state, state.players[3].hand[0]);
    expect(state.rankings).toEqual(['p0', 'p1', 'p3', 'p2']); expect(state.phase).toBe('gameOver');
  });
  it('uses two-player reverse behavior after earlier players have finished', () => {
    const state = fixture(); state.settings.gameMode = 'ranking'; state.players[1].rank = 1; state.players[3].rank = 2; state.rankings = ['p1', 'p3'];
    const result = play(state, give(state, 0, card('reverse'))); expect(result.turnPlayerId).toBe('p0');
  });
  it('supports adding a declarative card effect and a custom validation rule', () => {
    const unregister = registerCardRule('jump', { canPlay: () => true, effect: () => ({ skip: true }) });
    try { const state = fixture(); expect(play(state, give(state, 0, card('jump', 'blue'))).turnPlayerId).toBe('p2'); } finally { unregister(); }
  });
});

describe('Phase 3–4: CPU, presentation and privacy', () => {
  it.each(['hidden', 'all', 'cpu'] as const)('only exposes hands permitted by %s mode', visibility => {
    const state = fixture(); state.settings.handVisibility = visibility; state.settings.humanPlayerCount = 2; state.players[1].type = 'human';
    expect(isHandVisible(state, state.players[0])).toBe(true); expect(isHandVisible(state, state.players[1])).toBe(visibility === 'all');
    expect(isHandVisible(state, state.players[2])).toBe(visibility !== 'hidden');
    const observation = observeForCpu(state, 'p2'); expect(observation.others.find(p => p.id === 'p1')?.hand).toBe(visibility === 'all' ? state.players[1].hand : undefined);
  });
  it('hides hands until the next human confirms, including deferred color choices', () => {
    let state = fixture(); state.settings.humanPlayerCount = 2; state.players[1].type = 'human';
    state = play(state, give(state, 0, card('number', 'red', 7))); expect(state.phase).toBe('playerHandoff');
    expect(state.players.every(p => !isHandVisible(state, p))).toBe(true);
    expect(gameReducer(state, { type: 'DRAW_CARD', playerId: 'p1' })).toBe(state);
    state = gameReducer(state, { type: 'CONFIRM_HANDOFF', playerId: 'p1' }); expect(state.phase).toBe('normalTurn'); expect(state.viewerId).toBe('p1');
  });
  it('UNO events do not change gameplay and trigger once on crossing to one card', () => {
    const state = fixture(); state.players[0].hand = [card('number', 'red', 2), card('number', 'blue', 2)];
    const enabled = play(state, state.players[0].hand[0]); const disabledState = structuredClone(state); disabledState.settings.showUnoEffect = false;
    const disabled = play(disabledState, disabledState.players[0].hand[0]);
    expect(enabled.events.some(e => e.type === 'uno')).toBe(true); expect(disabled.events.some(e => e.type === 'uno')).toBe(false);
    expect(enabled.players).toEqual(disabled.players); expect(enabled.pendingAttack).toEqual(disabled.pendingAttack); expect(enabled.turnPlayerId).toBe(disabled.turnPlayerId);
  });
  it('sanitizes invalid persisted settings', () => {
    expect(normalizeSettings({ playerCount: 100, humanPlayerCount: -5, cpuDelay: NaN }).playerCount).toBe(8);
    expect(normalizeSettings({ playerCount: 2, humanPlayerCount: 8 }).humanPlayerCount).toBe(2);
  });
});

describe('Phase 5: rule combinations, legal CPU play and conservation', () => {
  const combinations = ['stack', 'cancel', 'forced'].flatMap(mode => ['immediate', 'afterAttack'].flatMap(timing => [false, true].flatMap(mixed => [false, true].flatMap(reflect => [false, true].flatMap(transfer => [false, true].flatMap(chainReflect => [false, true].flatMap(chainTransfer => [false, true].map(until => ({ mode, timing, mixed, reflect, transfer, chainReflect, chainTransfer, until })))))))));
  const cases = combinations.flatMap(combo => [false, true].map(continueAfterDraw => ({ ...combo, continueAfterDraw })));
  it.each(cases)('plays a full legal ranking game: %j', combo => {
    const index = cases.indexOf(combo);
    let state = createGame({ ...DEFAULT_SETTINGS, gameMode: 'ranking', playerCount: 2 + index % 7,
      cpuDifficulty: (['easy', 'normal', 'hard'] as const)[index % 3], allowVoluntaryDraw: index % 2 === 0, showUnoEffect: index % 3 === 0,
      wild4ColorTiming: combo.timing as 'immediate' | 'afterAttack', drawBehavior: combo.until ? 'drawUntilPlayable' : 'drawOnceAndPass',
      drawRules: { ...DEFAULT_SETTINGS.drawRules, mode: combo.mode as 'stack' | 'cancel' | 'forced', allowMixedStacking: combo.mixed, allowReverseReflect: combo.reflect, allowSkipTransfer: combo.transfer, allowChainReflect: combo.chainReflect, allowChainTransfer: combo.chainTransfer, continueAfterDraw: combo.continueAfterDraw } }, 139 + index);
    for (let i = 0; i < 2500 && state.phase !== 'gameOver'; i++) {
      // Simulate every seat through the same CPU strategy, preserving real reducer validation.
      const observationState = structuredClone(state); observationState.players.find(p => p.id === state.turnPlayerId)!.type = 'cpu';
      const action = chooseCpuAction(observationState, (i % 19) / 19); expect(action).not.toBeNull();
      const next = gameReducer(state, action!); expect(next).not.toBe(state); state = next;
      const all = [...state.drawPile, ...state.discardPile, ...state.players.flatMap(p => p.hand)];
      expect(all).toHaveLength(108); expect(new Set(all.map(c => c.id)).size).toBe(108);
      if (state.phase !== 'selectingColor' && state.phase !== 'gameOver') expect(state.players.find(p => p.id === state.turnPlayerId)?.rank).toBeNull();
      if (state.pendingAttack) expect(state.pendingAttack.targetPlayerId).toBe(state.phase === 'selectingColor' ? state.colorSelection?.nextPlayerId : state.turnPlayerId);
    }
    expect(state.phase).toBe('gameOver'); expect(state.rankings).toHaveLength(state.settings.playerCount);
  });
});
