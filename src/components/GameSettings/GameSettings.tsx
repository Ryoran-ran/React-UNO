import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { GameSettings as Settings } from '../../types/rules';
import styles from './GameSettings.module.css';
export function Modal({ children, title, onClose, wide = false, className = '' }: { children: ReactNode; title: string; onClose: () => void; wide?: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled),input:not(:disabled),[tabindex="0"]') ?? []);
    focusable()[0]?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const items = focusable(); const first = items[0]; const last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); previous?.focus(); };
  }, [onClose]);
  return <div className={styles.backdrop} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div ref={ref} className={`${styles.modal} ${wide ? styles.wide : ''} ${className}`} role="dialog" aria-modal="true" aria-label={title}><button className={styles.close} onClick={onClose} aria-label="閉じる">×</button>{children}</div></div>;
}
export function Toggle({ label, description, value, onChange, disabled }: { label: string; description?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return <label className={`${styles.toggleRow} ${disabled ? styles.disabled : ''}`}><span><strong>{label}</strong>{description && <small>{description}</small>}</span><input type="checkbox" role="switch" checked={value} onChange={e => onChange(e.target.checked)} disabled={disabled}/><span className={styles.switch} aria-hidden="true"/></label>;
}
export function GameSettings({ settings, onSave, onClose, initialTab = 'match' }: { settings: Settings; onSave: (s: Settings) => void; onClose: () => void; initialTab?: 'match' | 'rules' }) {
  const [draft, setDraft] = useState(() => structuredClone(settings));
  const [tab, setTab] = useState<'players' | 'match' | 'draw' | 'defense'>(initialTab === 'rules' ? 'draw' : 'players');
  const [namePage, setNamePage] = useState(0);
  function update<K extends keyof Settings>(key: K, value: Settings[K]) { setDraft(s => ({ ...s, [key]: value })); }
  function rule<K extends keyof Settings['drawRules']>(key: K, value: Settings['drawRules'][K]) { setDraft(s => ({ ...s, drawRules: { ...s.drawRules, [key]: value } })); }
  const modeLabels = { stack: '重ねがけ', cancel: '同種カードで無効化', forced: 'ドローカードでの回避なし' };
  const pages = Math.ceil(draft.playerCount / 4);
  const page = Math.min(namePage, pages - 1);
  const tabs = [['players', '参加者'], ['match', '対戦・表示'], ['draw', 'ドロー'], ['defense', '反射・転送']] as const;
  return <Modal title="対戦とルールの設定" onClose={onClose} wide className={styles.settingsModal}>
    <div className={styles.settingsTitle}><span className={styles.eyebrow}>MAKE IT YOUR GAME</span><h2>遊び方を、あなたらしく。</h2><p>項目を切り替えて、次の対戦を設定します。</p></div>
    <div className={styles.tabs} aria-label="設定カテゴリ">{tabs.map(([key, label]) => <button key={key} className={tab === key ? styles.selected : ''} aria-pressed={tab === key} onClick={() => setTab(key)}>{label}</button>)}</div>
    <div className={styles.body}>
      {tab === 'players' && <>
        <div className={styles.fieldGrid}><label>参加人数<select value={draft.playerCount} onChange={e => { const count = +e.target.value; setNamePage(0); setDraft(s => ({ ...s, playerCount: count, humanPlayerCount: Math.min(s.humanPlayerCount, count) })); }}>{Array.from({ length: 7 }, (_, i) => <option key={i} value={i + 2}>{i + 2}人</option>)}</select></label><label>人間の人数<select value={draft.humanPlayerCount} onChange={e => update('humanPlayerCount', +e.target.value)}>{Array.from({ length: draft.playerCount }, (_, i) => <option key={i} value={i + 1}>{i + 1}人（CPU {draft.playerCount - i - 1}人）</option>)}</select></label></div>
        <div className={styles.namesHeading}><h3>プレイヤー名</h3>{pages > 1 && <div className={styles.pageControls}><button disabled={page === 0} onClick={() => setNamePage(page - 1)} aria-label="前のプレイヤー">←</button><span>{page * 4 + 1}–{Math.min(page * 4 + 4, draft.playerCount)} / {draft.playerCount}人</span><button disabled={page === pages - 1} onClick={() => setNamePage(page + 1)} aria-label="次のプレイヤー">→</button></div>}</div>
        <div className={styles.names}>{draft.playerNames.slice(page * 4, Math.min(page * 4 + 4, draft.playerCount)).map((name, offset) => { const i = page * 4 + offset; return <label key={i}><span>{String(i + 1).padStart(2, '0')} · {i < draft.humanPlayerCount ? 'PLAYER' : 'CPU'}</span><input aria-label={`プレイヤー${i + 1}の名前`} maxLength={16} value={name} onChange={e => update('playerNames', draft.playerNames.map((old, j) => i === j ? e.target.value : old))}/></label>; })}</div>
      </>}
      {tab === 'match' && <>
        <div className={styles.fieldGrid}>
          <label>対戦形式<select value={draft.gameMode} onChange={e => update('gameMode', e.target.value as Settings['gameMode'])}><option value="first">通常対戦 · 最初に上がった人の勝ち</option><option value="ranking">順位戦 · 最後まで順位を決める</option></select></label>
          <label>手札の公開範囲<select value={draft.handVisibility} onChange={e => update('handVisibility', e.target.value as Settings['handVisibility'])}><option value="hidden">自分だけに公開</option><option value="all">すべて公開</option><option value="cpu">CPUの手札も公開</option></select></label>
          <label>CPUの強さ<select value={draft.cpuDifficulty} onChange={e => update('cpuDifficulty', e.target.value as Settings['cpuDifficulty'])}><option value="easy">Easy · 気軽に</option><option value="normal">Normal · ほどよく</option><option value="hard">Hard · じっくり戦略</option></select></label>
          <label>CPUのテンポ<select value={draft.cpuDelay} onChange={e => update('cpuDelay', +e.target.value)}><option value={400}>速い</option><option value={950}>ふつう</option><option value={1800}>ゆっくり</option></select></label>
        </div>
        <div className={styles.pairToggles}><Toggle label="UNO! の自動演出" value={draft.showUnoEffect} onChange={v => update('showUnoEffect', v)}/><Toggle label="動きを少なくする" value={draft.reducedMotion} onChange={v => update('reducedMotion', v)}/></div>
      </>}
      {tab === 'draw' && <>
        <div className={styles.fieldGrid}>
          <label>ドロー攻撃のモード<select value={draft.drawRules.mode} onChange={e => rule('mode', e.target.value as Settings['drawRules']['mode'])}>{Object.entries(modeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label>+4の色指定<select value={draft.wild4ColorTiming} onChange={e => update('wild4ColorTiming', e.target.value as Settings['wild4ColorTiming'])}><option value="immediate">出す前に選ぶ</option><option value="afterAttack">攻撃が終わってから選ぶ</option></select></label>
          <label>通常ターンのドロー<select value={draft.drawBehavior} onChange={e => update('drawBehavior', e.target.value as Settings['drawBehavior'])}><option value="drawOnceAndPass">1枚引いてパス</option><option value="drawUntilPlayable">出せるまで引いて自動で出す</option></select></label>
        </div>
        <p className={styles.hint}>{draft.drawRules.mode === 'stack' ? '同種カードを重ねて攻撃を次の人へ。' : draft.drawRules.mode === 'cancel' ? '同じ種類のドローで攻撃を無効化します。' : '反射・転送は個別に設定できます。'}</p>
        <Toggle label="+2と+4を混ぜて重ねる" value={draft.drawRules.allowMixedStacking} onChange={v => rule('allowMixedStacking', v)} disabled={draft.drawRules.mode !== 'stack'}/>
        <Toggle label="出せるカードがあってもドローできる" value={draft.allowVoluntaryDraw} onChange={v => update('allowVoluntaryDraw', v)}/>
        <Toggle label="攻撃で引いた後も自分の番を続ける" description="ドロー2・4を受けた後、通常どおりプレイできます" value={draft.drawRules.continueAfterDraw} onChange={v => rule('continueAfterDraw', v)}/>
      </>}
      {tab === 'defense' && <>
        <Toggle label="リバースで反射" description="攻撃色と同じ色で、攻撃を逆方向へ" value={draft.drawRules.allowReverseReflect} onChange={v => rule('allowReverseReflect', v)}/>
        <Toggle label="連続して反射できる" value={draft.drawRules.allowChainReflect} onChange={v => rule('allowChainReflect', v)} disabled={!draft.drawRules.allowReverseReflect}/>
        <Toggle label="スキップで転送" description="攻撃色と同じ色で、次の人へ" value={draft.drawRules.allowSkipTransfer} onChange={v => rule('allowSkipTransfer', v)}/>
        <Toggle label="連続して転送できる" value={draft.drawRules.allowChainTransfer} onChange={v => rule('allowChainTransfer', v)} disabled={!draft.drawRules.allowSkipTransfer}/>
      </>}
    </div>
    <div className={styles.footer}><button className="button secondary" onClick={onClose}>キャンセル</button><button className="button primary" onClick={() => { onSave(draft); onClose(); }}>設定を保存 <span>↗</span></button></div>
  </Modal>;
}
