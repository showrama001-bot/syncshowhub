## Ads & Monetization System

Building a centralized ads platform driven by a single `ads_settings` row + an `ads_assets` table, controlled from a new **Ads Management** tab in the Admin Dashboard.

### 1. Database (Lovable Cloud)
- `ads_settings` (singleton row, id=1): `master_enabled bool`, `preroll_enabled bool`, `preroll_skip_seconds int`, `popup_enabled bool`, `popup_interval_seconds int`, `popup_duration_seconds int`, `antiadblock_enabled bool`, `interstitial_seconds int`, timestamps.
- `ads_assets`: `id`, `placement` enum (`preroll`, `popup`, `banner_header`, `banner_grid`, `banner_under_player`, `interstitial`), `media_type` ('video'|'image'), `media_url`, `redirect_url`, `weight int`, `active bool`, `created_by`, timestamps.
- RLS: public `SELECT` for active rows + settings; admin (`has_role admin`) full CRUD. Full GRANTs.

### 2. Frontend Components (`src/components/ads/`)
- `AdsProvider.tsx` — fetches `ads_settings` + assets once, exposes context, realtime updates.
- `VideoAdPlayer.tsx` — pre-roll: autoplay muted video, large countdown overlay, Skip button hidden until 0, click → opens `redirect_url` in new tab.
- `PopupAdOverlay.tsx` — periodic full-screen modal with autoplay video; close X disabled until countdown ends.
- `HeaderBanner.tsx` — top horizontal banner mounted in `AppShell`.
- `GridBanner.tsx` — banner card injected every N items in home/movies grids.
- `UnderPlayerBanner.tsx` — placed under `BunnyVideoPlayer` on player pages.
- `AntiAdblock.tsx` — bait div check; if blocked + `antiadblock_enabled`, render blur overlay.
- `useAdRotation()` — weighted random selection per placement.

### 3. Player Integration
- Wrap `BunnyVideoPlayer` + HLS player + match iframe with `VideoAdPlayer` gate.
- Mount `PopupAdOverlay` + `AntiAdblock` + `HeaderBanner` inside `AppShell`.
- Inject `GridBanner` into Home/Movies/Series grids.
- Add `UnderPlayerBanner` to `Player.tsx`.

### 4. Interstitial Redirect (`src/pages/Redirect.tsx`)
- Route `/redirect?to=<url>`; 10s countdown with banner ads above/below; button revealed at 0.
- Helper `src/lib/safeRedirect.ts` to wrap external links.

### 5. Admin UI (new tab in `src/pages/app/Admin.tsx`)
- **Settings panel**: master toggle, preroll on/off + skip seconds slider, popup interval/duration, anti-adblock toggle, interstitial seconds.
- **Assets manager**: table grouped by placement with add/edit/delete (URL, redirect, weight, active). Live preview thumbnails.
- Fully responsive (mobile-first grid → desktop table).

### 6. Files
- **New**: migration; `src/components/ads/{AdsProvider,VideoAdPlayer,PopupAdOverlay,HeaderBanner,GridBanner,UnderPlayerBanner,AntiAdblock}.tsx`; `src/lib/ads.ts`; `src/lib/safeRedirect.ts`; `src/pages/Redirect.tsx`; `src/components/admin/AdsManager.tsx`.
- **Edited**: `src/App.tsx` (route + provider), `src/components/layout/AppShell.tsx` (header/popup/antiadblock mounts), `src/pages/app/Player.tsx` (preroll gate + under-player banner), `src/pages/app/Home.tsx` + `Movies.tsx` + `Series.tsx` (grid banners), `src/pages/app/Admin.tsx` (new tab).

Approve to proceed — migration goes first, then code.
