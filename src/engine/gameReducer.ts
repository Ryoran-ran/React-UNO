import { COLORS, cardLabel, type Card, type NormalColor } from '../types/card';
import type { GameAction, GameEvent, GameState } from '../types/game';
import { createGame } from './gameEngine';
import { canDraw, canPlayCard, needsColorOnPlay } from './cardValidator';
import { defenseType } from './attackManager';
import { drawCards, takeCard } from './deckManager';
import { activatePhase, nextPlayerId } from './turnManager';
import { settleRankings } from './rankingManager';
import { getCardRule } from '../rules/ruleRegistry';

function log(state: GameState, type: GameEvent['type'], text: string, playerId?: string): void {
  state.events.push({ id: ++state.eventSequence, type, text, playerId });
}
function settleAndAdvance(state: GameState, nextId: string): void {
  settleRankings(state);
  if (state.phase === 'gameOver') return;
  if (state.players.find(p => p.id === nextId)!.rank !== null) nextId = nextPlayerId(state, nextId);
  state.turnCount++;
  activatePhase(state, nextId, 'normalTurn');
}
function requestColor(state: GameState, playerId: string, continuation: 'attack' | 'settle', nextId: string): void {
  state.colorSelection = { playerId, continuation, nextPlayerId: nextId };
  activatePhase(state, playerId, 'selectingColor');
}
function finishAttack(state: GameState, nextId: string): void {
  const lastWild = state.pendingAttack?.lastWild4PlayerId;
  state.pendingAttack = null;
  if (lastWild && state.settings.wild4ColorTiming === 'afterAttack') requestColor(state, lastWild, 'settle', nextId);
  else settleAndAdvance(state, nextId);
}
function applyColor(state: GameState, playerId: string, color: NormalColor): void {
  const selection = state.colorSelection!;
  const player = state.players.find(candidate => candidate.id === playerId)!;
  state.activeColor = color;
  if (state.pendingAttack) state.pendingAttack.attackColor = color;
  state.colorSelection = null;
  log(state, 'system', `${player.name} が${{ red: '赤', blue: '青', green: '緑', yellow: '黄' }[color]}を指定`, playerId);
  if (selection.continuation === 'attack') activatePhase(state, selection.nextPlayerId, 'attackResponse');
  else settleAndAdvance(state, selection.nextPlayerId);
}
function applyPlay(state: GameState, card: Card): void {
  const playerId = state.turnPlayerId;
  const player = state.players.find(p => p.id === playerId)!;
  const defense = state.pendingAttack ? defenseType(state, card) : null;
  const effect = getCardRule(card.kind)!.effect(card);
  player.hand = player.hand.filter(c => c.id !== card.id);
  state.discardPile.push(card);
  state.consecutivePasses = 0;
  if (!player.hand.length && !state.finishQueue.includes(playerId)) state.finishQueue.push(playerId);
  log(state, 'play', `${player.name} → ${cardLabel(card)}`, playerId);

  if (state.pendingAttack) {
    const attack = state.pendingAttack;
    if (defense === 'reflect') { state.direction = state.direction === 1 ? -1 : 1; attack.reflectCount++; log(state, 'attack', `${player.name} が ${attack.amount}枚の攻撃を反射！`, playerId); }
    if (defense === 'transfer') { attack.transferCount++; log(state, 'attack', `${player.name} が ${attack.amount}枚の攻撃を転送！`, playerId); }
    if (defense === 'stack' || defense === 'cancel') {
      if (defense === 'stack') attack.amount += effect.draw ?? 0;
      attack.lastDrawType = card.kind as 'draw2' | 'wild4';
      if (card.kind === 'wild4') attack.lastWild4PlayerId = playerId;
      if (card.color) { attack.attackColor = card.color; state.activeColor = card.color; }
    }
    const nextId = nextPlayerId(state, playerId);
    if (defense === 'cancel') {
      log(state, 'attack', `${player.name} が攻撃を無効化！`, playerId);
      if (card.kind === 'wild4' && state.settings.wild4ColorTiming === 'immediate') {
        state.pendingAttack = null;
        requestColor(state, playerId, 'settle', nextId);
      } else finishAttack(state, nextId);
      return;
    }
    attack.targetPlayerId = nextId;
    if (card.kind === 'wild4' && state.settings.wild4ColorTiming === 'immediate') requestColor(state, playerId, 'attack', nextId);
    else activatePhase(state, nextId, 'attackResponse');
    return;
  }

  if (card.color) state.activeColor = card.color;
  if (effect.reverse) state.direction = state.direction === 1 ? -1 : 1;
  const remaining = state.players.filter(p => p.rank === null).length;
  const steps = effect.skip || (effect.reverse && remaining === 2) ? 2 : 1;
  const nextId = nextPlayerId(state, playerId, steps);
  if (effect.draw) {
    state.pendingAttack = {
      amount: effect.draw, attackColor: state.activeColor, lastDrawType: card.kind === 'wild4' ? 'wild4' : 'draw2',
      targetPlayerId: nextId, reflectCount: 0, transferCount: 0, lastWild4PlayerId: card.kind === 'wild4' ? playerId : null,
    };
  }
  if (needsColorOnPlay(state, card)) {
    requestColor(state, playerId, state.pendingAttack ? 'attack' : 'settle', nextId);
  } else if (state.pendingAttack) activatePhase(state, nextId, 'attackResponse');
  else settleAndAdvance(state, nextId);
}

