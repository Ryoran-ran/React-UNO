import type { GameState } from '../../types/game';
import { getTurnPresentation } from './turnPresentation';
import styles from './TurnIndicator.module.css';

export function TurnIndicator({ state, paused, choosingColor }: { state: GameState; paused: boolean; choosingColor: boolean }) {
  const turn = getTurnPresentation(state, paused, choosingColor);
  return <div className={`${styles.indicator} ${turn.self && !turn.finished ? styles.yours : ''}`} role="status" aria-live="polite" aria-atomic="true">
    <div key={`${turn.playerId}-${state.phase}`} className={styles.content}>
      <div className={styles.headline}>{turn.finished ? <strong>{turn.title}</strong> : <><span className={styles.marker} aria-hidden="true">▶</span><strong title={turn.name}>{turn.name}</strong><span>の番</span></>}</div>
      <span className={styles.detail}>{turn.detail}</span>
    </div>
  </div>;
}
