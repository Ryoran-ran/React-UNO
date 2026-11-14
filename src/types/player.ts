import type { Card } from './card';
export interface Player { id: string; name: string; type: 'human' | 'cpu'; hand: Card[]; rank: number | null }
