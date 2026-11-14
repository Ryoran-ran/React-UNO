import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Card, NormalColor } from '../../types/card';
import type { GameAction, GameState } from '../../types/game';
import { isHandVisible } from '../../engine/visibility';
import { drawnCardsBetween, playedCardBetween } from './placement';
import { ACTION_EFFECT_DURATION, DEFENSE_IMPACT_DURATION, DEFENSE_RESOLVE_DURATION, actionEffectBetween, type ActionEffectDescription, type ActionEffectVisual } from '../ActionEffect/effectDescription';
import { COLOR_NOTICE_DURATION, selectedColorBetween, type ColorAnnouncement } from '../ColorFeedback/colorTransition';

export const PLACEMENT_DURATION = 560;
export const DRAW_DURATION = 440;
export interface CardFlight {
  id: string;
  kind: 'play' | 'draw';
  playerId?: string;
  cardId: string;
  card: Card | null;
  source: DOMRect;
  destination: DOMRect;
  flip: boolean;
  hidden: boolean;
  delay: number;
  duration: number;
  groupId?: string;
  lastInGroup?: boolean;
  drawnIds?: string[];
  drawCount?: number;
  playerName?: string;
  handRect?: DOMRect;
  actionEffect?: ActionEffectDescription | null;
  resolvedColor?: NormalColor;
}
interface PendingMotion {
  before: GameState;
  playerId: string;
  source: DOMRect;
  deck: DOMRect | undefined;
  hand: DOMRect | undefined;
  oldCards: Map<string, DOMRect>;
  flip: boolean;
  skipHandLock: boolean;
}
const visibleRect = (element: HTMLElement | null | undefined) => {
  const rect = element?.getBoundingClientRect();
  return rect?.width && rect.height ? rect : undefined;
};
const playerElement = (board: HTMLElement, id: string) => {
  const seats = [...board.querySelectorAll<HTMLElement>('[data-player-id]')].filter(element => element.dataset.playerId === id);
  return seats.find(element => element.dataset.expandedHand === 'true') ?? seats[0];
};
const cardElement = (root: HTMLElement, id: string) => [...root.querySelectorAll<HTMLElement>('[data-card-id]')].find(element => element.dataset.cardId === id);

