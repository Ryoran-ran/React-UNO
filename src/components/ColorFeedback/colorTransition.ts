import type { NormalColor } from '../../types/card';
import type { GameState } from '../../types/game';
import { needsColorOnPlay } from '../../engine/cardValidator';
import { playedCardBetween } from '../CardMotion/placement';

export const COLOR_NOTICE_DURATION = 760;
export interface ColorAnnouncement {
  id: string;
  playerName: string;
  color: NormalColor;
  previousColor: NormalColor;
}

// A selection is meaningful even when the player chooses the existing color.
export function selectedColorBetween(before: GameState, after: GameState): ColorAnnouncement | null {
  if (after.eventSequence <= before.eventSequence || after.colorSelection) return null;
  const played = playedCardBetween(before, after, before.turnPlayerId);
  const playerId = before.colorSelection?.playerId ?? (
    played && needsColorOnPlay(before, played.card) ? before.turnPlayerId : null
  );
  if (!playerId) return null;
  return { id: `color-${after.eventSequence}-${playerId}`, playerName: after.players.find(player => player.id === playerId)!.name, color: after.activeColor, previousColor: before.activeColor };
}
