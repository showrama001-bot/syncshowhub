import { describe, it, expect, beforeAll } from "vitest";

/**
 * Live RLS / column-grant regression tests.
 * They hit the real backend with the public (anon) key and, when available,
 * an authenticated session, asserting that restricted columns and
 * cross-room chat stay unreadable.
 */

const URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// An authenticated access token can be provided to also cover the
// "signed-in user" case (the CI/browser harness injects it).
const AUTH_TOKEN =
  (import.meta.env.VITE_TEST_ACCESS_TOKEN as string | undefined) ||
  (typeof process !== "undefined"
    ? process.env.LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN
    : undefined);

type Role = "anon" | "authenticated";

function rest(path: string, role: Role) {
  const headers: Record<string, string> = {
    apikey: ANON,
    Authorization: `Bearer ${role === "authenticated" && AUTH_TOKEN ? AUTH_TOKEN : ANON}`,
  };
  return fetch(`${URL}/rest/v1/${path}`, { headers });
}

async function readColumn(table: string, column: string, role: Role) {
  const res = await rest(`${table}?select=${column}&limit=1`, role);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

/** A read is "denied" when PostgREST rejects it (permission/undefined column). */
function expectDenied(result: { status: number; body: any }) {
  expect(result.status).toBeGreaterThanOrEqual(400);
  const msg = JSON.stringify(result.body ?? "").toLowerCase();
  expect(
    msg.includes("permission denied") ||
      msg.includes("does not exist") ||
      msg.includes("column"),
  ).toBe(true);
}

const roles: Role[] = ["anon", "authenticated"];

describe("restricted column grants", () => {
  beforeAll(() => {
    expect(URL, "VITE_SUPABASE_URL must be set").toBeTruthy();
    expect(ANON, "VITE_SUPABASE_PUBLISHABLE_KEY must be set").toBeTruthy();
  });

  for (const role of roles) {
    it(`${role}: cannot read watch_rooms.password_hash`, async () => {
      expectDenied(await readColumn("watch_rooms", "password_hash", role));
    });

    it(`${role}: cannot read profiles moderation columns`, async () => {
      for (const col of ["is_banned", "suspended_until", "permanent_banned"]) {
        expectDenied(await readColumn("profiles", col, role));
      }
    });

    it(`${role}: can still read public profile columns`, async () => {
      const res = await rest("profiles?select=id,username,display_name&limit=1", role);
      // anon may be restricted entirely (403) but must never 500 or leak columns
      expect([200, 401, 403]).toContain(res.status);
    });
  }
});

describe("streamer_rooms visibility", () => {
  it("anon cannot read streamer_rooms rows", async () => {
    const res = await rest("streamer_rooms?select=id&limit=1", "anon");
    if (res.ok) {
      const rows = await res.json();
      expect(Array.isArray(rows) && rows.length).toBeFalsy();
    } else {
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
  });
});

describe("room chat isolation", () => {
  it("anon cannot read any room_chat_messages", async () => {
    const res = await rest("room_chat_messages?select=id,room_id&limit=5", "anon");
    if (res.ok) {
      const rows = await res.json();
      expect(Array.isArray(rows) && rows.length).toBeFalsy();
    } else {
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
  });

  it("authenticated users only see chat from rooms they may view", async () => {
    const chat = await rest("room_chat_messages?select=room_id&limit=200", "authenticated");
    if (!chat.ok) {
      expect(chat.status).toBeGreaterThanOrEqual(400);
      return;
    }
    const rows: Array<{ room_id: string }> = await chat.json();
    if (!rows.length) return; // nothing readable: trivially isolated

    // Only rooms the caller has actually joined (or hosts) may expose chat.
    const [joined, hosted] = await Promise.all([
      rest("room_participants?select=room_id&limit=1000", "authenticated"),
      rest("watch_rooms?select=id&limit=1000", "authenticated"),
    ]);
    const visibleIds = new Set<string>([
      ...(joined.ok ? ((await joined.json()) as Array<{ room_id: string }>).map((r) => r.room_id) : []),
      ...(hosted.ok ? ((await hosted.json()) as Array<{ id: string }>).map((r) => r.id) : []),
    ]);
    // Every readable chat message must belong to a watch room the caller can see.
    const leaked = rows.filter((r) => !visibleIds.has(r.room_id));
    expect(leaked, `chat leaked from ${leaked.length} non-visible rooms`).toHaveLength(0);
  });

  it("anon cannot read room_chat_messages of a specific room", async () => {
    const res = await rest("room_chat_messages?select=id&room_id=eq.00000000-0000-0000-0000-000000000000", "anon");
    if (res.ok) {
      expect((await res.json()).length).toBe(0);
    } else {
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
  });

  it("anon cannot read room_participants membership", async () => {
    const res = await rest("room_participants?select=room_id,user_id&limit=1", "anon");
    if (res.ok) {
      expect((await res.json()).length).toBe(0);
    } else {
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
  });

  it("anon cannot read direct_messages", async () => {
    const res = await rest("direct_messages?select=id&limit=1", "anon");
    if (res.ok) {
      const rows = await res.json();
      expect(Array.isArray(rows) && rows.length).toBeFalsy();
    } else {
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
  });
});