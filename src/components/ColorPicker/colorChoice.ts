import type { GameAction, GameState } from '../../types/game';
import { canPlayCard, needsColorOnPlay } from '../../engine/cardValidator';

export function prepareColorChoice(state: GameState, action: GameAction) {
  if (action.type !== 'PLAY_CARD' || action.color !== undefined) return null;
  const player = state.players.find(candidate => candidate.id === action.playerId);
  const card = player?.hand.find(candidate => candidate.id === action.cardId);
  if (player?.type !== 'human' || !card || !canPlayCard(state, player.id, card) || !needsColorOnPlay(state, card)) return null;
  return { game: state, playerId: player.id, playerName: player.name, card };
}