export function gameReducer(previous: GameState, action: GameAction): GameState {
  if (action.type === 'START_GAME' || action.type === 'RESTART_GAME') return createGame(action.settings ?? previous.settings, action.seed ?? previous.rngState);
  if (!('playerId' in action) || action.playerId !== previous.turnPlayerId || previous.phase === 'gameOver') return previous;
  const actor = previous.players.find(p => p.id === action.playerId);
  if (!actor) return previous;
  let card: Card | undefined;
  switch (action.type) {
    case 'CONFIRM_HANDOFF': if (previous.phase !== 'playerHandoff' || !previous.handoffPhase) return previous; break;
    case 'SELECT_COLOR': if (previous.phase !== 'selectingColor' || previous.colorSelection?.playerId !== action.playerId || !COLORS.includes(action.color)) return previous; break;
    case 'PLAY_CARD':
      card = actor.hand.find(c => c.id === action.cardId);
      if (!card || !canPlayCard(previous, action.playerId, card)) return previous;
      if (action.color !== undefined && (!COLORS.includes(action.color) || !needsColorOnPlay(previous, card))) return previous;
      break;
    case 'DRAW_CARD': if (!canDraw(previous, action.playerId)) return previous; break;
    case 'ACCEPT_DRAW_ATTACK': if (previous.phase !== 'attackResponse' || previous.pendingAttack?.targetPlayerId !== action.playerId) return previous; break;
    case 'PASS_TURN': if (!canDraw(previous, action.playerId) || previous.drawPile.length || previous.discardPile.length > 1) return previous; break;
    default: return previous;
  }
  const state = structuredClone(previous);
  if (action.type === 'CONFIRM_HANDOFF') {
    state.phase = state.handoffPhase!; state.handoffPhase = null; state.viewerId = action.playerId;
  } else if (action.type === 'SELECT_COLOR') {
    applyColor(state, actor.id, action.color);
  } else if (action.type === 'PLAY_CARD') {
    applyPlay(state, card!);
    if (action.color !== undefined) applyColor(state, actor.id, action.color);
  }
  else if (action.type === 'ACCEPT_DRAW_ATTACK') {
    state.phase = 'resolvingAttack';
    const requested = state.pendingAttack!.amount;
    const drawn = drawCards(state, actor.id, requested);
    log(state, 'draw', `${actor.name} が攻撃を受けて${drawn}枚ドロー${drawn < requested ? '（残りは免除）' : ''}`, actor.id);
    state.consecutivePasses = 0;
    finishAttack(state, state.settings.drawRules.continueAfterDraw ? actor.id : nextPlayerId(state, actor.id));
  } else {
    let drawn = 0; let autoPlay: Card | null = null;
    do {
      const next = takeCard(state); if (!next) break;
      state.players.find(p => p.id === actor.id)!.hand.push(next); drawn++;
      if (state.settings.drawBehavior === 'drawUntilPlayable' && canPlayCard(state, actor.id, next)) { autoPlay = next; break; }
    } while (state.settings.drawBehavior === 'drawUntilPlayable');
    if (drawn) state.finishQueue = state.finishQueue.filter(id => id !== actor.id);
    log(state, 'draw', `${actor.name} が${drawn ? drawn + '枚ドロー' : 'パス（引けるカードがありません）'}`, actor.id);
    state.consecutivePasses = drawn ? 0 : state.consecutivePasses + 1;
    if (autoPlay) applyPlay(state, autoPlay);
    else if (state.consecutivePasses >= state.players.filter(p => p.rank === null).length) {
      state.stalemate = true; state.phase = 'gameOver'; log(state, 'system', '全員が引けないため引き分けになりました');
    } else settleAndAdvance(state, nextPlayerId(state, actor.id));
  }
  // Presentation events are derived after all changes, without affecting game decisions.
  if (state.settings.showUnoEffect) for (const player of state.players) {
    if (player.hand.length === 1 && previous.players.find(p => p.id === player.id)?.hand.length !== 1) log(state, 'uno', `${player.name} — UNO! 残り1枚`, player.id);
  }
  state.events = state.events.slice(-60);
  return state;
}
