# Build Plan — Rooms v2, Social Feed & Reels

Scope is large; splitting into 3 phases so each can be validated in the preview before moving on. All work respects the existing DB, movie layout, ads system, and Telegram pipeline.

---

## Phase 1 — Shared Rooms v2 (Jitsi removal + native sync + voice)

**Frontend**
- Rewrite `src/pages/app/Watch.tsx`: remove Jitsi iframe entirely.
- Add `SyncedPlayer` component wrapping `BunnyVideoPlayer`/HLS. Uses a Supabase Realtime broadcast channel `room:{id}:playback` to emit `{action: play|pause|seek, time, at}`. Host is authoritative; guests apply events with drift correction (±0.5s snap).
- Add `VoiceChat` component: mesh WebRTC (RTCPeerConnection per peer) with signaling via Supabase Realtime `room:{id}:signal` (offer/answer/ICE). Mic mute toggle, per-peer volume meter. Mobile-optimized (audio-only, `echoCancellation`, `noiseSuppression`).
- Room creation modal in `Rooms.tsx`: enforce unique `title` (DB check + friendly error).
- Host "Kick" button already scaffolded — wire it to insert into a new `room_kicks` table; guests self-eject on kick event.
- `FriendsSidebar` in room: "Invite" button calls existing `inviteToRoom` → creates `room_invites` row (already picked up by `InviteNotifier`).

**Backend (migration)**
- `ALTER TABLE watch_rooms ADD CONSTRAINT watch_rooms_title_key UNIQUE (title);`
- New table `room_kicks(room_id, user_id, kicked_by, created_at)` + RLS: host can insert; kicked user can read own row.
- Enable Realtime on `room_kicks`.

## Phase 2 — Friends / DMs polish

- `Friends.tsx`: verify "Invite to Room" button appears next to each accepted friend when a room context exists (via query param `?invite=roomId`).
- `DMs.tsx`: add "Invite to current room" quick action.
- Notification toast already handled by `InviteNotifier`.

## Phase 3 — Accueil (Social Feed) + Reels

**Accueil**
- Replace placeholder `Accueil.tsx` with feed: composer (text + optional image via existing `avatars` bucket pattern → new `feed-media` bucket), timeline list, like/comment.
- New tables: `feed_posts(user_id, content, image_url)`, `feed_likes(post_id, user_id)`, `feed_comments(post_id, user_id, content)`. Full RLS + GRANTs.
- Insert `<GridBanner />` ad every 4 posts.

**Reels**
- New table `reels(id, source_type: 'trailer'|'upload', youtube_id, video_url, movie_id, title, created_by, created_at)`. Admin-only insert policy.
- Admin panel `ReelsTab` in `Admin.tsx`: import from existing `trailers` table (one-click) or upload short MP4 via Telegram pipeline.
- `Reels.tsx`: full-screen vertical snap-scroll feed. Each 3rd swipe forces an ad slide (from `AdsProvider` video assets) that must complete before next reel unlocks.
- Each reel card shows a prominent "Watch full movie" button → `/play/movie/{movie_id}` (strict FK match; button hidden if no movie link).

---

## Technical notes

- **Sync algorithm**: host broadcasts every state change + heartbeat every 5s with `currentTime`. Guests correct if drift > 1.5s.
- **WebRTC**: STUN only (`stun:stun.l.google.com:19302`), no TURN. Sufficient for most mobile networks; document limitation.
- **Ad lock in Reels**: `swipeCount % 3 === 0` injects an `AdSlide` component using `useAds().pick('reel')` with a required `ended` event before advancing.
- **Right-click / anti-download** already global via `installAntiTheft`.

## Delivery order

1. Migration for room uniqueness + kicks + feed + reels tables (single migration, awaits approval).
2. Phase 1 code once migration approved.
3. Phase 2 tweaks.
4. Phase 3 code + admin UI.

Confirm to proceed and I'll ship the migration first.