import type { GameState } from '../types/game';
import type { Player } from '../types/player';
export function isHandVisible(state: GameState, player: Player, viewerId = state.viewerId): boolean {
  if (state.phase === 'playerHandoff') return false;
  return state.settings.handVisibility === 'all' || (player.id === viewerId && player.type === 'human') || (state.settings.handVisibility === 'cpu' && player.type === 'cpu');
}