export function useCardMotion(state: GameState | null, dispatch: (action: GameAction) => void) {
  const boardRef = useRef<HTMLDivElement>(null);
  const pending = useRef<PendingMotion | null>(null);
  const timers = useRef(new Map<string, number>());
  const active = useRef(new Map<string, CardFlight>());
  const locks = useRef(new Map<HTMLElement, string>());
  const settling = useRef(new Map<HTMLElement, Animation>());
  const [flights, setFlights] = useState<CardFlight[]>([]);
  const [actionEffect, setActionEffect] = useState<ActionEffectVisual | null>(null);
  const effectTimer = useRef<number | undefined>(undefined);
  const observed = useRef(state);
  const queuedColor = useRef<ColorAnnouncement | null>(null);
  const colorTimer = useRef<number | undefined>(undefined);
  const [colorAnnouncement, setColorAnnouncement] = useState<ColorAnnouncement | null>(null);
  const [presentedColor, setPresentedColor] = useState<NormalColor>(state?.activeColor ?? 'red');

  const revealColor = useCallback(() => {
    const announcement = queuedColor.current;
    queuedColor.current = null;
    if (!announcement) return;
    window.clearTimeout(colorTimer.current);
    setPresentedColor(announcement.color);
    setColorAnnouncement(announcement);
    colorTimer.current = window.setTimeout(() => { setColorAnnouncement(null); colorTimer.current = undefined; }, COLOR_NOTICE_DURATION);
  }, []);

  const showActionEffect = useCallback((description: ActionEffectDescription) => {
    const board = boardRef.current;
    if (!board) return;
    const anchor = visibleRect(board.querySelector<HTMLElement>('[data-turn-status]')) ?? visibleRect(board.querySelector<HTMLElement>('[data-discard-target]'));
    if (!anchor) return;
    const pile = visibleRect(board.querySelector<HTMLElement>('[data-effect-piles]')) ?? anchor;
    const landing = visibleRect(board.querySelector<HTMLElement>('[data-discard-target]')) ?? pile;
    const actor = visibleRect(playerElement(board, description.actorId));
    const target = description.targetId ? visibleRect(playerElement(board, description.targetId)) : undefined;
    window.clearTimeout(effectTimer.current);
    const visual = { ...description, anchor, pile, landing, actor, target };
    const finish = () => { setActionEffect(null); effectTimer.current = undefined; revealColor(); };
    if (description.defense) {
      setActionEffect({ ...visual, stage: 'impact' });
      effectTimer.current = window.setTimeout(() => {
        setActionEffect({ ...visual, stage: 'resolve' });
        effectTimer.current = window.setTimeout(finish, DEFENSE_RESOLVE_DURATION);
      }, DEFENSE_IMPACT_DURATION);
    } else {
      setActionEffect({ ...visual, stage: 'resolve' });
      effectTimer.current = window.setTimeout(finish, ACTION_EFFECT_DURATION);
    }
  }, [revealColor]);

  const releaseHand = useCallback((smooth: boolean, playerId?: string) => {
    const matches = (element: HTMLElement) => !playerId || element.closest<HTMLElement>('[data-player-id]')?.dataset.playerId === playerId;
    for (const [element, animation] of settling.current) {
      if (!matches(element)) continue;
      animation.cancel?.(); settling.current.delete(element);
    }
    for (const [element, original] of locks.current) {
      if (!matches(element)) continue;
      if (smooth && element.isConnected && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const animation = element.animate([{ translate: element.style.translate }, { translate: original || '0px 0px' }], { duration: 160, easing: 'ease-out' });
        settling.current.set(element, animation);
        const finished = () => { if (settling.current.get(element) === animation) settling.current.delete(element); };
        void animation.finished?.then(finished, finished);
      }
      element.style.translate = original;
      locks.current.delete(element);
    }
  }, []);

  const prepareHandReorder = useCallback((playerId?: string) => { if (playerId) releaseHand(false, playerId); }, [releaseHand]);
  const refreshHandLayout = useCallback(() => {
    const board = boardRef.current;
    if (!board) return;
    const sameRect = (a: DOMRect | undefined, b: DOMRect | undefined) => a && b && Math.abs(a.left - b.left) < .5 && Math.abs(a.top - b.top) < .5 && Math.abs(a.width - b.width) < .5 && Math.abs(a.height - b.height) < .5;
    let changed = false;
    for (const [id, flight] of active.current) {
      if (flight.kind !== 'draw' || flight.hidden || !flight.playerId) continue;
      const hand = playerElement(board, flight.playerId);
      const destination = hand && visibleRect(cardElement(hand, flight.cardId));
      const handRect = visibleRect(hand?.querySelector<HTMLElement>('[data-card-source]'));
      if (!destination || (sameRect(destination, flight.destination) && sameRect(handRect, flight.handRect))) continue;
      active.current.set(id, { ...flight, destination, handRect: handRect ?? flight.handRect }); changed = true;
    }
    if (changed) setFlights([...active.current.values()]);
  }, []);

  const finishFlight = useCallback((id: string) => {
    const flight = active.current.get(id);
    if (!flight || (flight.kind === 'draw' && !flight.lastInGroup)) return;
    if (flight.resolvedColor) setPresentedColor(flight.resolvedColor);
    if (flight.kind === 'play' && flight.actionEffect) showActionEffect(flight.actionEffect);
    const completed = flight.groupId ? [...active.current.values()].filter(item => item.groupId === flight.groupId).map(item => item.id) : [id];
    for (const completedId of completed) {
      window.clearTimeout(timers.current.get(completedId));
      timers.current.delete(completedId);
      active.current.delete(completedId);
    }
    if (!active.current.size) {
      releaseHand(true);
      if (effectTimer.current === undefined) revealColor();
    }
    setFlights(current => current.filter(item => !completed.includes(item.id)));
  }, [releaseHand, showActionEffect, revealColor]);

  const clearFlights = useCallback(() => {
    for (const timer of timers.current.values()) window.clearTimeout(timer);
    timers.current.clear(); active.current.clear(); pending.current = null;
    window.clearTimeout(effectTimer.current); effectTimer.current = undefined; setActionEffect(null);
    window.clearTimeout(colorTimer.current); colorTimer.current = undefined;
    queuedColor.current = null; setColorAnnouncement(null);
    if (observed.current) setPresentedColor(observed.current.activeColor);
    releaseHand(false);
    setFlights(current => current.length ? [] : current);
  }, [releaseHand]);

  const dispatchWithMotion = useCallback((action: GameAction) => {
    pending.current = null;
    const board = boardRef.current;
    if (state && board && !state.settings.reducedMotion && !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
      (action.type === 'PLAY_CARD' || action.type === 'DRAW_CARD' || action.type === 'ACCEPT_DRAW_ATTACK')) {
      const actor = state.players.find(player => player.id === action.playerId);
      const hand = playerElement(board, action.playerId);
      const deck = visibleRect(board.querySelector<HTMLElement>('[data-draw-source]'));
      const ownCard = action.type === 'PLAY_CARD' ? cardElement(board, action.cardId) : undefined;
      const source = action.type === 'PLAY_CARD'
        ? visibleRect(ownCard) ?? visibleRect(hand?.querySelector<HTMLElement>('[data-card-source] > div:last-of-type')) ?? visibleRect(hand)
        : deck;
      if (actor && source) {
        const oldCards = new Map<string, DOMRect>();
        for (const element of hand?.querySelectorAll<HTMLElement>('[data-card-id]') ?? []) {
          const rect = visibleRect(element);
          if (rect && element.dataset.cardId) oldCards.set(element.dataset.cardId, rect);
        }
        pending.current = { before: state, playerId: actor.id, source, deck, hand: visibleRect(hand), oldCards, flip: action.type !== 'PLAY_CARD' || !isHandVisible(state, actor), skipHandLock: !!hand?.querySelector('[data-reorder-dragging]') };
      }
    }
    dispatch(action);
  }, [state, dispatch]);

  useLayoutEffect(() => {
    const previous = observed.current;
    observed.current = state;
    const announcement = previous && state ? selectedColorBetween(previous, state) : null;
    if (announcement) queuedColor.current = announcement;
    const captured = pending.current;
    pending.current = null;
    const board = boardRef.current;
    const revealWithoutFlight = () => {
      if (state && !active.current.size && effectTimer.current === undefined) {
        setPresentedColor(state.activeColor);
        revealColor();
      }
    };
    if (!state || !captured || !board || state.settings.reducedMotion) { revealWithoutFlight(); return; }
    const played = playedCardBetween(captured.before, state, captured.playerId);
    const drawn = drawnCardsBetween(captured.before, state, captured.playerId);
    const batch: CardFlight[] = [];
    let playDelay = 0;

    if (drawn.length && captured.deck) {
      const player = state.players.find(candidate => candidate.id === captured.playerId)!;
      const hand = playerElement(board, player.id);
      const handRect = visibleRect(hand?.querySelector<HTMLElement>('[data-card-source]')) ?? visibleRect(hand) ?? captured.hand;
      if (handRect) {
        const visible = isHandVisible(state, player);
        const previews = drawn.slice(-8);
        const groupId = `draw-${state.eventSequence}-${player.id}`;
        const mini = visibleRect(hand?.querySelector<HTMLElement>('[data-card-source] > div:last-of-type'));
        const width = mini?.width ?? Math.min(45, handRect.width * .3);
        const fallback = mini ?? new DOMRect(handRect.left + handRect.width / 2 - width / 2, handRect.top + handRect.height / 2 - width * .75, width, width * 1.5);
        previews.forEach((card, index) => {
          const destination = visible && hand ? visibleRect(cardElement(hand, card.id)) ?? fallback : fallback;
          batch.push({ id: `${groupId}-${index}`, groupId, kind: 'draw', playerId: player.id, cardId: card.id, card: visible ? card : null, source: captured.deck!, destination,
            flip: visible, hidden: !visible, delay: index * 55, duration: DRAW_DURATION, lastInGroup: index === previews.length - 1,
            drawnIds: drawn.map(item => item.id), drawCount: drawn.length + (played ? 1 : 0), playerName: player.name, handRect });
        });
        // Hold already visible cards at their previous coordinates until the deal completes.
        if (hand && !captured.skipHandLock) for (const [id, previousRect] of captured.oldCards) {
          const element = cardElement(hand, id);
          const currentRect = visibleRect(element);
          if (!element || !currentRect) continue;
          const x = previousRect.left - currentRect.left;
          const y = previousRect.top - currentRect.top;
          if (Math.abs(x) < .5 && Math.abs(y) < .5) continue;
          locks.current.set(element, element.style.translate);
          element.style.translate = `${x}px ${y}px`;
        }
        playDelay = DRAW_DURATION + (previews.length - 1) * 55;
      }
    }

    const destination = visibleRect(board.querySelector<HTMLElement>('[data-discard-target]'));
    if (played && destination) batch.push({ id: `play-${played.eventId}-${played.card.id}`, kind: 'play', cardId: played.card.id, card: played.card,
      source: captured.source, destination, flip: captured.flip, hidden: false, delay: playDelay, duration: PLACEMENT_DURATION,
      actionEffect: actionEffectBetween(captured.before, state, captured.playerId), resolvedColor: state.activeColor });
    if (!batch.length) { revealWithoutFlight(); return; }
    if (!batch.some(flight => flight.kind === 'play')) setPresentedColor(state.activeColor);
    for (const flight of batch) {
      active.current.set(flight.id, flight);
      if (flight.kind === 'play' || flight.lastInGroup) timers.current.set(flight.id, window.setTimeout(() => finishFlight(flight.id), flight.delay + flight.duration + 140));
    }
    setFlights(current => [...current, ...batch]);
  }, [state, finishFlight, revealColor]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onPreference = () => { if (media.matches) clearFlights(); };
    media.addEventListener('change', onPreference);
    window.addEventListener('resize', clearFlights);
    window.addEventListener('scroll', clearFlights, { capture: true, passive: true });
    const currentTimers = timers.current;
    const currentLocks = locks.current;
    const currentSettling = settling.current;
    return () => {
      media.removeEventListener('change', onPreference);
      window.removeEventListener('resize', clearFlights);
      window.removeEventListener('scroll', clearFlights, true);
      for (const timer of currentTimers.values()) window.clearTimeout(timer);
      window.clearTimeout(effectTimer.current);
      window.clearTimeout(colorTimer.current);
      currentTimers.clear();
      for (const [element, original] of currentLocks) element.style.translate = original;
      currentLocks.clear();
      for (const animation of currentSettling.values()) animation.cancel?.();
      currentSettling.clear();
    };
  }, [clearFlights]);

  useEffect(() => {
    if (!state || state.eventSequence === 1) clearFlights();
  }, [state?.eventSequence, clearFlights]);
  useEffect(() => {
    if (state?.settings.reducedMotion) clearFlights();
  }, [state?.settings.reducedMotion, clearFlights]);

  const hiddenDrawIds = [...new Set(flights.flatMap(flight => flight.kind === 'draw' ? flight.drawnIds ?? [] : []))];
  return { boardRef, flights, hiddenDrawIds, actionEffect, colorAnnouncement, presentedColor, prepareHandReorder, refreshHandLayout, busy: flights.length > 0 || actionEffect !== null || colorAnnouncement !== null, dispatchWithMotion, finishFlight };
}
