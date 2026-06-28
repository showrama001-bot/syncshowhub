// Lightweight client-side device fingerprint. Best-effort, not unspoofable.
const KEY = "ss_device_fp";

function hash(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return (h >>> 0).toString(36);
}

function canvasHash(): string {
  try {
    const c = document.createElement("canvas");
    c.width = 200; c.height = 50;
    const ctx = c.getContext("2d");
    if (!ctx) return "x";
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillStyle = "#f60";
    ctx.fillRect(0, 0, 200, 50);
    ctx.fillStyle = "#069";
    ctx.fillText("SyncShow-fp-🎬", 2, 2);
    return hash(c.toDataURL());
  } catch { return "x"; }
}

export function getDeviceFingerprint(): string {
  try {
    const cached = localStorage.getItem(KEY);
    if (cached) return cached;
  } catch {}
  const parts = [
    navigator.userAgent,
    navigator.language,
    String(screen.width), String(screen.height), String(screen.colorDepth),
    String(new Date().getTimezoneOffset()),
    String(navigator.hardwareConcurrency ?? ""),
    String((navigator as any).deviceMemory ?? ""),
    canvasHash(),
  ].join("|");
  const fp = hash(parts);
  try { localStorage.setItem(KEY, fp); } catch {}
  return fp;
}

export async function isDeviceBanned(supabase: any): Promise<boolean> {
  try {
    const fp = getDeviceFingerprint();
    const { data } = await supabase.rpc("is_device_banned", { _fp: fp });
    return !!data;
  } catch { return false; }
}