// Password policy: min 8 chars, upper, lower, number, special symbol.
export const PASSWORD_POLICY_MESSAGE =
  "Password must be at least 8 characters and include uppercase, lowercase, number, and special symbol.";

export function validatePasswordStrength(pw: string): string | null {
  if (pw.length < 8) return PASSWORD_POLICY_MESSAGE;
  if (!/[A-Z]/.test(pw)) return PASSWORD_POLICY_MESSAGE;
  if (!/[a-z]/.test(pw)) return PASSWORD_POLICY_MESSAGE;
  if (!/[0-9]/.test(pw)) return PASSWORD_POLICY_MESSAGE;
  if (!/[^A-Za-z0-9]/.test(pw)) return PASSWORD_POLICY_MESSAGE;
  return null;
}

// --- Login rate limiting (client-side, per browser) ---
// Max 3 failed attempts, then 5-minute lockout.
const LS_KEY = "syncshow.login.rl";
const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 5 * 60 * 1000;

type RlState = { fails: number; lockedUntil: number };

function read(): RlState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { fails: 0, lockedUntil: 0 };
    return JSON.parse(raw);
  } catch {
    return { fails: 0, lockedUntil: 0 };
  }
}
function write(s: RlState) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {}
}

export function getLoginLockRemainingMs(): number {
  const s = read();
  const rem = s.lockedUntil - Date.now();
  return rem > 0 ? rem : 0;
}

export function recordLoginFailure(): { locked: boolean; remainingMs: number } {
  const s = read();
  const fails = s.fails + 1;
  if (fails >= MAX_ATTEMPTS) {
    const next = { fails: 0, lockedUntil: Date.now() + LOCKOUT_MS };
    write(next);
    return { locked: true, remainingMs: LOCKOUT_MS };
  }
  write({ fails, lockedUntil: 0 });
  return { locked: false, remainingMs: 0 };
}

export function resetLoginFailures() {
  write({ fails: 0, lockedUntil: 0 });
}

export function formatLockoutMessage(ms: number): string {
  const mins = Math.ceil(ms / 60000);
  return `Too many failed attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`;
}