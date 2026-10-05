// Pace and speed maths for the running converter. Everything is stored as
// seconds per km; each unit converts to and from that.

export type Unit = "mi" | "km" | "mph" | "kmh";

export const KM_PER_MI = 1.609344;
export const RACES_KM = { "5k": 5, "10k": 10, half: 21.0975, full: 42.195 };
export const DEFAULT_SEC_PER_KM = 540 / KM_PER_MI; // 9:00 /mi

// Step sizes in the unit's own terms (seconds or speed).
export const STEPS: Record<Unit, { small: number; big: number }> = {
  mi: { small: 5, big: 15 },
  km: { small: 5, big: 15 },
  mph: { small: 0.1, big: 0.5 },
  kmh: { small: 0.1, big: 0.5 },
};

export const isPace = (u: Unit) => u === "mi" || u === "km";

// "m:ss", or "h:mm:ss" from an hour up.
export function clock(totalSec: number) {
  const s = Math.round(totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

const kmh = (spk: number) => 3600 / spk;

// Seconds per mile/km for pace units, mph/km/h for speed units.
export function toUnit(spk: number, u: Unit) {
  return { mi: spk * KM_PER_MI, km: spk, mph: kmh(spk) / KM_PER_MI, kmh: kmh(spk) }[u];
}

export function fromUnit(v: number, u: Unit) {
  return { mi: v / KM_PER_MI, km: v, mph: 3600 / (v * KM_PER_MI), kmh: 3600 / v }[u];
}

// Every display value, keyed by the ids the page uses.
export function outputs(spk: number): Record<string, string> {
  const out: Record<string, string> = {
    mi: clock(spk * KM_PER_MI),
    km: clock(spk),
    mph: (kmh(spk) / KM_PER_MI).toFixed(2),
    kmh: kmh(spk).toFixed(2),
    lap: clock(spk * 0.4),
  };
  for (const [id, km] of Object.entries(RACES_KM)) out[id] = clock(spk * km);
  return out;
}

// How a value reads in its own unit, e.g. "8:30 /mi" or "12 km/h".
export function describe(spk: number, u: Unit) {
  const o = outputs(spk);
  const trim = (v: string) => String(Number(v));
  return { mi: `${o.mi} /mi`, km: `${o.km} /km`, mph: `${trim(o.mph)} mph`, kmh: `${trim(o.kmh)} km/h` }[u];
}

// Typed minutes and seconds → seconds per km, or null if not a usable pace.
export function parsePace(min: string, sec: string, u: Unit): number | null {
  const m = Number(min || 0);
  const s = Number(sec || 0);
  if (!Number.isFinite(m) || !Number.isFinite(s) || m < 0 || s < 0 || s >= 60) return null;
  const total = m * 60 + s;
  return total > 0 ? fromUnit(total, u) : null;
}

// Typed speed (comma or dot decimal) → seconds per km, or null.
export function parseSpeed(text: string, u: Unit): number | null {
  const v = Number(text.replace(",", "."));
  return text.trim() && Number.isFinite(v) && v > 0 ? fromUnit(v, u) : null;
}

// Round a unit value to the nearest step, never below one step.
export function snap(v: number, u: Unit) {
  const { small } = STEPS[u];
  return Math.max(small, Math.round(v / small) * small);
}
