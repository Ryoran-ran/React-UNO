import styles from './UnoBadge.module.css';

export function UnoBadge({ playerName, compact = false }: { playerName: string; compact?: boolean }) {
  return <div className={`${styles.badge} ${compact ? styles.compact : ''}`} role="status" aria-label={`${playerName}、UNO！ 残り1枚`}><strong>UNO!</strong>{!compact && <span>残り1枚</span>}</div>;
}
