export const COLORS = ['red', 'blue', 'green', 'yellow'] as const;
export type NormalColor = typeof COLORS[number];
export type CardKind = 'number' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4' | (string & {});
export interface Card { id: string; kind: CardKind; color: NormalColor | null; value?: number }
export const COLOR_NAMES: Record<NormalColor, string> = { red: '赤', blue: '青', green: '緑', yellow: '黄' };
export function cardLabel(card: Card): string {
  const labels: Record<string, string> = { skip: 'スキップ', reverse: 'リバース', draw2: '+2', wild: 'ワイルド', wild4: '+4' };
  const label = card.kind === 'number' ? String(card.value) : (labels[card.kind] ?? card.kind);
  return `${card.color ? COLOR_NAMES[card.color] + ' ' : ''}${label}`;
}
