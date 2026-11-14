import type { Player } from '../../types/player';

/** Read each group in screen order: left/top/right are all rendered top-to-bottom or left-to-right. */
export function getSeatLayout(players: readonly Player[], viewerId: string | null) {
  if (!players.length) return { anchorPlayerId: null, clockwise: [] as Player[], left: [] as Player[], top: [] as Player[], right: [] as Player[] };
  const found = players.findIndex(player => player.id === viewerId);
  const anchorIndex = found >= 0 ? found : 0;
  const anchor = players[anchorIndex];
  // The viewer sits below the table. Clockwise from that seat travels up the left edge first.
  const opponents = [...players.slice(anchorIndex + 1), ...players.slice(0, anchorIndex)];
  const sideCount = players.length >= 6 ? 2 : players.length >= 4 ? 1 : 0;
  return {
    anchorPlayerId: anchor.id,
    clockwise: [anchor, ...opponents],
    left: opponents.slice(0, sideCount).reverse(),
    top: opponents.slice(sideCount, opponents.length - sideCount),
    right: sideCount ? opponents.slice(-sideCount) : [],
  };
}
