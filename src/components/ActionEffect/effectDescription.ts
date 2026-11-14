import type { GameState } from '../../types/game';
import type { Card } from '../../types/card';
import { defenseType, type Defense } from '../../engine/attackManager';
import { nextPlayerId } from '../../engine/turnManager';
import { playedCardBetween } from '../CardMotion/placement';

export const ACTION_EFFECT_DURATION = 900;
export const DEFENSE_IMPACT_DURATION = 160;
export const DEFENSE_RESOLVE_DURATION = 680;
export interface ActionEffectDescription {
  id: string;
  kind: 'skip' | 'reverse' | Defense;
  defense: Defense | null;
  card: Card;
  actorId: string;
  targetId: string | null;
  direction: 1 | -1;
  title: string;
  detail: string;
  targetLabel: string;
}
export interface ActionEffectVisual extends ActionEffectDescription {
  stage: 'impact' | 'resolve';
  anchor: DOMRect;
  pile: DOMRect;
  landing: DOMRect;
  actor: DOMRect | undefined;
  target: DOMRect | undefined;
}

// Read the actual result of a legal play; never simulate another game action for an effect.
export function actionEffectBetween(before: GameState, after: GameState, playerId: string): ActionEffectDescription | null {
  const played = playedCardBetween(before, after, playerId);
  if (!played) return null;
  const defense = before.pendingAttack ? defenseType(before, played.card) : null;
  if (!defense && played.card.kind !== 'skip' && played.card.kind !== 'reverse') return null;
  const reversing = played.card.kind === 'reverse';
  const attacking = defense !== null;
  const kind = defense ?? (reversing ? 'reverse' : 'skip');
  const targetId = attacking ? kind === 'cancel' ? null : after.pendingAttack?.targetPlayerId ?? null
    : reversing ? after.phase === 'gameOver' ? null : after.turnPlayerId : nextPlayerId(before, playerId);
  const target = after.players.find(player => player.id === targetId);
  const again = !attacking && reversing && before.players.filter(player => player.rank === null).length === 2;
  const description: ActionEffectDescription = {
    id: `effect-${played.eventId}-${played.card.id}`, kind, defense, card: played.card, actorId: playerId, targetId, direction: after.direction,
    title: { skip: 'スキップ！', reverse: 'リバース！', transfer: '攻撃を転送！', reflect: '攻撃を反射！', stack: '重ねがけ！', cancel: '攻撃を無効化！' }[kind],
    detail: '', targetLabel: kind === 'skip' ? 'お休み' : kind === 'reverse' ? again ? 'もう一度' : '次の手番' : '反撃の番',
  };
  if (kind === 'cancel') description.detail = `+${before.pendingAttack!.amount}のドロー攻撃を防いだ`;
  else if (kind === 'stack') description.detail = `+${before.pendingAttack!.amount} → +${after.pendingAttack!.amount} · ${target?.name ?? '次の人'}へ`;
  else if (attacking) description.detail = `+${before.pendingAttack!.amount}を${target?.name ?? '次の人'}へ${reversing ? '返す' : '送る'}`;
  else if (reversing) description.detail = again ? `方向を逆転 · もう一度${before.players.find(player => player.id === playerId)!.name}の番` : `${after.direction === 1 ? '時計回り' : '反時計回り'}に変更`;
  else description.detail = `${target?.name ?? '次の人'}の番をお休み`;
  return description;
}
