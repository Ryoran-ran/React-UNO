import { useCallback, useState } from 'react';
import type { NormalColor } from '../../types/card';
import type { GameAction, GameState } from '../../types/game';
import { prepareColorChoice } from './colorChoice';

export function useColorChoice(state: GameState | null, dispatch: (action: GameAction) => void) {
  const [draft, setDraft] = useState<ReturnType<typeof prepareColorChoice>>(null);
  // A different game state invalidates any uncommitted choice, including a restart or handoff.
  const pendingPlay = draft?.game === state ? draft : null;
  const requestAction = useCallback((action: GameAction) => {
    const choice = state ? prepareColorChoice(state, action) : null;
    if (choice) setDraft(choice);
    else { setDraft(null); dispatch(action); }
  }, [state, dispatch]);
  const cancelChoice = useCallback(() => setDraft(null), []);
  const selectColor = useCallback((color: NormalColor) => {
    if (!pendingPlay) return;
    setDraft(null);
    dispatch({ type: 'PLAY_CARD', playerId: pendingPlay.playerId, cardId: pendingPlay.card.id, color });
  }, [pendingPlay, dispatch]);
  return { pendingPlay, requestAction, cancelChoice, selectColor };
}
