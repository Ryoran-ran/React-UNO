import type { GameState } from '../types/game';
export function settleRankings(state: GameState): void {
  if (state.pendingAttack || state.colorSelection) return;
  for (const id of state.finishQueue) {
    const player = state.players.find(p => p.id === id)!;
    if (player.hand.length || player.rank !== null) continue;
    state.rankings.push(id); player.rank = state.rankings.length;
    state.events.push({ id: ++state.eventSequence, type: 'rank', text: `${player.name} が${player.rank}位でフィニッシュ！`, playerId: id });
    if (state.settings.gameMode === 'first') { state.phase = 'gameOver'; break; }
  }
  state.finishQueue = [];
  if (state.settings.gameMode === 'ranking' && state.players.filter(p => p.rank === null).length <= 1) {
    const last = state.players.find(p => p.rank === null);
    if (last) { state.rankings.push(last.id); last.rank = state.rankings.length; }
    state.phase = 'gameOver';
  }
}
