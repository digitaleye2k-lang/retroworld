// Persistent campaign progress + settings in localStorage (fails gracefully).
const KEY = 'stickops_blackout_v1';

const DEFAULTS = {
  unlocked: 1,
  completed: {},          // missionId -> { time, kills, accuracy, rank }
  points: 0,              // intel points for upgrades
  upgrades: {},           // id -> level
  checkpoint: null,       // { mission, stage, cp }
  settings: {
    master: 0.8, music: 0.55, sfx: 0.85, shake: 1, difficulty: 'regular', showFps: false, blood: true, subtitles: true,
  },
};

function clone(o) { return JSON.parse(JSON.stringify(o)); }

class SaveSystemImpl {
  constructor() {
    this.data = clone(DEFAULTS);
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.data = Object.assign(clone(DEFAULTS), parsed);
        this.data.settings = Object.assign(clone(DEFAULTS.settings), parsed.settings || {});
      }
    } catch (e) { /* storage unavailable: use defaults */ }
  }
  save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* ignore */ }
  }
  get settings() { return this.data.settings; }
  setSetting(k, v) { this.data.settings[k] = v; this.save(); }
  upgrade(id) { return this.data.upgrades[id] || 0; }
  buyUpgrade(def) {
    const lvl = this.upgrade(def.id);
    if (lvl >= def.max || this.data.points < def.cost) return false;
    this.data.points -= def.cost;
    this.data.upgrades[def.id] = lvl + 1;
    this.save();
    return true;
  }
  completeMission(id, stats) {
    const prev = this.data.completed[id];
    const first = !prev;
    if (!prev || (stats.score || 0) > (prev.score || 0)) this.data.completed[id] = stats;
    this.data.unlocked = Math.max(this.data.unlocked, Math.min(7, id + 1));
    const earned = (first ? 2 : 0) + (stats.rank === 'S' ? 2 : stats.rank === 'A' ? 1 : 0);
    this.data.points += earned;
    this.data.checkpoint = null;
    this.save();
    return earned;
  }
  setCheckpoint(cp) { this.data.checkpoint = cp; this.save(); }
  resetAll() {
    const settings = this.data.settings;
    this.data = clone(DEFAULTS);
    this.data.settings = settings;
    this.save();
  }
}

export const SaveSystem = new SaveSystemImpl();
