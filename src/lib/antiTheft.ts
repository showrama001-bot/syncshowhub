/**
 * Global anti-theft protection: disables right-click, common DevTools shortcuts,
 * drag-and-drop on images/videos, and text selection on media wrappers.
 * Note: this is a deterrent, not real DRM — a determined user can still inspect.
 */
export function installAntiTheft() {
  if (typeof window === "undefined") return;
  if ((window as any).__antiTheftInstalled) return;
  (window as any).__antiTheftInstalled = true;

  // Block context menu site-wide.
  const onContext = (e: MouseEvent) => {
    e.preventDefault();
  };

  // Block common DevTools / view-source shortcuts.
  const onKey = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
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
    // Ctrl/Cmd + Shift + I/J/C  -> devtools / console / inspector
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c"].includes(key)) {
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
}