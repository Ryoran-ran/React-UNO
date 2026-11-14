import { useId, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { ActionEffectVisual } from './effectDescription';
import { Card } from '../Card/Card';
import { cardTilt } from '../CardMotion/placement';
import styles from './ActionEffect.module.css';

export function ActionEffectOverlay({ effect }: { effect: ActionEffectVisual | null }) {
  const markerId = `effect-arrow-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  if (!effect) return null;
  const { anchor, pile, landing, target, actor, kind, defense, stage } = effect;
  const holding = stage === 'impact';
  const reverse = kind === 'reverse' || kind === 'reflect';
  const point = (rect: DOMRect) => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  const center = point(pile);
  const start = defense ? point(actor ?? pile) : center;
  const end = target ? point(target) : null;
  const width = Math.min(300, window.innerWidth - 24);
  const noticeStyle = { left: Math.max(12, Math.min(anchor.left + anchor.width / 2 - width / 2, window.innerWidth - width - 12)), top: anchor.top + anchor.height / 2, width } as CSSProperties;
  const ringSize = Math.min(230, Math.max(110, pile.height + 48), window.innerHeight * .34);
  const landingPoint = point(landing);
  const focusStyle = { left: landingPoint.x, top: landingPoint.y, width: landing.width, height: landing.height, '--impact-angle': `${cardTilt(effect.card.id)}deg`, '--card-height': `${landing.height}px`, '--card-symbol-size': `${Math.round(landing.height * .34)}px`, '--card-corner-size': `${Math.max(9, Math.round(landing.height * .12))}px` } as CSSProperties;
  return createPortal(<div key={effect.id} data-action-effect={kind} data-effect-stage={stage} className={`${styles.layer} ${styles[kind]} ${defense ? styles.defense : ''} ${holding ? styles.holding : styles.resolving}`} style={{ '--spin': effect.direction, '--impact-x': `${landingPoint.x}px`, '--impact-y': `${landingPoint.y}px` } as CSSProperties}>
    {defense && <><div className={styles.focusShade} aria-hidden="true"/><div className={styles.impactRing} aria-hidden="true" style={{ left: landingPoint.x, top: landingPoint.y, width: landing.width + 42, height: landing.height + 42 }}/><div className={styles.impactCard} style={focusStyle} aria-hidden="true"><Card card={effect.card} decorative/></div></>}
    {!holding && end && Math.hypot(end.x - start.x, end.y - start.y) > 10 && <svg className={styles.connector} width="100%" height="100%" aria-hidden="true"><defs><marker id={markerId} markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 Z" fill="currentColor"/></marker></defs><path className={styles.trail} d={`M ${start.x} ${start.y} Q ${center.x} ${Math.min(center.y, end.y) - 48} ${end.x} ${end.y}`} pathLength="1" markerEnd={`url(#${markerId})`}/></svg>}
    {!holding && reverse && <div className={styles.ring} aria-hidden="true" style={{ left: center.x, top: center.y, width: ringSize, height: ringSize }}><span>{effect.direction === 1 ? '↻' : '↺'}</span></div>}
    {!holding && target && <div className={styles.target} aria-hidden="true" style={{ left: target.left - 3, top: target.top - 3, width: target.width + 6, height: target.height + 6 }}><span className={styles.targetTag}>{kind === 'skip' ? '⊘ ' : ''}{effect.targetLabel}</span></div>}
    <div className={styles.notice} style={noticeStyle} role="status" aria-live="polite" aria-atomic="true"><span className={`${styles.symbol} ${reverse ? styles.rotating : ''}`} aria-hidden="true">{kind === 'cancel' ? '✓' : kind === 'stack' ? '+' : kind === 'skip' ? '⊘' : kind === 'transfer' ? '↠' : effect.direction === 1 ? '↻' : '↺'}</span><div><strong>{effect.title}</strong><span>{effect.detail}</span></div></div>
  </div>, document.body);
}
