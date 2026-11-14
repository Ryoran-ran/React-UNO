import type { Card, NormalColor } from './card';
import type { GameSettings } from './rules';
import type { Player } from './player';
export type Phase = 'setup' | 'normalTurn' | 'selectingColor' | 'attackResponse' | 'resolvingAttack' | 'playerHandoff' | 'gameOver';
export interface PendingAttack {
  amount: number; attackColor: NormalColor; lastDrawType: 'draw2' | 'wild4'; targetPlayerId: string;
  reflectCount: number; transferCount: number; lastWild4PlayerId: string | null;
}
export interface ColorSelection { playerId: string; continuation: 'attack' | 'settle'; nextPlayerId: string }
export interface GameEvent { id: number; type: 'play' | 'draw' | 'attack' | 'uno' | 'rank' | 'system'; text: string; playerId?: string }
export interface GameState {
  settings: GameSettings; players: Player[]; drawPile: Card[]; discardPile: Card[];
  activeColor: NormalColor; direction: 1 | -1; turnPlayerId: string; phase: Phase;
  pendingAttack: PendingAttack | null; colorSelection: ColorSelection | null;
  handoffPhase: Phase | null; viewerId: string | null;
  finishQueue: string[]; rankings: string[]; events: GameEvent[]; eventSequence: number;
  rngState: number; turnCount: number; consecutivePasses: number; stalemate: boolean;
}
export type GameAction =
  | { type: 'START_GAME' | 'RESTART_GAME'; settings?: GameSettings; seed?: number }
  | { type: 'PLAY_CARD'; playerId: string; cardId: string; color?: NormalColor }
  | { type: 'DRAW_CARD' | 'PASS_TURN' | 'ACCEPT_DRAW_ATTACK' | 'CONFIRM_HANDOFF'; playerId: string }
  | { type: 'SELECT_COLOR'; playerId: string; color: NormalColor };
