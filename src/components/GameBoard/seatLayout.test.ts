import { describe, expect, it } from 'vitest';
import { createGame } from '../../engine/gameEngine';
import { nextPlayerId } from '../../engine/turnManager';
import { getSeatLayout } from './seatLayout';

const ids = (players: { id: string }[]) => players.map(player => player.id);

describe('screen seats follow the same clockwise order as the engine', () => {
  it.each([2, 3, 4, 5, 6, 7, 8])('matches every viewer and both directions with %i players', count => {
    const state = createGame({ playerCount: count }, 42);
    for (const viewer of state.players) {
      const seats = getSeatLayout(state.players, viewer.id);
      // Travel physically around the table from its bottom edge.
      const physicalClockwise = [viewer.id, ...ids([...seats.left].reverse()), ...ids(seats.top), ...ids(seats.right)];
      expect(physicalClockwise).toEqual(ids(seats.clockwise));
      expect(new Set(physicalClockwise).size).toBe(count);
      for (const direction of [1, -1] as const) {
        state.direction = direction;
        for (let i = 0; i < count; i++) {
          expect(nextPlayerId(state, physicalClockwise[i])).toBe(physicalClockwise[(i + direction + count) % count]);
        }
      }
    }
  });
  it('places eight-player seats up the left, across the top and down the right', () => {
    const state = createGame({ playerCount: 8 }, 42);
    const seats = getSeatLayout(state.players, 'p0');
    expect(ids(seats.left)).toEqual(['p2', 'p1']);
    expect(ids(seats.top)).toEqual(['p3', 'p4', 'p5']);
    expect(ids(seats.right)).toEqual(['p6', 'p7']);
  });
  it('keeps finished players in their seats while turns pass them clockwise', () => {
    const state = createGame({ playerCount: 8 }, 42);
    const before = getSeatLayout(state.players, 'p3');
    state.players[4].rank = 1; state.players[6].rank = 2;
    const after = getSeatLayout(state.players, 'p3');
    expect(ids(after.clockwise)).toEqual(ids(before.clockwise));
    const active = after.clockwise.filter(player => player.rank === null);
    for (let i = 0; i < active.length; i++) expect(nextPlayerId(state, active[i].id)).toBe(active[(i + 1) % active.length].id);
  });
  it('keeps the first seat as the anchor before a human confirms handoff', () => {
    const state = createGame({ playerCount: 8, humanPlayerCount: 2 }, 42);
    expect(getSeatLayout(state.players, null)).toEqual(getSeatLayout(state.players, 'p0'));
    expect(getSeatLayout(state.players, 'p1').anchorPlayerId).toBe('p1');
  });
});
