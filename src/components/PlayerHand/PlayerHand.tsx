import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GameAction, GameState } from '../../types/game';
import { canPlayCard } from '../../engine/cardValidator';
import { isHandVisible } from '../../engine/visibility';
import { Card } from '../Card/Card';
import { turnBadgeLabel } from '../TurnIndicator/turnPresentation';
import { UnoBadge } from '../UnoBadge/UnoBadge';
import { useHandOrder, type HandOrderController } from './useHandOrder';
import { useHandReorder } from './useHandReorder';
import type { HandSort } from './handOrder';
import styles from './PlayerHand.module.css';

interface Props {
  state: GameState; dispatch: (action: GameAction) => void; expanded?: boolean; onExpand?: () => void;
  uno?: boolean; hiddenCardIds?: string[]; disabled?: boolean; order?: HandOrderController; onEditingChange?: (editing: boolean) => void; onPrepareReorder?: () => void;
}
export function PlayerHand(props: Props) {
  return props.order ? <OrderedHand {...props} order={props.order}/> : <LocalHand {...props}/>;
}
function LocalHand(props: Props) {
  const viewer = props.state.players.find(player => player.id === props.state.viewerId);
  const order = useHandOrder(viewer, props.state.eventSequence === 1);
  return <OrderedHand {...props} order={order}/>;
}
function OrderedHand({ state, dispatch, expanded = false, onExpand, uno = false, hiddenCardIds = [], disabled = false, order, onEditingChange, onPrepareReorder }: Props & { order: HandOrderController }) {
  const viewer = state.players.find(player => player.id === state.viewerId);
  const visible = !!viewer && isHandVisible(state, viewer);
  const reorder = useHandReorder(order, !visible, viewer?.id, onEditingChange, onPrepareReorder);
  const { cards } = order;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRoot = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menuPanel = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 });
  const wasEditing = useRef(false);
  const menuId = useId();
  useLayoutEffect(() => {
    if (wasEditing.current && !reorder.editing) menuButton.current?.focus();
    wasEditing.current = reorder.editing;
  }, [reorder.editing]);
  useLayoutEffect(() => {
    if (!menuOpen || !menuButton.current || !menuPanel.current) return;
    const anchor = menuButton.current.getBoundingClientRect();
    const height = menuPanel.current.getBoundingClientRect().height || 160;
    const width = Math.min(220, window.innerWidth - 16);
    const above = anchor.top - height - 7;
    setMenuPosition({ left: Math.max(8, Math.min(anchor.right - width, window.innerWidth - width - 8)), top: Math.max(8, above >= 8 ? above : Math.min(anchor.bottom + 7, window.innerHeight - height - 8)) });
  }, [menuOpen]);
  useEffect(() => {
    if (!menuOpen) return;
    menuPanel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const outside = (event: globalThis.PointerEvent) => { if (!menuRoot.current?.contains(event.target as Node) && !menuPanel.current?.contains(event.target as Node)) setMenuOpen(false); };
    const close = () => setMenuOpen(false);
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', close); window.addEventListener('scroll', close, true);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', close); window.removeEventListener('scroll', close, true); };
  }, [menuOpen]);
  useEffect(() => { if (!visible) setMenuOpen(false); }, [visible]);
  if (!viewer || !visible) return <div className={styles.wait}>次のプレイヤーの準備を待っています</div>;
  const active = state.phase !== 'gameOver' && state.turnPlayerId === viewer.id;
  const columns = cards.length > 1 ? `repeat(${cards.length - 1}, minmax(0, calc(var(--hand-card-width) + 6px))) var(--hand-card-width)` : 'var(--hand-card-width)';
  const sort = (method: HandSort) => {
    onPrepareReorder?.();
    order.sort(method); setMenuOpen(false); menuButton.current?.focus();
    reorder.setMessage(`${method === 'color' ? '色順' : '数字順'}に並べ替えました。引いたカードは右端に追加します。`);
  };
  return <section data-player-id={viewer.id} data-expanded-hand={expanded ? 'true' : undefined} className={`${styles.handArea} ${active ? styles.active : ''} ${expanded ? styles.expanded : ''}`} aria-current={active ? 'step' : undefined} aria-label={`${viewer.name}の手札${active ? '、現在の手番' : ''}`} onClickCapture={reorder.onClickCapture} onKeyDown={event => {
    if (event.key === 'Escape' && (reorder.editing || menuOpen)) { event.preventDefault(); event.stopPropagation(); reorder.finish(); setMenuOpen(false); menuButton.current?.focus(); }
  }}>
    {uno && <UnoBadge playerName={viewer.name}/>}
    <div className={styles.heading}>
      <span className={styles.handTitle}><strong title={viewer.name}>{viewer.name}</strong>の手札 <b>{cards.length}</b>{active && <em className={styles.turnBadge}>{turnBadgeLabel(state) === '手番' ? 'あなたの番' : turnBadgeLabel(state)}</em>}</span>
      <span className={styles.hint}>{reorder.editing ? 'ドラッグ、または選んで左右に移動' : viewer.rank ? `${viewer.rank}位でフィニッシュ` : disabled ? 'カードを配っています' : active ? state.pendingAttack ? '反撃カードを選ぶ' : '明るいカードを出せます' : '相手のターンです'}</span>
      <div className={styles.orderActions}>
        {reorder.editing ? <>
          <div className={styles.moveControls} role="group" aria-label="選んだカードを移動"><button type="button" disabled={reorder.selectedIndex <= 0} onClick={() => reorder.moveBy(-1)} aria-label="選んだカードを左へ">←</button><button type="button" disabled={reorder.selectedIndex < 0 || reorder.selectedIndex >= cards.length - 1} onClick={() => reorder.moveBy(1)} aria-label="選んだカードを右へ">→</button></div>
          <button type="button" className={styles.doneButton} onClick={reorder.finish}>完了 ✓</button>
        </> : <div ref={menuRoot} className={styles.menuRoot}>
          <button ref={menuButton} type="button" className={styles.orderButton} disabled={cards.length < 2} aria-expanded={menuOpen} aria-controls={menuOpen ? menuId : undefined} onClick={() => setMenuOpen(open => !open)}>並べ替え ▾</button>
          {menuOpen && createPortal(<div ref={menuPanel} id={menuId} data-sort-menu className={styles.sortMenu} style={menuPosition} role="group" aria-label="手札の並べ替え方法" onKeyDown={event => {
            const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')];
            if (event.key === 'Tab' && ((!event.shiftKey && event.target === buttons.at(-1)) || (event.shiftKey && event.target === buttons[0]))) { event.preventDefault(); setMenuOpen(false); menuButton.current?.focus(); }
          }}><button type="button" onClick={() => sort('color')}>色順に並べる <small>赤 → 青 → 緑 → 黄</small></button><button type="button" onClick={() => sort('number')}>数字順に並べる <small>0 → 9 → 記号 → ワイルド</small></button><button type="button" onClick={() => { setMenuOpen(false); reorder.begin(); }}>手動で並べる <small>ドラッグ・左右ボタンで移動</small></button></div>, document.body)}
        </div>}
        {onExpand && !reorder.editing && <button type="button" onClick={onExpand} className={styles.expandButton}>手札一覧 ↗</button>}
      </div>
    </div>
    <div ref={reorder.handRef} className={styles.hand} data-card-source data-reordering={reorder.editing ? 'true' : undefined} style={{ gridTemplateColumns: columns }} {...reorder.pointerHandlers}>
      {cards.map(card => <Card key={card.id} card={card} inFlight={hiddenCardIds.includes(card.id)} playable={!reorder.editing && !disabled && canPlayCard(state, viewer.id, card)} reorderable={reorder.editing} selected={reorder.editing && reorder.selectedId === card.id} dropTarget={reorder.dropTarget === card.id} onClick={() => {
        if (reorder.editing) reorder.select(card.id);
        else dispatch({ type: 'PLAY_CARD', playerId: viewer.id, cardId: card.id });
      }}/>) }
    </div>
    <span className={styles.srOnly} role="status" aria-live="polite">{reorder.message}</span>
  </section>;
}
