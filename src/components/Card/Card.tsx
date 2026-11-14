import type { Card as CardType } from '../../types/card';
import { cardLabel } from '../../types/card';
import styles from './Card.module.css';
interface Props { card?: CardType; hidden?: boolean; small?: boolean; playable?: boolean; onClick?: () => void; decorative?: boolean; inFlight?: boolean; reorderable?: boolean; selected?: boolean; dropTarget?: boolean }
export function Card({ card, hidden, small, playable, onClick, decorative, inFlight, reorderable, selected, dropTarget }: Props) {
  const symbols: Record<string, string> = { skip: '⊘', reverse: '⇄', draw2: '+2', wild: '✦', wild4: '+4' };
  const symbol = !card ? '' : card.kind === 'number' ? String(card.value) : (symbols[card.kind] ?? '✦');
  const className = [styles.card, small && styles.small, hidden ? styles.back : styles[card?.color ?? 'wild'], playable && styles.playable, onClick && styles.interactive, inFlight && styles.inFlight, reorderable && styles.reorderable, selected && styles.selected, dropTarget && styles.dropTarget].filter(Boolean).join(' ');
  const content = hidden ? <><span className={styles.backMark}>i.</span><span className={styles.backName}>IROHA</span></> : <><span className={styles.corner}>{symbol}</span><span className={styles.orbit}/><span className={styles.symbol}>{symbol}</span>{!small && <span className={styles.cardName}>{card?.kind === 'number' ? 'IROHA' : card?.kind === 'skip' ? 'SKIP' : card?.kind === 'reverse' ? 'REVERSE' : card?.kind === 'wild' ? 'WILD' : 'DRAW'}</span>}<span className={styles.cornerBottom}>{symbol}</span></>;
  const visibleId = !hidden ? card?.id : undefined;
  return onClick ? <button type="button" className={className} data-card-id={visibleId} onClick={onClick} disabled={!playable && !reorderable} aria-pressed={reorderable ? !!selected : undefined} aria-label={card ? `${cardLabel(card)}${reorderable ? 'を選んで並べ替える' : 'を出す'}` : 'カード'}>{content}</button> : <div className={className} data-card-id={visibleId} aria-hidden={decorative || hidden || undefined} aria-label={card && !hidden ? cardLabel(card) : undefined}>{content}</div>;
}
