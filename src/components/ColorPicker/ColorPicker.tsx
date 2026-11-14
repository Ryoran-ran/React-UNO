import { useEffect, useRef } from 'react';
import { COLORS, COLOR_NAMES, cardLabel, type Card as CardType, type NormalColor } from '../../types/card';
import { Card } from '../Card/Card';
import styles from '../GameSettings/GameSettings.module.css';
import pickerStyles from './ColorPicker.module.css';

interface Props {
  playerName: string;
  onSelect: (color: NormalColor) => void;
  onCancel?: () => void;
  card?: CardType;
}
export function ColorPicker({ playerName, onSelect, onCancel, card }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onCancel) { event.preventDefault(); onCancel(); }
      if (event.key !== 'Tab') return;
      const buttons = [...(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
      const first = buttons[0]; const last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); if (previous?.isConnected) previous.focus(); };
  }, [onCancel]);
  return <div className={styles.backdrop} onClick={event => { if (event.target === event.currentTarget) onCancel?.(); }}><section ref={dialogRef} className={`${styles.modal} ${styles.compact}`} role="dialog" aria-modal="true" aria-labelledby="color-title" aria-describedby="color-description">
    {onCancel && <button className={styles.close} onClick={onCancel} aria-label="色選択を取り消す">×</button>}
    <span className={styles.eyebrow}>CHOOSE A COLOR</span><h2 id="color-title">次は、どの色に？</h2>
    {card && <div className={pickerStyles.preview}><Card card={card} small decorative/><span>{cardLabel(card)}</span></div>}
    <p id="color-description">{onCancel ? '色を選ぶと、このカードを出します。' : `${playerName} が場の色を選びます`}</p>
    <div className={styles.colors}>{COLORS.map((color, i) => <button ref={i === 0 ? ref : undefined} key={color} style={{ background: `var(--${color})` }} aria-label={onCancel ? `${COLOR_NAMES[color]}にしてカードを出す` : `${COLOR_NAMES[color]}を指定`} onClick={() => onSelect(color)}>{COLOR_NAMES[color]}</button>)}</div>
    {onCancel && <button className={`textButton ${pickerStyles.cancel}`} onClick={onCancel}>↶ キャンセルして手札に戻る</button>}
  </section></div>;
}
