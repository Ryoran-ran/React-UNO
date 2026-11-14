import type { GameState } from '../../types/game';

// Observe completed engine transitions; an animation never advances a turn.
export function playedCardBetween(before: GameState, after: GameState, playerId: string) {
  const card = after.discardPile.at(-1);
  if (!card || card.id === before.discardPile.at(-1)?.id || after.eventSequence <= before.eventSequence) return null;
  const play = [...after.events].reverse().find(event => event.type === 'play' && event.id > before.eventSequence);
  return play?.playerId === playerId ? { card, eventId: play.id } : null;
}

export function cardTilt(cardId: string): number {
  let hash = 0;
  for (const character of cardId) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) | 0;
  return (Math.abs(hash) % 15) - 7;
}

export function drawnCardsBetween(before: GameState, after: GameState, playerId: string) {
  if (after.eventSequence <= before.eventSequence || !after.events.some(event => event.type === 'draw' && event.playerId === playerId && event.id > before.eventSequence)) return [];
  const previousIds = new Set(before.players.find(player => player.id === playerId)?.hand.map(card => card.id));
  return after.players.find(player => player.id === playerId)?.hand.filter(card => !previousIds.has(card.id)) ?? [];
}
