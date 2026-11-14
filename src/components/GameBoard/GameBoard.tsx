import { useCallback, useEffect, useLayoutEffect, useState, type CSSProperties } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { chooseCpuAction } from '../../cpu/cpuEngine';
import { canDraw, playableCards } from '../../engine/cardValidator';
import { COLOR_NAMES } from '../../types/card';
import { Card } from '../Card/Card';
import { PlayerArea } from '../PlayerArea/PlayerArea';
import { PlayerHand } from '../PlayerHand/PlayerHand';
import { useHandOrder } from '../PlayerHand/useHandOrder';
import { ColorPicker } from '../ColorPicker/ColorPicker';
import { useColorChoice } from '../ColorPicker/useColorChoice';
import { ResultScreen } from '../ResultScreen/ResultScreen';
import { Modal } from '../GameSettings/GameSettings';
import { CardMotion } from '../CardMotion/CardMotion';
import { useCardMotion } from '../CardMotion/useCardMotion';
import { DiscardPile } from '../DiscardPile/DiscardPile';
import { getSeatLayout } from './seatLayout';
import { TurnIndicator } from '../TurnIndicator/TurnIndicator';
import { ActionEffectOverlay } from '../ActionEffect/ActionEffectOverlay';
import { ColorNotice } from '../ColorFeedback/ColorNotice';
import type { GameEvent } from '../../types/game';
import styles from './GameBoard.module.css';
export function GameBoard({ onHelp, paused = false }: { onHelp: () => void; paused?: boolean }) {
  const { game: state, dispatch: engineDispatch, startGame, leaveGame } = useGameStore();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [handOpen, setHandOpen] = useState(false);
  const [playersOpen, setPlayersOpen] = useState(false);
  const [handEditing, setHandEditing] = useState(false);
  const handOrder = useHandOrder(state?.players.find(player => player.id === state.viewerId), state?.eventSequence === 1);
  const closeHand = useCallback(() => setHandOpen(false), []);
  const [uno, setUno] = useState<GameEvent | null>(null);
  const { boardRef, flights, hiddenDrawIds, actionEffect, colorAnnouncement, presentedColor, busy, prepareHandReorder, refreshHandLayout, dispatchWithMotion: dispatch, finishFlight } = useCardMotion(state, engineDispatch);
  const prepareOrder = useCallback(() => prepareHandReorder(state?.viewerId ?? undefined), [prepareHandReorder, state?.viewerId]);
  useLayoutEffect(() => { refreshHandLayout(); }, [handOrder.cards, handOpen, handEditing, refreshHandLayout]);
  const { pendingPlay, requestAction, cancelChoice, selectColor } = useColorChoice(state, dispatch);
  const latestUno = state ? [...state.events].reverse().find(e => e.type === 'uno') : undefined;
  useEffect(() => {
    if (!latestUno) { setUno(null); return; }
    setUno(latestUno);
    const timer = window.setTimeout(() => setUno(null), 1500);
    return () => window.clearTimeout(timer);
  }, [latestUno?.id]);
  useEffect(() => {
    if (!state || busy || confirmLeave || rulesOpen || historyOpen || playersOpen || paused) return;
    const action = chooseCpuAction(state, Math.random());
    if (!action) return;
    const timer = window.setTimeout(() => dispatch(action), state.settings.cpuDelay);
    return () => window.clearTimeout(timer);
  }, [state, dispatch, busy, confirmLeave, rulesOpen, historyOpen, playersOpen, paused]);
  if (!state) return null;
  const current = state.players.find(p => p.id === state.turnPlayerId)!;
  const seats = getSeatLayout(state.players, state.viewerId);
  const attack = state.pendingAttack;
  const colorPending = state.phase === 'selectingColor' && !flights.some(flight => flight.kind === 'play');
  const deferredColor = attack?.lastWild4PlayerId && state.settings.wild4ColorTiming === 'afterAttack';
  const humanTurn = current.type === 'human' && (state.phase === 'normalTurn' || state.phase === 'attackResponse');
  const isPaused = paused || confirmLeave || rulesOpen || historyOpen || playersOpen;
  const drawAllowed = !busy && humanTurn && (attack !== null || canDraw(state, current.id));
  const draw = () => dispatch({ type: attack ? 'ACCEPT_DRAW_ATTACK' : state.drawPile.length === 0 && state.discardPile.length <= 1 ? 'PASS_TURN' : 'DRAW_CARD', playerId: current.id });
  return <div ref={boardRef} className={styles.gameLayout} data-defense-impact={actionEffect?.stage === 'impact' ? 'true' : undefined} data-color-reveal={colorAnnouncement?.id} style={{ '--active-color': `var(--${presentedColor})` } as CSSProperties}>
    <div className={styles.mainColumn}><div className={styles.matchHeading}><h1>{state.settings.gameMode === 'ranking' ? '順位戦' : '通常対戦'}<small>{state.players.length}人のテーブル</small></h1><div className={styles.matchActions}><button className="smallButton" onClick={() => setPlayersOpen(true)}>参加者</button><button className="smallButton" onClick={() => setRulesOpen(true)}>ルール</button><button className="smallButton" onClick={() => setHistoryOpen(true)}>記録</button><button className="smallButton" onClick={() => setConfirmLeave(true)}>終了</button></div></div>
      <div className={styles.gameFrame}><section className={styles.table} aria-label="対戦テーブル"><div className={styles.tableMeta}><span><i/> {state.settings.gameMode === 'ranking' ? '順位戦' : '通常対戦'} · {state.players.length} PLAYERS</span><span>{state.direction === 1 ? '↻ 時計回り' : '↺ 反時計回り'}</span></div>
        <div className={styles.topPlayers}>{seats.top.map(p => <PlayerArea key={p.id} state={state} player={p} index={state.players.indexOf(p)} uno={uno?.playerId === p.id} hiddenCardIds={hiddenDrawIds}/>)}</div>
        <div className={styles.tableCenter}><div className={styles.sidePlayers}>{seats.left.map(p => <PlayerArea key={p.id} state={state} player={p} index={state.players.indexOf(p)} uno={uno?.playerId === p.id} hiddenCardIds={hiddenDrawIds}/>)}</div>
          <div className={styles.playZone}><div className={styles.turnStatusSlot} data-turn-status>{colorAnnouncement ? <ColorNotice announcement={colorAnnouncement} reducedMotion={state.settings.reducedMotion}/> : <TurnIndicator state={state} paused={isPaused} choosingColor={pendingPlay !== null}/>}</div><div className={styles.piles} data-effect-piles><div className={styles.pile}><button className={styles.deckButton} data-draw-source onClick={draw} disabled={!drawAllowed} aria-label={attack ? `${attack.amount}枚の攻撃を受ける` : '山札から引く'}><Card hidden decorative/><span className={styles.deckPlus}>+</span></button><span>山札 <b>{state.drawPile.length}</b></span></div><div className={styles.discard}><DiscardPile cards={state.discardPile} flyingIds={flights.filter(flight => flight.kind === 'play').map(flight => flight.cardId)} hasPlayed={state.events.some(event => event.type === 'play')} activeColor={colorPending ? undefined : presentedColor}/><span>場のカード</span></div></div><div className={`${styles.activeColor} ${colorPending ? styles.colorPending : ''}`} data-active-color={colorPending ? 'pending' : presentedColor}><i/><span>{colorPending ? '次の色を選択中' : deferredColor ? `攻撃色 · ${COLOR_NAMES[presentedColor]}（色指定は攻撃後）` : <>いまの色 · <strong>{COLOR_NAMES[presentedColor]}</strong></>}</span></div><div className={styles.attackSlot}>{attack && <div className={styles.attackBanner}><strong>+{attack.amount}</strong><span>{colorPending ? '色の指定を待っています' : `ドロー攻撃中 · ${COLOR_NAMES[presentedColor]}で反撃`}</span></div>}</div></div>
          <div className={styles.sidePlayers}>{seats.right.map(p => <PlayerArea key={p.id} state={state} player={p} index={state.players.indexOf(p)} uno={uno?.playerId === p.id} hiddenCardIds={hiddenDrawIds}/>)}</div>
        </div>
      </section><PlayerHand state={state} dispatch={requestAction} onExpand={() => { prepareOrder(); setHandOpen(true); }} uno={uno?.playerId === state.viewerId} hiddenCardIds={hiddenDrawIds} disabled={busy} order={handOrder} onEditingChange={setHandEditing} onPrepareReorder={prepareOrder}/><div className={styles.controls}><div><span className={styles.statusDot}/>{handEditing ? '手札を並べ替え中です' : busy ? actionEffect?.title ?? (colorAnnouncement ? `${COLOR_NAMES[colorAnnouncement.color]}が指定されました` : 'カードを移動しています') : humanTurn ? attack ? '反撃するか、攻撃を受けましょう' : playableCards(state).length ? '出せるカードがあります' : '山札からカードを引きましょう' : `${current.name} のターン`}</div><span className={styles.controlTurnCount}>TURN {String(state.turnCount).padStart(2, '0')}</span><button className="button primary" onClick={draw} disabled={!drawAllowed}>{attack ? `${attack.amount}枚引いて攻撃を受ける` : state.drawPile.length === 0 && state.discardPile.length <= 1 ? 'パスする' : '山札から引く'} <span>＋</span></button></div></div>
    </div>
    <CardMotion flights={flights} onFinish={finishFlight}/><ActionEffectOverlay effect={actionEffect}/>
    {pendingPlay && <ColorPicker playerName={pendingPlay.playerName} card={pendingPlay.card} onSelect={selectColor} onCancel={cancelChoice}/>}
    {state.phase === 'selectingColor' && current.type === 'human' && !busy && <ColorPicker playerName={current.name} onSelect={color => dispatch({ type: 'SELECT_COLOR', playerId: current.id, color })}/>}
    {state.phase === 'playerHandoff' && !busy && <div className={styles.handoff}><span className="eyebrow">PASS THE TABLE</span><span className={styles.handoffIcon}>↗</span><h2>{current.name} の番です</h2><p>端末を渡したら、準備ができてから手札を開いてください。</p><button autoFocus className="button primary" onClick={() => dispatch({ type: 'CONFIRM_HANDOFF', playerId: current.id })}>準備できました · 手札を開く <span>↗</span></button></div>}
    {state.phase === 'gameOver' && !busy && <ResultScreen state={state} onRestart={startGame} onHome={leaveGame}/>}
    {handOpen && <Modal title="手札一覧" onClose={closeHand} wide><span className="eyebrow">YOUR HAND</span><h2>手札を広げる</h2><PlayerHand state={state} expanded dispatch={action => { closeHand(); requestAction(action); }} order={handOrder} hiddenCardIds={hiddenDrawIds} disabled={busy} onEditingChange={setHandEditing} onPrepareReorder={prepareOrder}/></Modal>}
    {playersOpen && <Modal title="参加者の手札と順位" onClose={() => setPlayersOpen(false)} wide><span className="eyebrow">PLAYERS</span><h2>参加者の手札と順位</h2><div className={styles.playerDetails}>{state.players.map((player, index) => <PlayerArea key={player.id} state={state} player={player} index={index}/>)}</div></Modal>}
    {historyOpen && <Modal title="テーブルの記録" onClose={() => setHistoryOpen(false)}><span className="eyebrow">TABLE TALK</span><h2>テーブルの記録</h2><div className={styles.eventList}>{state.events.filter(event => event.type !== 'uno').slice(-20).reverse().map(event => <div key={event.id}><i>{event.type === 'attack' ? '↗' : event.type === 'draw' ? '+' : event.type === 'rank' ? '✦' : '·'}</i><span>{event.text}</span></div>)}</div></Modal>}
    {confirmLeave && <Modal title="対戦を終了" onClose={() => setConfirmLeave(false)}><span className="eyebrow">LEAVE THE TABLE</span><h2>対戦を終了しますか？</h2><p>現在の対戦は保存されません。ルールと対戦設定はそのまま残ります。</p><div className={styles.leaveButtons}><button className="button secondary" onClick={() => setConfirmLeave(false)}>対戦を続ける</button><button className="button primary" onClick={leaveGame}>ホームへ戻る ↗</button></div></Modal>}
    {rulesOpen && <Modal title="この対戦のルール" onClose={() => setRulesOpen(false)}><span className="eyebrow">TABLE RULES</span><h2>このテーブルの約束。</h2><RuleSummary detailed/><p>最後のカードがドロー攻撃なら、攻撃がすべて終わってから上がりを判定します。</p><button className="textButton" onClick={() => { setRulesOpen(false); onHelp(); }}>あそびかたを見る ↗</button></Modal>}
  </div>;
}
function RuleSummary({ detailed = false }: { detailed?: boolean }) {
  const state = useGameStore(s => s.game)!; const s = state.settings; const r = s.drawRules;
  const items = [
    ['ドロー攻撃', { stack: '重ねがけ', cancel: '同種カードで無効化', forced: 'ドローでの回避なし' }[r.mode]],
    ['リバース反射', r.allowReverseReflect ? 'あり' : 'なし'], ['スキップ転送', r.allowSkipTransfer ? 'あり' : 'なし'],
    ['通常ドロー', s.drawBehavior === 'drawOnceAndPass' ? '1枚引いてパス' : '出せるまで引く'], ['攻撃を引いた後', r.continueAfterDraw ? '自分の番を続行' : 'ターン終了'],
    ...(detailed ? [['+2と+4の混合', r.mode === 'stack' && r.allowMixedStacking ? 'あり' : 'なし'], ['連続反射', r.allowReverseReflect && r.allowChainReflect ? 'あり' : 'なし'], ['連続転送', r.allowSkipTransfer && r.allowChainTransfer ? 'あり' : 'なし'], ['+4の色指定', s.wild4ColorTiming === 'immediate' ? '即時' : '攻撃の解決後'], ['任意ドロー', s.allowVoluntaryDraw ? 'あり' : 'なし'], ['UNO演出', s.showUnoEffect ? 'あり' : 'なし'], ['手札公開', { hidden: '自分だけ', all: '全員', cpu: '自分とCPU' }[s.handVisibility]], ['CPUの強さ', s.cpuDifficulty]] : []),
  ];
  return <dl className={styles.ruleList}>{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}
