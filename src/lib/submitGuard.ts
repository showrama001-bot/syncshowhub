/**
 * Per-action submission rate limiting (client side).
 *
 * Complements the global traffic guard in rateGuard.ts: this one throttles
 * individual user actions (sending chat, creating rooms, posting) so bots and
 * accidental loops can't spam the backend. State is kept in memory and mirrored
 * to sessionStorage so a reload doesn't reset a burst.
 */

type Bucket = { stamps: number[] };

const buckets = new Map<string, Bucket>();
const SS_PREFIX = "syncshow.rl.";

export type RateRule = { limit: number; windowMs: number };

/** Sensible presets for common actions. */
export const RATE_RULES = {
  chat: { limit: 10, windowMs: 10_000 },
  dm: { limit: 10, windowMs: 10_000 },
  post: { limit: 5, windowMs: 60_000 },
  comment: { limit: 8, windowMs: 60_000 },
  roomCreate: { limit: 3, windowMs: 60_000 },
  form: { limit: 5, windowMs: 30_000 },
  search: { limit: 20, windowMs: 10_000 },
} satisfies Record<string, RateRule>;

function load(key: string): Bucket {
  let b = buckets.get(key);
  if (b) return b;
  let stamps: number[] = [];
  try {
    const raw = sessionStorage.getItem(SS_PREFIX + key);
    if (raw) stamps = (JSON.parse(raw) as number[]).filter((n) => typeof n === "number");
  } catch {}
  b = { stamps };
  buckets.set(key, b);
  return b;
}

function persist(key: string, b: Bucket) {
  try {
    sessionStorage.setItem(SS_PREFIX + key, JSON.stringify(b.stamps.slice(-50)));
  } catch {}
}

export type RateResult = { ok: boolean; retryInMs?: number };

/** Records an attempt and reports whether it is allowed. */
export function checkRate(key: string, rule: RateRule = RATE_RULES.form): RateResult {
  const now = Date.now();
  const b = load(key);
  b.stamps = b.stamps.filter((t) => now - t < rule.windowMs);
  if (b.stamps.length >= rule.limit) {
    const retryInMs = rule.windowMs - (now - b.stamps[0]);
    persist(key, b);
    return { ok: false, retryInMs: Math.max(500, retryInMs) };
  }
  b.stamps.push(now);
  persist(key, b);
  return { ok: true };
}

/** Human-friendly message for a blocked attempt. */
export function rateMessage(res: RateResult): string {
  if (res.ok) return "";
  const secs = Math.ceil((res.retryInMs ?? 1000) / 1000);
  return `Slow down — try again in ${secs}s.`;
}
