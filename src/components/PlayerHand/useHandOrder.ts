import { useCallback, useState } from 'react';
import type { Card } from '../../types/card';
import type { Player } from '../../types/player';
import { appendNewCards, initialHandOrder, moveHandCard, sortHand, type HandSort } from './handOrder';

interface Entry { hand: Card[]; cards: Card[] }
export interface HandOrderController {
  cards: Card[];
  sort: (order: HandSort) => void;
  move: (cardId: string, targetId: string) => void;
}

export function useHandOrder(player: Player | undefined, newGame = false): HandOrderController {
  const [last, setLast] = useState<{ newGame: boolean; players: Record<string, Entry> }>(() => ({ newGame, players: {} }));
  let players = newGame && !last.newGame ? {} as Record<string, Entry> : last.players;
  let entry = player ? players[player.id] : undefined;
  if (player && entry?.hand !== player.hand) {
    entry = { hand: player.hand, cards: entry ? appendNewCards(entry.cards, player.hand) : initialHandOrder(player.hand) };
    players = { ...players, [player.id]: entry };
  }
  if (players !== last.players || newGame !== last.newGame) setLast({ newGame, players });
  const update = useCallback((transform: (cards: Card[]) => Card[]) => {
    if (!player) return;
    setLast(previous => {
      const current = previous.players[player.id];
      const cards = current ? appendNewCards(current.cards, player.hand) : initialHandOrder(player.hand);
      return { ...previous, players: { ...previous.players, [player.id]: { hand: player.hand, cards: transform(cards) } } };
    });
  }, [player]);
  const sort = useCallback((order: HandSort) => update(cards => sortHand(cards, order)), [update]);
  const move = useCallback((cardId: string, targetId: string) => update(cards => moveHandCard(cards, cardId, targetId)), [update]);
  return { cards: entry?.cards ?? [], sort, move };
}
