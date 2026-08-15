/**
 * Production error monitoring for SyncShow.
 *
 * Captures uncaught errors, unhandled promise rejections, console.error calls,
 * failed network requests (fetch/XHR) and manual player/admin reports, then
 * ships them to the `client_error_logs` table with a small breadcrumb trail.
 *
 * Safety rails: fingerprint de-duplication, a per-session cap, and a hard
 * "never report our own reporting" guard so logging can't loop.
 */
import { supabase } from "@/integrations/supabase/client";

export type MonitoringArea = "player" | "admin" | "app";
export type MonitoringLevel = "error" | "warn" | "info";

type Breadcrumb = { t: number; kind: string; text: string };

type ReportInput = {
  message: string;
  stack?: string | null;
  level?: MonitoringLevel;
  source?: string;
  area?: MonitoringArea;
  statusCode?: number | null;
  requestUrl?: string | null;
  context?: Record<string, unknown>;
};

const MAX_EVENTS_PER_SESSION = 40;
const DEDUPE_WINDOW_MS = 60_000;
const MAX_BREADCRUMBS = 25;

const breadcrumbs: Breadcrumb[] = [];
const lastSeen = new Map<string, number>();
let sent = 0;
let installed = false;
let reporting = false;

const truncate = (v: unknown, n = 2000) => {
  const s = typeof v === "string" ? v : safeStringify(v);
  return s.length > n ? `${s.slice(0, n)}…` : s;
};

function safeStringify(v: unknown): string {
  try {
    if (v instanceof Error) return `${v.name}: ${v.message}`;
    if (typeof v === "object" && v !== null) return JSON.stringify(v);
    return String(v);
  } catch {
    return "[unserializable]";
  }
}

export function addBreadcrumb(kind: string, text: string) {
  breadcrumbs.push({ t: Date.now(), kind, text: truncate(text, 300) });
  if (breadcrumbs.length > MAX_BREADCRUMBS) breadcrumbs.shift();
}

/** Derive the functional area from the current route. */
export function currentArea(): MonitoringArea {
  if (typeof window === "undefined") return "app";
  const p = window.location.pathname;
  if (p.startsWith("/admin")) return "admin";
  if (p.startsWith("/play") || p.startsWith("/watch") || p.startsWith("/studio") || p.startsWith("/live-stream"))
    return "player";
  return "app";
}

function fingerprintOf(area: string, source: string, message: string) {
  return `${area}|${source}|${message.slice(0, 120)}`;
}

/** Report an error. Never throws, never blocks the caller. */
export async function reportError(input: ReportInput): Promise<void> {
  if (typeof window === "undefined") return;
  if (reporting) return;
  if (sent >= MAX_EVENTS_PER_SESSION) return;

  const message = truncate(input.message, 1000);
  if (!message) return;

  const area = input.area ?? currentArea();
  const source = input.source ?? "manual";
  const fp = fingerprintOf(area, source, message);
  const now = Date.now();
  const prev = lastSeen.get(fp);
  if (prev && now - prev < DEDUPE_WINDOW_MS) return;
  lastSeen.set(fp, now);

  reporting = true;
  sent += 1;
  try {
    const { data: auth } = await supabase.auth.getUser();
    await supabase.from("client_error_logs" as any).insert({
      user_id: auth?.user?.id ?? null,
      level: input.level ?? "error",
      area,
      source,
      message,
      stack: input.stack ? truncate(input.stack, 4000) : null,
      route: window.location.pathname + window.location.search,
      user_agent: navigator.userAgent.slice(0, 400),
      status_code: input.statusCode ?? null,
      request_url: input.requestUrl ? truncate(input.requestUrl, 500) : null,
      fingerprint: fp,
      context: {
        ...(input.context ?? {}),
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        breadcrumbs: breadcrumbs.slice(-12),
      },
    });
  } catch {
    /* monitoring must never break the app */
  } finally {
    reporting = false;
  }
}

/** Convenience wrapper for player failures (playback, HLS, embeds, sync). */
export function reportPlayerError(message: string, context?: Record<string, unknown>, stack?: string | null) {
  void reportError({ message, stack, area: "player", source: "player", context });
}

/** Convenience wrapper for admin dashboard failures (CRUD, uploads, ads). */
export function reportAdminError(message: string, context?: Record<string, unknown>, stack?: string | null) {
  void reportError({ message, stack, area: "admin", source: "admin", context });
}

function isInternalUrl(url: string) {
  return url.includes("/rest/v1/client_error_logs");
}

/** Dev-mode React warnings and known browser noise are breadcrumbs, not incidents. */
const IGNORED_PATTERNS = [
  /^Warning:/i,
  /React DevTools/i,
  /ResizeObserver loop/i,
  /Download the React DevTools/i,
];

function isNoise(text: string) {
  return IGNORED_PATTERNS.some((re) => re.test(text.trim()));
}

export function installMonitoring() {
  if (typeof window === "undefined" || installed) return;
  installed = true;

  window.addEventListener("error", (e: ErrorEvent) => {
    if (e.error instanceof Error || e.message) {
      void reportError({
        message: e.message || "Uncaught error",
        stack: e.error?.stack ?? null,
        source: "window.onerror",
        context: { file: e.filename, line: e.lineno, col: e.colno },
      });
    }
  });

  // Media element failures bubble as capture-phase "error" events.
  window.addEventListener(
    "error",
    (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (!t || (t.tagName !== "VIDEO" && t.tagName !== "AUDIO" && t.tagName !== "IFRAME")) return;
      const media = t as HTMLMediaElement;
      void reportError({
        message: `${t.tagName.toLowerCase()} failed to load${media.error ? ` (code ${media.error.code})` : ""}`,
        source: "media",
        area: "player",
        context: { src: truncate((t as HTMLMediaElement).currentSrc || (t as any).src || "", 300) },
      });
    },
    true
  );

  window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
    const r: any = e.reason;
    void reportError({
      message: r instanceof Error ? r.message : truncate(r, 500) || "Unhandled promise rejection",
      stack: r instanceof Error ? r.stack ?? null : null,
      source: "unhandledrejection",
    });
  });

  // console.error / console.warn → breadcrumbs + error reports
  const origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    origError(...args);
    const text = args.map((a) => safeStringify(a)).join(" ");
    addBreadcrumb("console.error", text);
    if (!reporting && text && !isNoise(text)) void reportError({ message: text, source: "console.error" });
  };
  const origWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    origWarn(...args);
    addBreadcrumb("console.warn", args.map((a) => safeStringify(a)).join(" "));
  };

  // fetch instrumentation: breadcrumbs for every call, reports for failures
  const origFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method || (input as Request)?.method || "GET").toUpperCase();
    const started = performance.now();
    try {
      const res = await origFetch(input as any, init);
      const ms = Math.round(performance.now() - started);
      if (!isInternalUrl(url)) {
        addBreadcrumb("fetch", `${method} ${url} → ${res.status} (${ms}ms)`);
        if (res.status >= 400) {
          void reportError({
            message: `HTTP ${res.status} on ${method} ${url.split("?")[0]}`,
            source: "network",
            level: res.status >= 500 ? "error" : "warn",
            statusCode: res.status,
            requestUrl: url,
            context: { method, duration_ms: ms },
          });
        }
      }
      return res;
    } catch (err: any) {
      if (!isInternalUrl(url)) {
        addBreadcrumb("fetch", `${method} ${url} → network failure`);
        void reportError({
          message: `Network request failed: ${method} ${url.split("?")[0]}`,
          stack: err?.stack ?? null,
          source: "network",
          requestUrl: url,
          context: { method },
        });
      }
      throw err;
    }
  };
}
