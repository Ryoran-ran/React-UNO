import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { cardLabel } from '../../types/card';
import type { HandOrderController } from './useHandOrder';

interface Drag {
  pointerId: number; cardId: string; x: number; y: number; moved: boolean; targetId: string;
  element: HTMLElement; hand: HTMLDivElement; translate: string; zIndex: string;
  rects: { id: string; rect: DOMRect }[]; source: DOMRect;
}

export function useHandReorder(order: HandOrderController, disabled: boolean, playerId: string | undefined, onEditingChange?: (editing: boolean) => void, prepareReorder?: () => void) {
  const [editing, setEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const handRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const focusAfterMove = useRef(false);
  const suppressClick = useRef(false);
  const clickTimer = useRef<number | undefined>(undefined);
  const cancelDrag = useCallback(() => {
    const current = drag.current;
    drag.current = null;
    if (current) {
      current.element.style.translate = current.translate; current.element.style.zIndex = current.zIndex;
      current.element.removeAttribute('data-reorder-dragging');
      if (current.hand.hasPointerCapture?.(current.pointerId)) current.hand.releasePointerCapture(current.pointerId);
    }
    setDropTarget(null);
  }, []);
  useEffect(() => { onEditingChange?.(editing); }, [editing, onEditingChange]);
  useEffect(() => () => { onEditingChange?.(false); }, [onEditingChange]);
  useEffect(() => { setEditing(false); setSelectedId(null); }, [playerId]);
  useEffect(() => {
    if (!editing || disabled) cancelDrag();
    if (disabled) setEditing(false);
  }, [editing, disabled, cancelDrag]);
  useEffect(() => () => { cancelDrag(); window.clearTimeout(clickTimer.current); }, [cancelDrag]);
  const handSignature = order.cards.map(card => card.id).join('|');
  useLayoutEffect(() => { cancelDrag(); }, [handSignature, cancelDrag]);
  useEffect(() => {
    window.addEventListener('resize', cancelDrag); window.addEventListener('scroll', cancelDrag, true);
    return () => { window.removeEventListener('resize', cancelDrag); window.removeEventListener('scroll', cancelDrag, true); };
  }, [cancelDrag]);
  useLayoutEffect(() => {
    if (editing && focusAfterMove.current) {
      [...(handRef.current?.querySelectorAll<HTMLButtonElement>('[data-card-id]') ?? [])].find(element => element.dataset.cardId === selectedId)?.focus();
      focusAfterMove.current = false;
    }
  }, [editing, selectedId, order.cards]);

  const moveTo = (cardId: string, targetId: string) => {
    const card = order.cards.find(item => item.id === cardId);
    const index = order.cards.findIndex(item => item.id === targetId);
    if (!card || index < 0 || cardId === targetId) return;
    prepareReorder?.();
    order.move(cardId, targetId); setSelectedId(cardId); focusAfterMove.current = true;
    setMessage(`${cardLabel(card)}を${index + 1}番目に移動しました`);
  };
  const selectedIndex = order.cards.findIndex(card => card.id === selectedId);
  const moveBy = (offset: number) => {
    if (disabled || selectedIndex < 0) return;
    const target = order.cards[selectedIndex + offset];
    if (target) moveTo(selectedId!, target.id);
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!editing || disabled || event.button !== 0 || event.isPrimary === false) return;
    const element = (event.target as HTMLElement).closest<HTMLElement>('button[data-card-id]');
    if (!element?.dataset.cardId) return;
    cancelDrag(); prepareReorder?.(); setSelectedId(element.dataset.cardId);
    drag.current = { pointerId: event.pointerId, cardId: element.dataset.cardId, x: event.clientX, y: event.clientY, moved: false, targetId: element.dataset.cardId,
      element, hand: event.currentTarget, translate: element.style.translate, zIndex: element.style.zIndex, source: element.getBoundingClientRect(),
      rects: [...event.currentTarget.querySelectorAll<HTMLElement>('[data-card-id]')].map(card => ({ id: card.dataset.cardId!, rect: card.getBoundingClientRect() })) };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.x; const dy = event.clientY - current.y;
    if (!current.moved && Math.hypot(dx, dy) < 7) return;
    if (!current.moved) { current.moved = true; current.element.setAttribute('data-reorder-dragging', 'true'); current.hand.setPointerCapture?.(event.pointerId); }
    event.preventDefault();
    current.element.style.translate = `${dx}px ${dy}px`; current.element.style.zIndex = '30';
    const x = current.source.left + current.source.width / 2 + dx;
    const y = current.source.top + current.source.height / 2 + dy;
    const target = current.rects.reduce((nearest, candidate) => {
      const distance = (rect: DOMRect) => Math.hypot(x - rect.left - rect.width / 2, y - rect.top - rect.height / 2);
      return distance(candidate.rect) < distance(nearest.rect) ? candidate : nearest;
    });
    current.targetId = target.id;
    setDropTarget(target.id === current.cardId ? null : target.id);
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    cancelDrag();
    if (current.moved) {
      moveTo(current.cardId, current.targetId);
      suppressClick.current = true;
      window.clearTimeout(clickTimer.current);
      clickTimer.current = window.setTimeout(() => { suppressClick.current = false; }, 0);
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!editing || disabled) return;
    const id = (event.target as HTMLElement).closest<HTMLElement>('[data-card-id]')?.dataset.cardId;
    if (!id) return;
    const index = order.cards.findIndex(card => card.id === id);
    const target = event.key === 'ArrowLeft' ? order.cards[index - 1] : event.key === 'ArrowRight' ? order.cards[index + 1]
      : event.key === 'Home' ? order.cards[0] : event.key === 'End' ? order.cards.at(-1) : undefined;
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) event.preventDefault();
    if (target) moveTo(id, target.id);
  };
  return { editing, selectedId, selectedIndex, dropTarget, message, setMessage, handRef,
    begin: () => { if (!disabled) { prepareReorder?.(); setSelectedId(order.cards[0]?.id ?? null); focusAfterMove.current = true; setEditing(true); } },
    finish: () => { cancelDrag(); setEditing(false); }, select: setSelectedId, moveBy,
    onClickCapture: (event: MouseEvent) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } },
    pointerHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: cancelDrag,
      onLostPointerCapture: (event: PointerEvent<HTMLDivElement>) => { if (event.target === event.currentTarget && drag.current?.pointerId === event.pointerId) cancelDrag(); }, onKeyDown },
  };
}
