// Client-side shared library for locally-published Studio content.
// Bridges Studio → /movies and /rooms without a backend round-trip.
export type LocalMovie = {
  id: string;
  tmdb_id: number;
  title: string;
  year: number | null;
  genre: string | null;
  poster_url: string | null;
  status: "published";
  created_at: string;
  imdb_rating?: number | null;
  category?: string | null;
};

export type LocalLiveRoom = {
  id: string;
  title: string;
  host_id: string;
  content_title: string | null;
  poster_url: string | null;
  visibility: "public";
  status: "live";
  scheduled_at: null;
  participant_count: number;
  created_at: string;
  // Marker so consumers can route to /live-stream instead of /watch/:id
  is_studio_live: true;
};

const MOVIES_KEY = "syncshow.localLibrary.movies";
const ROOMS_KEY = "syncshow.localLibrary.liveRooms";
const EVT = "syncshow:local-library-updated";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(EVT));
  } catch {}
}

export function getLocalMovies(): LocalMovie[] {
  return readJson<LocalMovie[]>(MOVIES_KEY, []);
}
export function getLocalLiveRooms(): LocalLiveRoom[] {
  return readJson<LocalLiveRoom[]>(ROOMS_KEY, []);
}

export function publishLocalMovie(input: Omit<LocalMovie, "status" | "created_at">): LocalMovie {
  const list = getLocalMovies();
  const existing = list.find((m) => m.tmdb_id === input.tmdb_id);
  const record: LocalMovie = {
    ...input,
    status: "published",
    created_at: existing?.created_at ?? new Date().toISOString(),
  };
  const next = existing
    ? list.map((m) => (m.tmdb_id === input.tmdb_id ? record : m))
    : [record, ...list];
  writeJson(MOVIES_KEY, next);
  return record;
}

export function publishLocalLiveRoom(input: Omit<LocalLiveRoom, "status" | "visibility" | "scheduled_at" | "created_at" | "is_studio_live">): LocalLiveRoom {
  const list = getLocalLiveRooms();
  const record: LocalLiveRoom = {
    ...input,
    visibility: "public",
    status: "live",
    scheduled_at: null,
    created_at: new Date().toISOString(),
    is_studio_live: true,
  };
  const next = [record, ...list.filter((r) => r.id !== input.id)];
  writeJson(ROOMS_KEY, next);
  return record;
}

export function subscribeLocalLibrary(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(EVT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVT, handler);
    window.removeEventListener("storage", handler);
  };
}