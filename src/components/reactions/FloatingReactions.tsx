import { useCallback, useEffect, useRef, useState } from "react";
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

  return (
    <>
      {/* Floating animation layer */}
      <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
        {items.map((it) => (
          <span
            key={it.id}
            className="absolute text-3xl drop-shadow-lg reaction-float"
            style={{ left: `${it.x}%`, bottom: 8 }}
          >
            {it.emoji}
          </span>
        ))}
      </div>
      {/* Emoji bar */}
      <div className="absolute bottom-14 left-3 z-30 flex gap-1 rounded-full bg-black/60 backdrop-blur px-2 py-1 border border-white/10">
        {REACTION_EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => send(e)}
            className="text-lg leading-none hover:scale-125 transition-transform"
            title={`React ${e}`}
          >
            {e}
          </button>
        ))}
      </div>
    </>
  );
}
