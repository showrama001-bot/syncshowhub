// Studio ↔ Viewer sync via localStorage. Mocks a live backend so the host
// page (/studio) and the viewer page (/live-stream) can share the current
// stream source and chat history.
import { useCallback, useEffect, useState } from "react";

export type StudioStreamState = {
  active: boolean;
  mode: "upload" | "obs" | null;
  stream_url: string | null; // blob: URL for local uploads or https://.../*.m3u8 for OBS
  title: string | null;
  poster_url: string | null;
  is_hls: boolean;
  updated_at: number;
};

export type StudioChatMsg = {
  id: string;
  user: string;
  text: string;
  color: string;
  ts: number;
};

export const STREAM_KEY = "studio_stream_state";
export const CHAT_KEY = "global_chat_history";
const EVT = "syncshow:studio-stream-updated";
const CHAT_EVT = "syncshow:studio-chat-updated";

const EMPTY: StudioStreamState = {
  active: false, mode: null, stream_url: null, title: null,
  poster_url: null, is_hls: false, updated_at: 0,
};

const readStream = (): StudioStreamState => {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STREAM_KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch { return EMPTY; }
};

export const writeStreamState = (patch: Partial<StudioStreamState>) => {
  const next = { ...readStream(), ...patch, updated_at: Date.now() };
  try {
    window.localStorage.setItem(STREAM_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(EVT));
  } catch {}
  return next;
};

export const clearStreamState = () => {
  try {
    window.localStorage.removeItem(STREAM_KEY);
    window.dispatchEvent(new CustomEvent(EVT));
  } catch {}
};

export function useStudioStream(): StudioStreamState {
  const [s, setS] = useState<StudioStreamState>(readStream);
  useEffect(() => {
    const sync = () => setS(readStream());
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", (e) => {
      if (!e.key || e.key === STREAM_KEY) sync();
    });
    return () => { window.removeEventListener(EVT, sync); };
  }, []);
  return s;
}

const readChat = (): StudioChatMsg[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CHAT_KEY);
    return raw ? (JSON.parse(raw) as StudioChatMsg[]) : [];
  } catch { return []; }
};

export function useStudioChat(seed: StudioChatMsg[] = []) {
  const [msgs, setMsgs] = useState<StudioChatMsg[]>(() => {
    const existing = readChat();
    if (existing.length === 0 && seed.length) {
      try {
        window.localStorage.setItem(CHAT_KEY, JSON.stringify(seed));
      } catch {}
      return seed;
    }
    return existing;
  });

  useEffect(() => {
    const sync = () => setMsgs(readChat());
    window.addEventListener(CHAT_EVT, sync);
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === CHAT_KEY) sync();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CHAT_EVT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const send = useCallback((msg: Omit<StudioChatMsg, "id" | "ts">) => {
    const entry: StudioChatMsg = {
      ...msg,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
    };
    const next = [...readChat(), entry].slice(-200);
    try {
      window.localStorage.setItem(CHAT_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent(CHAT_EVT));
    } catch {}
    setMsgs(next);
  }, []);

  return { messages: msgs, send };
}