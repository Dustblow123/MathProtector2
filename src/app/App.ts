import { audio } from '../audio/AudioManager';
import { FLUENT_MS, type Profile } from '../data/profile';
import { load, save, type SaveData, type Settings } from '../data/storage';
import type { ModeConfig, SessionResult } from '../game/types';
import { detectLang, setLang, type Lang } from '../i18n';
import { resolveSkins, type EquippedSkins } from '../progression/cosmetics';
import type { ApplyOutcome } from '../progression/apply';
import { tableOrder } from '../learning/curriculum';
import { clear } from '../ui/dom';
import { MenuBackdrop } from '../ui/backdrop';
import { renderAchievements } from './screens/achievements';
import { renderCampaign } from './screens/campaign';
import { renderDashboard } from './screens/dashboard';
import { renderGame } from './screens/game';
import { renderHangar } from './screens/hangar';
import { renderMenu } from './screens/menu';
import { renderModes } from './screens/modes';
import { renderProfiles } from './screens/profiles';
import { renderResults } from './screens/results';
import { renderSettings } from './screens/settings';

export type ScreenName = 'profiles' | 'menu' | 'campaign' | 'modes' | 'game' | 'results' | 'hangar' | 'achievements' | 'dashboard' | 'settings';

export interface GameLaunch {
  mode: ModeConfig;
  /** Titre affiché (ex. "Secteur 3 · Table de 5"). */
  title: string;
  /** Pour "Rejouer" : recrée une config fraîche (nouvelle seed). */
  rebuild: () => ModeConfig;
}

export interface ResultsParams {
  launch: GameLaunch;
  result: SessionResult;
  outcome: ApplyOutcome;
}

export interface ScreenResult {
  el: HTMLElement;
  destroy?: () => void;
}

export type ScreenParams = { game: GameLaunch; results: ResultsParams } & Record<Exclude<ScreenName, 'game' | 'results'>, undefined>;

const screens: { [K in ScreenName]: (app: App, params: ScreenParams[K]) => ScreenResult } = {
  profiles: renderProfiles,
  menu: renderMenu,
  campaign: renderCampaign,
  modes: renderModes,
  game: renderGame,
  results: renderResults,
  hangar: renderHangar,
  achievements: renderAchievements,
  dashboard: renderDashboard,
  settings: renderSettings,
};

export class App {
  readonly root: HTMLElement;
  save: SaveData;
  readonly backdrop: MenuBackdrop;
  private current: ScreenResult | null = null;
  private currentName: ScreenName | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.save = load();
    setLang(this.save.settings.lang ?? detectLang());
    this.backdrop = new MenuBackdrop(root);
    this.applySettings();
    const unlockAudio = () => {
      audio.unlock();
      audio.setVolumes(this.settings.sfxVolume, this.settings.musicVolume);
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
  }

  get settings(): Settings {
    return this.save.settings;
  }

  get profile(): Profile | null {
    return this.save.profiles.find((p) => p.id === this.save.activeProfileId) ?? null;
  }

  /** Profil actif ; lève si aucun (les écrans de jeu l'exigent). */
  get p(): Profile {
    const p = this.profile;
    if (!p) throw new Error('no profile');
    return p;
  }

  setProfile(p: Profile | null): void {
    this.save.activeProfileId = p ? p.id : null;
    this.persist(true);
    this.backdrop.setSkin(this.skins().nebula);
  }

  persist(immediate = false): void {
    save(this.save, immediate);
  }

  applySettings(): void {
    const s = this.settings;
    document.documentElement.dataset.reducedMotion = s.reducedMotion ? '1' : '0';
    this.backdrop.reducedMotion = s.reducedMotion;
    audio.setVolumes(s.sfxVolume, s.musicVolume);
  }

  setLang(l: Lang): void {
    this.settings.lang = l;
    setLang(l);
    this.persist();
    if (this.currentName && this.currentName !== 'game') this.go(this.currentName, undefined as never);
  }

  skins(): EquippedSkins {
    return resolveSkins(this.profile?.equipped ?? {});
  }

  fluentMs(): number {
    return FLUENT_MS[this.p.agePreset];
  }

  /** Tables débloquées en campagne (ordre pédagogique). */
  unlockedTables(): number[] {
    const p = this.p;
    return tableOrder(p.maxTable).slice(0, p.unlockedSector + 1);
  }

  go<K extends ScreenName>(name: K, params: ScreenParams[K]): void {
    this.current?.destroy?.();
    clear(this.root);
    this.root.appendChild(this.backdrop.el);
    if (name === 'game') this.backdrop.stop();
    else {
      this.backdrop.setSkin(this.skins().nebula);
      this.backdrop.start();
    }
    this.currentName = name;
    this.current = screens[name](this, params);
    this.root.appendChild(this.current.el);
    window.scrollTo(0, 0);
  }

  usesTouch(): boolean {
    const s = this.settings.numpad;
    if (s === 'on') return true;
    if (s === 'off') return false;
    return window.matchMedia('(pointer: coarse)').matches;
  }
}
