import type { CSSProperties } from 'react';
import { cardLabel, type Card as CardType, type NormalColor } from '../../types/card';
import { Card } from '../Card/Card';
import { cardTilt } from '../CardMotion/placement';
import styles from './DiscardPile.module.css';

export function DiscardPile({ cards, flyingIds, hasPlayed, activeColor }: { cards: CardType[]; flyingIds: string[]; hasPlayed: boolean; activeColor?: NormalColor }) {
  const top = cards.at(-1)!;
  const layers = cards.slice(-4);
  const topInFlight = flyingIds.includes(top.id);
  const wildColor = !topInFlight && (top.kind === 'wild' || top.kind === 'wild4') ? activeColor : undefined;
  return <div className={styles.slot} data-discard-target data-wild-color={wildColor} style={wildColor ? { '--wild-color': `var(--${wildColor})` } as CSSProperties : undefined} role="img" aria-label={`場のカード：${cardLabel(top)}`}>
    <div key={`landing-${top.id}`} className={`${styles.contact} ${hasPlayed && !topInFlight ? styles.landed : ''}`}/>
    {layers.map((card, index) => {
      const depth = layers.length - index - 1;
      const style = { '--angle': `${cardTilt(card.id)}deg`, '--offset-x': `${-depth * 2}px`, '--offset-y': `${depth}px`, zIndex: index + 1 } as CSSProperties;
      return <div key={card.id} className={`${styles.stackedCard} ${flyingIds.includes(card.id) ? styles.inFlight : ''}`} style={style}><Card card={card} decorative/></div>;
    })}
  </div>;
}
