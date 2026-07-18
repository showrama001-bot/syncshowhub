## Overview

Rebuild the `/studio` page (and `/live-stream` viewer route) from scratch with a real Supabase-backed architecture — no localStorage mocks. Live sessions are broadcast via Supabase Realtime; movie uploads route through a new isolated Telegram bot; ambient sounds are host-controlled and synced to all viewers.

## 1. Database (new migration)

New table `studio_streams`:
- `id uuid pk`, `host_id uuid → auth.users`, `title text`, `poster_url text`, `tmdb_id int`
- `mode text` (`upload` | `obs`), `stream_url text`
- `status text` (`live` | `ended`), `viewer_count int default 0`
- `ambient_state jsonb` (per-track `{playing, volume, position, updated_at}`)
- `created_at`, `ended_at`
- RLS: host can insert/update/delete own rows; authenticated can SELECT rows where `status='live'`; hosts can update ambient_state on their row. Grants for `authenticated` + `service_role`.
- Enable Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE studio_streams;`

New table `studio_invites`:
- `id uuid pk`, `stream_id uuid`, `from_user uuid`, `to_user uuid`, `status text default 'pending'`, `created_at`
- RLS: sender can insert (must own stream); recipient can SELECT/UPDATE own row. Realtime enabled for instant popup toast.

## 2. New Telegram bot for Studio uploads

- Add two new runtime secrets via `add_secret`: `STUDIO_TELEGRAM_BOT_TOKEN`, `STUDIO_TELEGRAM_CHAT_ID` (completely isolated from existing `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`).
- New edge function `studio-telegram-upload` (mirrors `telegram-upload` but reads the new secrets). Returns `{ stream_url, file_id }`.
- Frontend helper `src/lib/studioTelegramUpload.ts` (analogous to existing `telegramUpload.ts`) targeting the new function.

## 3. Studio page (`/studio`)

Recreated `src/pages/app/Studio.tsx` with:
- **Tab switcher**: "Live Stream (OBS)" vs "Upload & Stream Movie" (host only).
- **OBS mode**: HLS URL input → "Connect & Go Live" writes row `{mode:'obs', stream_url, status:'live'}`.
- **Upload mode**:
  - TMDB search (existing `tmdb-fetch` function) → auto-fill title/poster/description/genre/year.
  - Drag/drop file → upload via new `studio-telegram-upload` function → returns direct URL.
  - On success: insert movie row into `movies` table (so it appears on Home + Movies pages automatically via existing queries) AND insert `studio_streams` row with `status='live'`.
- **Host video preview** with local `URL.createObjectURL` before publish, real `stream_url` after.
- **Friends invite panel** (host only): lists accepted friends from `friendships` table with an "Invite" button per user → inserts row into `studio_invites`.
- **Ambient Soundboard** (host only): existing 15 ambient tracks. Each track has play/pause + volume slider. Every change writes to `studio_streams.ambient_state` (throttled). Host also plays audio locally.
- Viewer mode (when route is `/live-stream` or user is not host): only shows video + chat + ambient audio (auto-played, muted-until-user-gesture fallback), controls hidden.

## 4. Viewer sync (`/live-stream`)

- Subscribes to the active `studio_streams` row via Realtime.
- Plays `stream_url` (HLS via `hls.js` if `.m3u8`, else native `<video>`).
- Reads `ambient_state` and mirrors each track's play/volume locally — audio blends with main video for all viewers simultaneously.
- Live chat: reuse `room_chat_messages` scoped to the stream id (or new `studio_chat_messages` if cleaner — will use existing pattern with `room_id=stream_id`).

## 5. Direct social invitations

- `InviteNotifier` pattern already exists for `room_invites`. Add a parallel realtime subscription for `studio_invites` filtered by `to_user=eq.<me>`:
  - Shows toast "[Host display_name] is inviting you to join their live stream!" with **Join Room** button → routes to `/live-stream?stream=<id>`.
- Register listener globally in `AppShell.tsx` alongside `InviteNotifier`.

## 6. Site-wide live banner

- New component `LiveNowBanner` mounted in `AppShell` above `<main>`.
- Subscribes to `studio_streams` where `status='live'`. When rows exist, shows a slim neon banner: "🔴 [Host] is LIVE — [Title] · Watch now" → routes to `/live-stream?stream=<id>`. Dismissible per-session.

## 7. Rooms page integration

- `Rooms.tsx`: fetch active `studio_streams` and prepend them as neon-badged "LIVE" cards in the Live-now grid. Clicking routes to `/live-stream?stream=<id>`.

## 8. Routes

- Re-add `/studio` and `/live-stream` (lazy) in `src/App.tsx`. Studio nav entry restored on Home grid.

## Technical details

- Files created:
  - `supabase/functions/studio-telegram-upload/index.ts`
  - `src/lib/studioTelegramUpload.ts`
  - `src/pages/app/Studio.tsx`
  - `src/components/studio/InviteFriendsPanel.tsx`
  - `src/components/studio/HostSoundboard.tsx`
  - `src/components/studio/ViewerAmbientSync.tsx`
  - `src/components/studio/StudioInviteNotifier.tsx`
  - `src/components/studio/LiveNowBanner.tsx`
  - New migration file for tables/RLS/realtime/grants.
- Files modified: `src/App.tsx`, `src/components/layout/AppShell.tsx`, `src/pages/app/Home.tsx`, `src/pages/app/Rooms.tsx`.
- Secrets requested: `STUDIO_TELEGRAM_BOT_TOKEN`, `STUDIO_TELEGRAM_CHAT_ID`.
- No localStorage sync — all state is Supabase Realtime.

## Confirmation needed before I start

I'll need you to provide the new Telegram bot token + chat id (I'll open secure prompts). Confirm this plan and I'll build it end-to-end.
