import { expect, it } from 'vitest';
import { createGame } from '../../engine/gameEngine';
import { gameReducer } from '../../engine/gameReducer';
import { selectedColorBetween } from './colorTransition';

function table(kind: 'wild' | 'wild4' = 'wild') {
  const game = createGame({}, 42);
  game.turnPlayerId = 'p0'; game.phase = 'normalTurn'; game.viewerId = 'p0'; game.activeColor = 'red';
  game.discardPile = [{ id: 'top', kind: 'number', color: 'red', value: 5 }];
  game.players[0].hand = [{ id: 'wild-card', kind, color: null }, { id: 'keep', kind: 'number', color: 'green', value: 9 }];
  return game;
}

it.each(['red', 'blue'] as const)('recognizes a committed manual %s choice, including the same color', color => {
  const before = table();
  const after = gameReducer(before, { type: 'PLAY_CARD', playerId: 'p0', cardId: 'wild-card', color });
  expect(selectedColorBetween(before, after)).toMatchObject({ color, previousColor: 'red', playerName: before.players[0].name });
});

it('waits for a separate CPU choice instead of announcing a color when a wild is played', () => {
  const before = table(); before.players[0].type = 'cpu';
  const played = gameReducer(before, { type: 'PLAY_CARD', playerId: 'p0', cardId: 'wild-card' });
  expect(selectedColorBetween(before, played)).toBeNull();
  const chosen = gameReducer(played, { type: 'SELECT_COLOR', playerId: 'p0', color: 'green' });
  expect(selectedColorBetween(played, chosen)?.color).toBe('green');
});

it('announces a deferred +4 choice only after the attack and its color selection resolve', () => {
  const before = table('wild4'); before.settings.wild4ColorTiming = 'afterAttack';
  const played = gameReducer(before, { type: 'PLAY_CARD', playerId: 'p0', cardId: 'wild-card' });
  expect(selectedColorBetween(before, played)).toBeNull();
  const accepted = gameReducer(played, { type: 'ACCEPT_DRAW_ATTACK', playerId: 'p1' });
  expect(selectedColorBetween(played, accepted)).toBeNull();
  const chosen = gameReducer(accepted, { type: 'SELECT_COLOR', playerId: 'p0', color: 'blue' });
  expect(selectedColorBetween(accepted, chosen)).toMatchObject({ color: 'blue', playerName: before.players[0].name });
});

it.each(['stack', 'cancel'] as const)('recognizes a preselected wild4 color used to %s an attack', mode => {
  const before = table('wild4'); before.settings.drawRules.mode = mode; before.phase = 'attackResponse';
  before.pendingAttack = { amount: 4, attackColor: 'red', lastDrawType: 'wild4', targetPlayerId: 'p0', reflectCount: 0, transferCount: 0, lastWild4PlayerId: 'p3' };
  const after = gameReducer(before, { type: 'PLAY_CARD', playerId: 'p0', cardId: 'wild-card', color: 'yellow' });
  expect(selectedColorBetween(before, after)?.color).toBe('yellow');
});

it('does not mistake a colored attack stacked onto deferred +4 for a wild color choice', () => {
  const before = table('wild4'); before.settings.wild4ColorTiming = 'afterAttack'; before.settings.drawRules.allowMixedStacking = true;
  const played = gameReducer(before, { type: 'PLAY_CARD', playerId: 'p0', cardId: 'wild-card' });
  played.players[1].hand = [{ id: 'draw2', kind: 'draw2', color: 'blue' }];
  const stacked = gameReducer(played, { type: 'PLAY_CARD', playerId: 'p1', cardId: 'draw2' });
  expect(stacked.activeColor).toBe('blue'); expect(selectedColorBetween(played, stacked)).toBeNull();
});

it('ignores invalid plays and uncommitted choices', () => {
  const before = table();
  const rejected = gameReducer(before, { type: 'PLAY_CARD', playerId: 'p1', cardId: 'wild-card', color: 'yellow' });
  expect(selectedColorBetween(before, rejected)).toBeNull();
});
