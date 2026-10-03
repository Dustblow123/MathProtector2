import type { Game } from '../Game';
import type { BossKind } from '../types';
import type { BossBase } from './BossBase';
import { Chrono } from './Chrono';
import { Hydra } from './Hydra';
import { Mirror } from './Mirror';
import { Mothership } from './Mothership';
import { Phantom } from './Phantom';
import { Swarm } from './Swarm';
import { Titan } from './Titan';
import { Twins } from './Twins';

export const BOSS_KINDS: BossKind[] = ['titan', 'swarm', 'hydra', 'twins', 'mirror', 'phantom', 'chrono', 'mothership'];

export function createBoss(kind: BossKind, game: Game, table: number): BossBase {
  switch (kind) {
    case 'titan':
      return new Titan(game, table);
    case 'swarm':
      return new Swarm(game, table);
    case 'hydra':
      return new Hydra(game, table);
    case 'twins':
      return new Twins(game, table);
    case 'mirror':
      return new Mirror(game, table);
    case 'phantom':
      return new Phantom(game, table);
    case 'chrono':
      return new Chrono(game, table);
    case 'mothership':
      return new Mothership(game, table);
  }
}

export type { BossBase };
