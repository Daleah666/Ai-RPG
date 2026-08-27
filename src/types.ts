export type Screen = "title" | "create" | "play" | "combat" | "ending";
export type TimeOfDay = "dawn" | "day" | "dusk" | "night";
export type Stat = "vigor" | "aether" | "steel" | "cunning" | "presence";
export type ClassId = "warden" | "hexweaver" | "ashblade" | "oathbound";
export type OriginId = "foundling" | "runaway" | "apostate";
export type LocationId =
  | "emberhearth"
  | "veilwood"
  | "saltmoor"
  | "archives"
  | "cathedral"
  | "rift";
export type DamageType = "physical" | "aether" | "fire" | "holy";
export type Panel = "pack" | "person" | "map" | "journal" | "settings";

export interface Stats {
  vigor: number;
  aether: number;
  steel: number;
  cunning: number;
  presence: number;
}

export interface Status {
  id: string;
  name: string;
  turns: number;
}

export interface ItemStack {
  defId: string;
  qty: number;
}

export interface Player {
  name: string;
  classId: ClassId;
  originId: OriginId;
  level: number;
  xp: number;
  hp: number;
  hpMax: number;
  mp: number;
  mpMax: number;
  stats: Stats;
  gold: number;
  inventory: ItemStack[];
  weapon?: string;
  armor?: string;
  relic?: string;
  skills: string[];
  statuses: Status[];
}

export interface World {
  seed: number;
  rng: number;
  day: number;
  time: TimeOfDay;
  locationId: LocationId;
  discovered: LocationId[];
  flags: Record<string, boolean | number | string>;
  memories: string[];
  lastSanctuary: LocationId;
}

export interface CombatState {
  enemyId: string;
  enemyHp: number;
  enemyHpMax: number;
  enemyName: string;
  round: number;
  log: string[];
  intent: string;
  playerGuard: boolean;
  enemyStatuses: Status[];
  canFlee: boolean;
  over?: "win" | "lose" | "flee";
}

export interface EventState {
  id: string;
  step: number;
  ctx?: Record<string, string | number | boolean>;
}

export interface Ending {
  id: string;
  title: string;
  body: string[];
}

export interface Settings {
  textSpeed: number;
  aiEnabled: boolean;
  apiKey: string;
  apiBase: string;
  model: string;
}

export interface GameState {
  screen: Screen;
  player: Player | null;
  world: World | null;
  combat: CombatState | null;
  event: EventState | null;
  ending: Ending | null;
  panel: Panel | null;
  settings: Settings;
}

export interface SkillCheck {
  stat: Stat;
  dc: number;
}

export interface Choice {
  id: string;
  label: string;
  hint?: string;
  skill?: SkillCheck;
  requireFlag?: string;
  requireItem?: string;
  requireGold?: number;
  hideIfFlag?: string;
  showIfFlag?: string;
  disabled?: boolean;
  apply: (state: GameState) => GameState;
  onFail?: (state: GameState) => GameState;
}

export interface Scene {
  id: string;
  title: string;
  kicker?: string;
  body: string[];
  locationId: LocationId;
  choices: Choice[];
}

export type CombatMove =
  | { kind: "skill"; skillId: string }
  | { kind: "item"; defId: string }
  | { kind: "defend" }
  | { kind: "flee" };

export type Action =
  | { type: "NEW_GAME" }
  | { type: "BACK_TITLE" }
  | { type: "CREATE"; name: string; classId: ClassId; originId: OriginId }
  | { type: "CHOICE"; choiceId: string }
  | { type: "COMBAT"; move: CombatMove }
  | { type: "COMBAT_END" }
  | { type: "OPEN_PANEL"; panel: Panel | null }
  | { type: "USE_ITEM"; defId: string }
  | { type: "EQUIP"; defId: string }
  | { type: "REST"; mode: "inn" | "camp" }
  | { type: "LOAD" }
  | { type: "DELETE_SAVE" }
  | { type: "SETTINGS"; patch: Partial<Settings> };
