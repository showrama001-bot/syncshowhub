import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const REACTION_EMOJIS = ["🔥", "😂", "😮", "❤️", "👏", "😢"] as const;
export type Reaction = { id: string; emoji: string; x: number; born: number };

/**
 * Overlay + bar of animated floating emoji reactions.
 *
 * If `channelKey` is set, reactions are broadcast via Supabase Realtime
 * (`reactions:<channelKey>`) so all viewers in the same room / TV channel
 * see them in real time. Without a `channelKey` it's local-only.
 */
export function FloatingReactions({
  channelKey,
  className = "",
}: {
  channelKey?: string;
  className?: string;
}) {
  const [items, setItems] = useState<Reaction[]>([]);
  const [hidden, setHidden] = useState(false);
  const [active, setActive] = useState(true);
  const idleTimer = useRef<number | null>(null);
  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const seed = useRef(0);

  const spawn = useCallback((emoji: string) => {
    seed.current += 1;
    const r: Reaction = {
      id: `${Date.now()}-${seed.current}`,
      emoji,
      x: 10 + Math.random() * 80, // percent
      born: Date.now(),
    };
    setItems((it) => [...it, r]);
    // Notify heatmap listeners in the same window (local reactions).
    try { window.dispatchEvent(new CustomEvent("floating-reaction", { detail: { emoji } })); } catch {}
    window.setTimeout(() => {
      setItems((it) => it.filter((x) => x.id !== r.id));
    }, 2600);
  }, []);

  useEffect(() => {
    if (!channelKey) return;
    const ch = supabase.channel(`reactions:${channelKey}`, {
      config: { broadcast: { self: false } },
    });
    ch.on("broadcast", { event: "emoji" }, ({ payload }) => {
      if (payload?.emoji) spawn(String(payload.emoji));
    });
    ch.subscribe();
    chRef.current = ch;
    return () => { supabase.removeChannel(ch); chRef.current = null; };
  }, [channelKey, spawn]);

  const send = useCallback((emoji: string) => {
    spawn(emoji);
    chRef.current?.send({ type: "broadcast", event: "emoji", payload: { emoji } });
  }, [spawn]);

  // Auto-fade the reactions bar after a few seconds of inactivity.
  const bump = useCallback(() => {
    setActive(true);
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setActive(false), 2800);
  }, []);
  useEffect(() => {
    bump();
    const onMove = () => bump();
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("touchstart", onMove, { passive: true });
    window.addEventListener("keydown", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchstart", onMove);
      window.removeEventListener("keydown", onMove);
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
    };
  }, [bump]);

  return (
    <>
      {/* Floating animation layer */}
      <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
        {!hidden && items.map((it) => (
          <span
            key={it.id}
            className="absolute text-3xl drop-shadow-lg reaction-float"
            style={{ left: `${it.x}%`, bottom: 8 }}
          >
            {it.emoji}
          </span>
        ))}
      </div>
      {/* Toggle — always available, tiny, doesn't cover video content. */}
      <button
        type="button"
        onClick={() => { setHidden((h) => !h); bump(); }}
        onMouseEnter={bump}
        className={`absolute bottom-14 left-3 z-40 pointer-events-auto rounded-full bg-black/60 backdrop-blur border border-white/10 p-1.5 text-white/80 hover:text-white transition-opacity duration-300 ${active ? "opacity-80 hover:opacity-100" : "opacity-0 hover:opacity-80"}`}
        title={hidden ? "Show reactions" : "Hide reactions"}
        aria-label={hidden ? "Show reactions" : "Hide reactions"}
      >
        {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
      {/* Emoji bar — auto-fades when idle, revealed on hover/touch. */}
      {!hidden && (
        <div
          onMouseEnter={bump}
          onTouchStart={bump}
          className={`absolute bottom-14 left-12 sm:left-14 z-30 flex gap-1 rounded-full bg-black/60 backdrop-blur px-2 py-1 border border-white/10 pointer-events-auto transition-opacity duration-500 ${active ? "opacity-90 hover:opacity-100" : "opacity-0 hover:opacity-100"}`}
        >
          {REACTION_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => { send(e); bump(); }}
              className="text-lg leading-none hover:scale-125 transition-transform"
              title={`React ${e}`}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
