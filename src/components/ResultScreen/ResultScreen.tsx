import type { GameState } from '../../types/game';
import styles from '../GameSettings/GameSettings.module.css';
export function ResultScreen({ state, onRestart, onHome }: { state: GameState; onRestart: () => void; onHome: () => void }) {
  const winner = state.players.find(p => p.rank === 1);
  const ordered = [...state.players].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99) || a.hand.length - b.hand.length);
  return <div className={styles.backdrop}><section className={`${styles.modal} ${styles.compact}`} role="dialog" aria-modal="true" aria-labelledby="result-title"><span className={styles.eyebrow}>{state.stalemate ? 'DRAW GAME' : 'WELL PLAYED'}</span><div className="resultSymbol">✦</div><h2 id="result-title">{state.stalemate ? '今回は、引き分け。' : `${winner?.name} の勝利！`}</h2><p>{state.stalemate ? '引けるカードがなくなりました。' : 'ひとつの色から、いい勝負が生まれました。'}</p><div className="resultList">{ordered.map(p => <div key={p.id}><span className="rank">{p.rank ? String(p.rank).padStart(2, '0') : '—'}</span><strong>{p.name}</strong><small>{p.rank === 1 ? 'WINNER' : `残り ${p.hand.length}枚`}</small></div>)}</div><button autoFocus className="button primary full" onClick={onRestart}>もう一度遊ぶ <span>↗</span></button><button className="textButton" onClick={onHome}>ホームに戻る</button></section></div>;
}
