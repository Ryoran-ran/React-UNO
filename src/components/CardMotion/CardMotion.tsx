import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Card } from '../Card/Card';
import { cardTilt } from './placement';
import type { CardFlight } from './useCardMotion';
import styles from './CardMotion.module.css';

export function CardMotion({ flights, onFinish }: { flights: CardFlight[]; onFinish: (id: string) => void }) {
  if (!flights.length) return null;
  const drawGroups = [...new Map(flights.filter(flight => flight.kind === 'draw').map(flight => [flight.groupId, flight])).values()];
  return createPortal(<div className={styles.layer} aria-hidden="true">{flights.map(flight => {
    const { source, destination } = flight;
    const x = source.left + source.width / 2 - destination.left - destination.width / 2;
    const y = source.top + source.height / 2 - destination.top - destination.height / 2;
    const style = {
      left: destination.left, top: destination.top, width: destination.width, height: destination.height,
      '--from-x': `${x}px`, '--from-y': `${y}px`, '--from-scale': Math.max(.2, Math.min(1.2, source.width / destination.width)),
      '--from-angle': `${flight.kind === 'draw' ? -8 : x < -20 ? -18 : x > 20 ? 18 : -5}deg`, '--to-angle': `${flight.kind === 'play' ? cardTilt(flight.cardId) : 0}deg`,
      '--duration': `${flight.duration}ms`, '--delay': `${flight.delay}ms`,
      '--card-symbol-size': `${Math.round(destination.height * .34)}px`,
      '--card-height': `${destination.height}px`, '--card-width': `${destination.width}px`,
      '--card-corner-size': `${Math.max(9, Math.round(destination.height * .12))}px`,
    } as CSSProperties;
    return <div key={flight.id} className={`${styles.flight} ${flight.kind === 'draw' ? styles.dealing : ''}`} style={style} onAnimationEnd={event => { if (event.target === event.currentTarget) onFinish(flight.id); }}>
      <div className={`${styles.flip} ${flight.flip ? styles.reveal : ''}`}><div className={styles.front}><Card card={flight.card ?? undefined} hidden={flight.hidden} decorative/></div>{flight.flip && <div className={styles.back}><Card hidden decorative/></div>}</div>
    </div>;
  })}{drawGroups.filter(group => (group.drawCount ?? 0) > 1 && group.handRect).map(group => <div key={`count-${group.groupId}`} className={styles.drawCount} style={{ left: group.handRect!.left + group.handRect!.width / 2, top: Math.max(8, group.handRect!.top - 21) }}>{group.playerName} +{group.drawCount}枚</div>)}</div>, document.body);
}
