import type { CSSProperties } from 'react';
import { COLOR_NAMES } from '../../types/card';
import type { ColorAnnouncement } from './colorTransition';
import styles from './ColorNotice.module.css';

export function ColorNotice({ announcement, reducedMotion }: { announcement: ColorAnnouncement; reducedMotion: boolean }) {
  return <div key={announcement.id} className={`${styles.notice} ${reducedMotion ? styles.still : ''}`} style={{ '--chosen-color': `var(--${announcement.color})` } as CSSProperties} role="status" aria-live="polite" aria-atomic="true" data-color-announcement={announcement.color}>
    <span className={styles.swatch} aria-hidden="true"/>
    <div><strong>{COLOR_NAMES[announcement.color]}{announcement.color === announcement.previousColor ? 'を継続' : 'に変更'}</strong><span>{announcement.playerName}が色を指定しました</span></div>
  </div>;
}
