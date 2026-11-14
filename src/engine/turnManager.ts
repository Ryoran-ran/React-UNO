import type { GameState, Phase } from '../types/game';
export function nextPlayerId(state: GameState, from = state.turnPlayerId, steps = 1): string {
  const active = state.players.filter(p => p.rank === null);
  // A completed ranking game has no active seat; keep the terminal turn unchanged.
  if (!active.length) return from;
  const index = active.findIndex(p => p.id === from);
  if (index < 0) {
    let i = state.players.findIndex(p => p.id === from);
    do { i = (i + state.direction + state.players.length) % state.players.length; } while (state.players[i].rank !== null);
    return steps === 1 ? state.players[i].id : nextPlayerId(state, state.players[i].id, steps - 1);
  }
  return active[(index + state.direction * steps % active.length + active.length) % active.length].id;
}
export function activatePhase(state: GameState, playerId: string, phase: Phase): void {
  state.turnPlayerId = playerId;
  const player = state.players.find(p => p.id === playerId)!;
  const needsHandoff = player.type === 'human' && state.settings.humanPlayerCount > 1 && state.settings.handVisibility !== 'all' && state.viewerId !== playerId;
  state.phase = needsHandoff ? 'playerHandoff' : phase;
  state.handoffPhase = needsHandoff ? phase : null;
  if (player.type === 'human' && !needsHandoff) state.viewerId = playerId;
}
