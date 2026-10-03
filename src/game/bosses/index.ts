import type { Game } from '../Game';
import type { BossKind } from '../types';
import type { BossBase } from './BossBase';
import { Chrono } from './Chrono';
import { Hydra } from './Hydra';
import { Mirror } from './Mirror';
import { Mothership } from './Mothership';
import { Titan } from './Titan';

export function createBoss(kind: BossKind, game: Game, table: number): BossBase {
  switch (kind) {
    case 'titan':
      return new Titan(game, table);
    case 'hydra':
      return new Hydra(game, table);
    case 'mirror':
      return new Mirror(game, table);
    case 'chrono':
      return new Chrono(game, table);
    case 'mothership':
      return new Mothership(game, table);
  }
}

export type { BossBase };
