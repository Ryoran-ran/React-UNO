import type { GameState } from '../../types/game';
import type { Player } from '../../types/player';
import { isHandVisible } from '../../engine/visibility';
import { Card } from '../Card/Card';
import { turnBadgeLabel } from '../TurnIndicator/turnPresentation';
import { UnoBadge } from '../UnoBadge/UnoBadge';
import styles from './PlayerArea.module.css';
export function PlayerArea({ state, player, index, uno = false, hiddenCardIds = [] }: { state: GameState; player: Player; index: number; uno?: boolean; hiddenCardIds?: string[] }) {
  const current = state.turnPlayerId === player.id && state.phase !== 'gameOver';
  const visible = isHandVisible(state, player);
  return <section data-player-id={player.id} className={`${styles.area} ${current ? styles.current : ''} ${player.rank ? styles.finished : ''}`} aria-current={current ? 'step' : undefined} aria-label={`${player.name}、手札${player.hand.length}枚${player.rank ? `、${player.rank}位` : ''}${current ? '、現在の手番' : ''}`}>
    {uno && <UnoBadge playerName={player.name} compact/>}
    <div className={styles.info}><span className={`${styles.avatar} ${styles['avatar' + index % 4]}`}>{player.name.slice(0, 1)}</span><div><strong>{player.name}</strong><span>{player.rank ? `${player.rank}位 FINISH` : <><small className={styles.playerType}>{player.type === 'cpu' ? 'CPU' : 'PLAYER'} · </small>{player.hand.length}枚</>}</span></div>{current && <b className={styles.turnBadge}>{turnBadgeLabel(state)}</b>}</div>
    <div className={styles.cards} data-card-source>{(visible ? player.hand : player.hand.slice(0, 7)).map(c => <Card key={c.id} card={visible ? c : undefined} inFlight={hiddenCardIds.includes(c.id)} hidden={!visible} small/>)}{!visible && player.hand.length > 7 && <span className={styles.more}>+{player.hand.length - 7}</span>}</div>
  </section>;
}
