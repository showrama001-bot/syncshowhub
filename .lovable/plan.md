# Build Plan — Major Feature Expansion

This is a large, multi-system change. To keep it safe and **non-destructive** to the existing DB schema, movie styles, and core layout, I'll ship it in 5 phases. After each phase you can review before I move on.

> Bunny.net keys (`BUNNY_ACCESS_KEY`, `BUNNY_STORAGE_ZONE`, `BUNNY_PULL_ZONE`) remain declared in the backend secrets but **bypassed** in all new code paths. All new uploads route through the existing `telegram-upload` edge function.

---

## Phase 1 — Upload Gateway (Admin + Users) & Player Hardening

- New page `/upload-gateway` reusing the existing `UploadMovie` TMDB search + Telegram upload flow, but available to **any signed-in user**. Admin uploads go straight to `movies`/`series`; user uploads go to `community_uploads` (already in schema) for admin review.
- Reuses existing `tmdb-scraper` edge function and `uploadToTelegram` utility — no DB schema changes.
- Player hardening in `BunnyVideoPlayer`: wrap any iframe with `sandbox="allow-scripts allow-same-origin allow-presentation"`, add `onContextMenu={e=>e.preventDefault()}` on the container, ensure `controlsList="nodownload noremoteplayback"` and `disablePictureInPicture`. Guard `requestFullscreen`/`webkitEnterFullScreen` calls in `try/catch` to swallow the "Permission denied for function" error.

## Phase 2 — Super Scraper Parallel + Trailers Admin

- Modify `tmdb-scraper` `check_providers` to return **all** OK/unknown providers (not just the first). Update Player to render a **Server 1 / Server 2 / …** switcher when ≥2 are available.
- Add real-time **search filter bar** in `AdsManager`/Trailers admin tab for picking a movie by title.
- Extend trailers admin: attach trailer via YouTube URL **or** PC video upload (Telegram pipeline, 50 MB cap).
- New public route `/trailers` rendering all trailers in a responsive CSS Grid (`grid-cols-2 md:grid-cols-3 lg:grid-cols-4`).

## Phase 3 — Jitsi Rooms + DMs/Friends Repair

- Add `UNIQUE` constraint on `watch_rooms.name` (migration). Surface clear error in UI on collision.
- Replace external Jitsi redirect with **in-app** `<iframe src="https://meet.jit.si/<room>#config...">` (or `external_api.js`) sized responsively for mobile.
- Host moderation: store `host_user_id` (already exists via `created_by`); expose a "Kick" action that calls Jitsi External API `executeCommand('kickParticipant', id)`.
- DMs/Friends: audit `direct_messages` realtime subscription + `friendships` insert flow; add "Invite Friend" action creating a `friendships` row with status `pending` + in-app notification (uses existing `InviteNotifier`).

## Phase 4 — Social Feed (Accueil) + Reels

New tables (additive, with full GRANTs + RLS):

```text
social_posts(id, author_id, body, image_url, created_at)
social_post_likes(post_id, user_id, created_at)  -- PK (post_id,user_id)
social_post_comments(id, post_id, author_id, body, created_at)
reels(id, title, video_url, movie_id?, trailer_id?, created_by, created_at)
```

- `/accueil` — Facebook-style feed: text + image posts, like/comment/share, ad slots injected every 4 posts using existing `AdsProvider` placements.
- `/reels` — vertical TikTok-style swipe feed (snap-y, full viewport). Admin-only upload form; can pick an existing trailer or upload a video to Telegram. Every 4th item is a `preroll`/`interstitial` ad asset. CTA button → `/play/movie/:id` using strict ID match.

## Phase 5 — Sidebar Restructure

Reorder `SideDrawer` items exactly:

1. Home   2. Accueil   3. Reels   4. Trailers   5. Shared Rooms   6. Friends & Messages   7. Upload Gateway

Add `scrollbar-hide` utility (`scrollbar-width:none; &::-webkit-scrollbar{display:none}`) to the nav container with smooth scrolling.

---

## Out of scope / preserved as-is

- Existing Home, Movies, Series, Watchlist pages and movie card styling — untouched.
- All existing DB tables and columns — untouched (only additive migrations).
- Bunny.net code paths — left dormant.

## Question before I start

This is ~5 days of build work compressed. **Want me to execute all 5 phases sequentially in this conversation, or ship Phase 1 + 2 first so you can validate before I touch social/reels/jitsi?**
