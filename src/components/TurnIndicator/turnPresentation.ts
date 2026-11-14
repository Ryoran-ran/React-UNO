import type { GameState } from '../../types/game';

export function turnBadgeLabel(state: GameState): string {
  return state.phase === 'attackResponse' ? '反撃中' : state.phase === 'selectingColor' ? '色選択' : '手番';
}

export function getTurnPresentation(state: GameState, paused = false, choosingColor = false) {
  const player = state.players.find(candidate => candidate.id === state.turnPlayerId)!;
  const self = player.type === 'human' && player.id === state.viewerId;
  const name = self ? 'あなた' : player.name;
  const title = state.phase === 'gameOver' ? '対戦終了' : `${name}の番`;
  let detail: string;
  if (state.phase === 'gameOver') detail = state.stalemate ? '今回は引き分けです' : '結果を確認しましょう';
  else if (state.phase === 'playerHandoff') detail = '端末を渡してください';
  else if (paused) detail = '確認中 · 対戦を一時停止';
  else if (state.phase === 'selectingColor' || choosingColor) detail = self ? '次の色を選んでください' : '色を選んでいます';
  else if (state.pendingAttack) detail = `+${state.pendingAttack.amount}の攻撃 · ${self ? '反撃かドローを選ぶ' : player.type === 'cpu' ? 'CPUが反撃を考えています' : '反撃を選んでいます'}`;
  else if (player.type === 'cpu') detail = 'CPUが考えています…';
  else detail = self ? 'カードを出すか、山札を引く' : 'カードを選んでいます';
  return { playerId: player.id, name, self, title, detail, finished: state.phase === 'gameOver' };
}
