/**
 * Central input sanitization for all user-generated text.
 *
 * Everything the user types (chat, DMs, posts, comments, room titles) is
 * normalized here before it reaches the database, so stored content can never
 * carry markup, script payloads, or control characters. Rendering stays safe
 * (React escapes by default) and any future HTML surface inherits clean data.
 */

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
// Zero-width / bidi-override characters used to hide payloads or spoof names.
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;
const HTML_TAG = /<\/?[a-z][\s\S]*?>/gi;
const DANGEROUS_SCHEME = /\b(javascript|data|vbscript)\s*:/gi;

export type SanitizeOptions = {
  /** Hard cap on the resulting string. */
  maxLength?: number;
  /** Keep newlines (multi-line posts). Defaults to false (single line). */
  allowNewlines?: boolean;
};

/** Strip markup, control/invisible chars and dangerous URI schemes. */
export function sanitizeText(input: unknown, opts: SanitizeOptions = {}): string {
  const { maxLength = 1000, allowNewlines = false } = opts;
  let s = typeof input === "string" ? input : input == null ? "" : String(input);
  s = s.normalize("NFKC");
  s = s.replace(CONTROL_CHARS, "").replace(INVISIBLE, "");
  s = s.replace(HTML_TAG, "");
  // Remove stray angle brackets left by malformed markup.
  s = s.replace(/[<>]/g, "");
  s = s.replace(DANGEROUS_SCHEME, "");
  s = allowNewlines
    ? s.replace(/\r\n?/g, "\n").replace(/\n{4,}/g, "\n\n\n").replace(/[ \t]{3,}/g, "  ")
    : s.replace(/\s+/g, " ");
  s = s.trim();
  return s.slice(0, maxLength);
}

/** Chat / DM messages: single-ish line, 500 chars. */
export function sanitizeMessage(input: unknown, maxLength = 500): string {
  return sanitizeText(input, { maxLength, allowNewlines: true });
}

/** Titles, room names, usernames: one line, no markup. */
export function sanitizeTitle(input: unknown, maxLength = 120): string {
  return sanitizeText(input, { maxLength });
}

/** Longer free-form bodies (posts, bios). */
export function sanitizeBody(input: unknown, maxLength = 2000): string {
  return sanitizeText(input, { maxLength, allowNewlines: true });
}

/** Only http(s) URLs survive; anything else becomes null. */
export function sanitizeUrl(input: unknown): string | null {
  const raw = sanitizeText(input, { maxLength: 2048 });
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Escape for the rare case where content must land in raw HTML. */
export function escapeHtml(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
