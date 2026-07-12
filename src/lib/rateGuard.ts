// Client-side abnormal-traffic guard: if fetch is called too many times in a
// short window (bot-like behavior), trigger a 5-minute cooldown and redirect
// the user to a cooldown page. This is a deterrent, not real DDoS protection.

const LS_KEY = "syncshow.cooldown.until";
// Tuned to only catch clearly-automated bursts. Legitimate flows (admin
// dashboard, reels, chunked uploads, realtime reconnects) can easily fire
// dozens of fetches in a short interval, so keep the threshold generous.
const WINDOW_MS = 5_000;    // 5 seconds
const MAX_REQUESTS = 400;   // threshold across the sliding window
const COOLDOWN_MS = 5 * 60 * 1000;

export function getCooldownRemainingMs(): number {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return 0;
    const until = parseInt(raw, 10);
    const rem = until - Date.now();
    if (rem <= 0) {
      localStorage.removeItem(LS_KEY);
      return 0;
    }
    return rem;
  } catch {
    return 0;
  }
}

export function triggerCooldown(ms: number = COOLDOWN_MS) {
  try {
    localStorage.setItem(LS_KEY, String(Date.now() + ms));
  } catch {}
  if (typeof window !== "undefined" && !location.pathname.startsWith("/cooldown")) {
    location.replace("/cooldown");
  }
}

export function installRateGuard() {
  if (typeof window === "undefined") return;
  if ((window as any).__rateGuardInstalled) return;
  (window as any).__rateGuardInstalled = true;

  // If we're already in a cooldown, send to the cooldown page immediately.
  if (getCooldownRemainingMs() > 0 && !location.pathname.startsWith("/cooldown")) {
    location.replace("/cooldown");
    return;
  }

  const originalFetch = window.fetch.bind(window);
  const stamps: number[] = [];

  window.fetch = ((...args: Parameters<typeof fetch>) => {
    const now = Date.now();
    // Drop stamps outside the sliding window.
    while (stamps.length && now - stamps[0] > WINDOW_MS) stamps.shift();
    stamps.push(now);
    if (stamps.length > MAX_REQUESTS) {
      triggerCooldown();
      return Promise.reject(new Error("Rate limit: cooldown active"));
    }
    return originalFetch(...args);
  }) as typeof fetch;
}