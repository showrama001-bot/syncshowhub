/**
 * Global anti-theft protection: disables right-click, common DevTools shortcuts,
 * drag-and-drop on images/videos, and text selection on media wrappers.
 * Note: this is a deterrent, not real DRM — a determined user can still inspect.
 */
import { installRateGuard } from "./rateGuard";

export function installAntiTheft() {
  if (typeof window === "undefined") return;
  if ((window as any).__antiTheftInstalled) return;
  (window as any).__antiTheftInstalled = true;

  // Block context menu site-wide.
  const onContext = (e: MouseEvent) => {
    const t = e.target as HTMLElement | null;
    if (t) {
      const tag = t.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        t.isContentEditable ||
        t.closest?.("input, textarea, select, [contenteditable=''], [contenteditable='true']")
      ) {
        return; // allow native context menu in form fields
      }
    }
    e.preventDefault();
  };

  // Block common DevTools / view-source shortcuts.
  const onKey = (e: KeyboardEvent) => {
    const key = (e.key ?? "").toLowerCase();
    if (!key && e.key !== "F12") return;
    // F12
    if (e.key === "F12") {
      e.preventDefault();
      return;
    }
    // Ctrl/Cmd + U  -> view source
    if ((e.ctrlKey || e.metaKey) && key === "u") {
      e.preventDefault();
      return;
    }
    // Ctrl/Cmd + S  -> save page
    if ((e.ctrlKey || e.metaKey) && key === "s") {
      e.preventDefault();
      return;
    }
    // Ctrl/Cmd + P  -> print
    if ((e.ctrlKey || e.metaKey) && key === "p") {
      e.preventDefault();
      return;
    }
    // Ctrl/Cmd + Shift + I/J/C/K  -> devtools / console / inspector
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c", "k"].includes(key)) {
      e.preventDefault();
      return;
    }
  };

  // Block dragging media (prevents "drag image to new tab / save").
  const onDragStart = (e: DragEvent) => {
    const t = e.target as HTMLElement | null;
    if (!t) return;
    const tag = t.tagName;
    if (tag === "IMG" || tag === "VIDEO" || tag === "SOURCE") {
      e.preventDefault();
    }
  };

  document.addEventListener("contextmenu", onContext);
  document.addEventListener("keydown", onKey);
  document.addEventListener("dragstart", onDragStart);

  // Detect abnormal automated request bursts → 5-minute cooldown.
  installRateGuard();
}