import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { HlsPlayer } from "@/components/streaming/HlsPlayer";
import { BunnyVideoPlayer } from "@/components/streaming/BunnyVideoPlayer";
import { EmbedPlayer, isEmbedUrl } from "@/components/streaming/EmbedPlayer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Star } from "lucide-react";
import { WatchlistButton } from "@/components/movies/WatchlistButton";
import { MovieComments } from "@/components/movies/MovieComments";
import { ReportMovieButton } from "@/components/movies/ReportMovieButton";
import { WatchTogetherButton } from "@/components/watch/WatchTogetherButton";
import { AdPlayerShell } from "@/components/ads/AdVideoPlayer";
import { UnderPlayerBanner } from "@/components/ads/UnderPlayerBanner";
import { TvChannelChat } from "@/components/tv/TvChannelChat";
import { PlaybackReportButton } from "@/components/player/PlaybackReportButton";
import { AutoNextOverlay } from "@/components/player/AutoNextOverlay";
import { FloatingReactions } from "@/components/reactions/FloatingReactions";
import { reportPlayerError } from "@/lib/monitoring";

export default function Player() {
  const { kind, id } = useParams();
  const [item, setItem] = useState<any>(null);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
  const [activeEpisodeId, setActiveEpisodeId] = useState<string | null>(null);
  const [allEpisodes, setAllEpisodes] = useState<any[]>([]);
  const [showAutoNext, setShowAutoNext] = useState(false);
  const [serverIdx, setServerIdx] = useState(0);

  useEffect(() => {
    if (!id) return;
    const table =
      kind === "tv" ? "tv_channels" :
      kind === "match" ? "matches" :
      kind === "series" ? "series" : "movies";
    supabase.from(table as any).select("*").eq("id", id).maybeSingle().then(({ data, error }) => {
      if (error) reportPlayerError(`Failed to load ${kind} record: ${error.message}`, { kind, id });
      else if (!data) reportPlayerError(`No ${kind} found for id`, { kind, id });
      setItem(data);
    });
  }, [kind, id]);

  // Series: load seasons + episodes
  useEffect(() => {
    if (kind !== "series" || !id) return;
    setActiveSeasonId(null);
    setActiveEpisodeId(null);
    setEpisodes([]);
    (supabase.from("seasons" as any).select("*").eq("series_id", id).order("season_number") as any)
      .then(({ data }: any) => {
        setSeasons(data ?? []);
        if (data && data.length) setActiveSeasonId(data[0].id);
      });
  }, [kind, id]);

  useEffect(() => {
    if (!activeSeasonId) return;
    (supabase.from("episodes" as any).select("*").eq("season_id", activeSeasonId).order("episode_number") as any)
      .then(({ data }: any) => {
        setEpisodes(data ?? []);
        setActiveEpisodeId(data && data.length ? data[0].id : null);
      });
  }, [activeSeasonId]);

  // Load every episode across every season for cross-season auto-next ordering.
  useEffect(() => {
    if (kind !== "series" || seasons.length === 0) return;
    const ids = seasons.map((s) => s.id);
    (supabase.from("episodes" as any).select("id, season_id, episode_number, title").in("season_id", ids) as any)
      .then(({ data }: any) => setAllEpisodes(data ?? []));
  }, [kind, seasons]);

  // Reset auto-next overlay whenever the active episode changes.
  useEffect(() => { setShowAutoNext(false); }, [activeEpisodeId]);

  const activeEpisode = useMemo(
    () => episodes.find((e) => e.id === activeEpisodeId) ?? null,
    [episodes, activeEpisodeId]
  );

  // Build server list (Server 1, Server 2, …) from stream_sources on the
  // active row (episode for series, item for movie/tv). Falls back to the
  // legacy single stream_url so old records keep working.
  const servers = useMemo(() => {
    const raw = kind === "series" ? activeEpisode?.stream_sources : item?.stream_sources;
    const list: { provider: string; url: string }[] = Array.isArray(raw)
      ? raw.filter((s: any) => s && typeof s.url === "string" && s.url.trim())
      : [];
    if (list.length > 0) return list;
    const fallback =
      kind === "series" ? activeEpisode?.stream_url : item?.stream_url || item?.m3u_url;
    return fallback ? [{ provider: item?.provider || "default", url: fallback }] : [];
  }, [kind, item, activeEpisode]);

  // Reset server selection whenever the active piece of content changes.
  useEffect(() => { setServerIdx(0); }, [id, activeEpisodeId]);

  // Alert monitoring when playable content has no usable source.
  // For series, wait until an episode is actually resolved — seasons/episodes
  // load in later async round trips, and reporting before that is a false positive.
  useEffect(() => {
    if (!item || servers.length > 0) return;
    if (kind === "series" && !activeEpisode) return;
    reportPlayerError("No stream source configured for content", {
      kind, id, episode_id: activeEpisodeId,
    });
  }, [item, servers, kind, id, activeEpisodeId, activeEpisode]);


  const nextEpisode = useMemo(() => {
    if (kind !== "series" || !activeEpisode || allEpisodes.length === 0) return null;
    const seasonNumberById: Record<string, number> = {};
    seasons.forEach((s) => { seasonNumberById[s.id] = s.season_number; });
    const sorted = [...allEpisodes].sort((a, b) => {
      const sa = seasonNumberById[a.season_id] ?? 0;
      const sb = seasonNumberById[b.season_id] ?? 0;
      if (sa !== sb) return sa - sb;
      return (a.episode_number ?? 0) - (b.episode_number ?? 0);
    });
    const idx = sorted.findIndex((e) => e.id === activeEpisode.id);
    return idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;
  }, [kind, activeEpisode, allEpisodes, seasons]);

  const playNext = () => {
    if (!nextEpisode) return;
    setShowAutoNext(false);
    if (nextEpisode.season_id !== activeSeasonId) {
      setActiveSeasonId(nextEpisode.season_id);
      setTimeout(() => setActiveEpisodeId(nextEpisode.id), 0);
    } else {
      setActiveEpisodeId(nextEpisode.id);
    }
  };

  // Log a watch-history session (once per player load per content)
  useEffect(() => {
    if (!item || !id || !kind) return;
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid || cancelled) return;
      await supabase.from("watch_history" as any).insert({
        user_id: uid,
        content_kind: kind,
        content_id: id,
        content_title: item.title || item.name || `${item.home_team ?? ""} vs ${item.away_team ?? ""}`.trim(),
        genre: (item as any).genre ?? null,
      });
    })();
    return () => { cancelled = true; };
  }, [id, kind, item]);

  if (!item) {
    return <div className="pt-24 px-6 text-muted-foreground">Loading…</div>;
  }

  const title = item.title || item.name || `${item.home_team} vs ${item.away_team}`;
  const isMovie = kind === "movie";
  const isSeries = kind === "series";
  const src = servers[Math.min(serverIdx, Math.max(0, servers.length - 1))]?.url ?? null;
  const useIframePlayer = !isMovie && !isSeries && item.source_type === "iframe";
  const isTv = kind === "tv";
  const activeSubs = (kind === "series" ? activeEpisode?.subtitles : item?.subtitles) ?? [];
  const introStart = (kind === "series" ? activeEpisode?.intro_start_seconds : (item as any)?.intro_start_seconds) ?? null;
  const introEnd = (kind === "series" ? activeEpisode?.intro_end_seconds : (item as any)?.intro_end_seconds) ?? null;
  const reactionChannel = kind === "tv"
    ? `tv:${id}`
    : isSeries && activeEpisode
    ? `episode:${activeEpisode.id}`
    : `${kind}:${id}`;

  if (isTv) {
    return (
      <div className="pt-20 px-4 md:px-6 max-w-[1600px] mx-auto pb-16">
        <Link to=".." className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Live TV
        </Link>
        <div className="flex items-center gap-3 mb-4">
          {item.logo_url && <img src={item.logo_url} alt="" className="h-10 w-10 object-contain rounded bg-secondary/40" />}
          <div>
            <h1 className="font-display text-xl md:text-3xl tracking-wider">{title}</h1>
            <div className="text-xs text-muted-foreground flex gap-2">
              <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 font-semibold">● LIVE</span>
              {item.country && <span>{item.country}</span>}
              {item.category && <span>· {item.category}</span>}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
          <div className="min-w-0">
            {src ? (
              <div className="relative">
                <AdPlayerShell>
                  {useIframePlayer || isEmbedUrl(src) ? (
                    <EmbedPlayer src={src} title={title} />
                  ) : (
                    <HlsPlayer src={src} poster={item.logo_url} subtitles={activeSubs} reactionChannelKey={reactionChannel} />
                  )}
                </AdPlayerShell>
                <FloatingReactions channelKey={`tv:${id}`} />
              </div>
            ) : (
              <div className="aspect-video glass rounded-2xl grid place-items-center text-muted-foreground">
                No stream URL configured.
              </div>
            )}
            <UnderPlayerBanner />
            {item.description && <p className="mt-4 text-sm text-muted-foreground">{item.description}</p>}
            <div className="mt-4 flex flex-wrap gap-3">
              {src && (
                <WatchTogetherButton
                  input={{
                    title: `${title} — Live Watch Party`,
                    content_kind: "movie",
                    content_id: id!,
                    content_title: `📺 ${title}`,
                    poster_url: item.logo_url || null,
                    stream_url: src,
                    visibility: "public",
                  }}
                  label="Create Watch Room"
                />
              )}
              <PlaybackReportButton contentKind="tv" contentId={id!} contentTitle={title} />
            </div>
          </div>
          <aside className="lg:h-[calc(100vh-180px)] lg:sticky lg:top-24">
            <TvChannelChat channelId={id!} />
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-20 px-4 md:px-8 max-w-6xl mx-auto pb-16">
      <Link to=".." className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-4">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="font-display text-2xl md:text-4xl tracking-wider mb-2">{title}</h1>
      {(isMovie || isSeries) && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-4">
          {item.imdb_rating != null && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-yellow-500/15 text-yellow-400 text-xs font-semibold">
              <Star className="h-3 w-3 fill-yellow-400" />
              IMDb {Number(item.imdb_rating).toFixed(1)}
            </span>
          )}
          {item.year && <span>{item.year}</span>}
          {item.duration_minutes && <span>· {item.duration_minutes} min</span>}
          {item.category && <span>· {item.category}</span>}
          {item.genre && <span>· {item.genre}</span>}
        </div>
      )}
      {isSeries && seasons.length > 0 && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-2 mb-3">
            {seasons.map((s) => (
              <Button
                key={s.id}
                type="button"
                variant={activeSeasonId === s.id ? "default" : "outline"}
                onClick={() => setActiveSeasonId(s.id)}
                className={activeSeasonId === s.id ? "bg-gradient-red shadow-neon" : "glass"}
              >
                {s.title || `Season ${s.season_number}`}
              </Button>
            ))}
          </div>
          {episodes.length === 0 ? (
            <div className="text-sm text-muted-foreground">No episodes in this season yet.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-4">
              {episodes.map((ep) => (
                <button
                  key={ep.id}
                  type="button"
                  onClick={() => setActiveEpisodeId(ep.id)}
                  className={`text-left p-3 rounded-xl border transition ${
                    activeEpisodeId === ep.id
                      ? "bg-primary/15 border-primary shadow-neon"
                      : "glass border-border/40 hover:border-primary/60"
                  }`}
                >
                  <div className="text-xs text-muted-foreground">EP {ep.episode_number}</div>
                  <div className="text-sm font-medium truncate">{ep.title}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {servers.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground self-center mr-1">Servers:</span>
          {servers.map((s, i) => (
            <Button
              key={`${s.provider}-${i}`}
              type="button"
              size="sm"
              variant={i === serverIdx ? "default" : "outline"}
              onClick={() => setServerIdx(i)}
              className={i === serverIdx ? "bg-gradient-red shadow-neon" : "glass"}
              title={s.url}
            >
              Server {i + 1}
              <span className="ml-2 text-[10px] uppercase opacity-70">{s.provider}</span>
            </Button>
          ))}
        </div>
      )}
      {src ? (
        <div className="relative">
        <AdPlayerShell>
          {isMovie || isSeries ? (
            isEmbedUrl(src) ? (
              <EmbedPlayer src={src} title={title} poster={item.backdrop_url || item.poster_url} />
            ) : (
              <div className="relative">
                <BunnyVideoPlayer
                  src={src}
                  poster={item.backdrop_url || item.poster_url}
                  title={title}
                  onEnded={isSeries && nextEpisode ? () => setShowAutoNext(true) : undefined}
                  subtitles={activeSubs}
                  introStart={introStart}
                  introEnd={introEnd}
                  reactionChannelKey={reactionChannel}
                />
                {isSeries && showAutoNext && nextEpisode && (
                  <AutoNextOverlay
                    nextTitle={`EP ${nextEpisode.episode_number} · ${nextEpisode.title ?? ""}`}
                    onPlayNext={playNext}
                    onCancel={() => setShowAutoNext(false)}
                  />
                )}
              </div>
            )
          ) : useIframePlayer ? (
            <EmbedPlayer src={src} title={title} />
          ) : (
            <HlsPlayer src={src} poster={item.backdrop_url || item.poster_url} subtitles={activeSubs} introStart={introStart} introEnd={introEnd} reactionChannelKey={reactionChannel} />
          )}
        </AdPlayerShell>
        <FloatingReactions channelKey={reactionChannel} />
        </div>
      ) : (
        <div className="aspect-video glass rounded-2xl grid place-items-center text-muted-foreground">
          No stream URL configured.
        </div>
      )}
      <UnderPlayerBanner />
      <div className="mt-6 flex flex-wrap gap-3">
        {(isMovie || (isSeries && activeEpisode)) && src && (
          <WatchTogetherButton
            input={{
              title: isMovie
                ? `${title} — Watch Party`
                : `${title} S${seasons.find((s) => s.id === activeSeasonId)?.season_number ?? ""}E${activeEpisode?.episode_number ?? ""} — Watch Party`,
              content_kind: isMovie ? "movie" : "episode",
              content_id: isMovie ? id! : activeEpisode!.id,
              content_title: isMovie ? title : `${title} · ${activeEpisode!.title}`,
              poster_url: item.poster_url || item.backdrop_url || null,
              stream_url: src,
              visibility: "public",
            }}
          />
        )}
        {isMovie && id && <WatchlistButton movieId={id} />}
        {isMovie && id && (
          <ReportMovieButton
            movieId={id}
            isAdminUpload={!!item.is_admin_upload}
            uploaderId={item.created_by}
          />
        )}
        {id && (
          <PlaybackReportButton
            contentKind={isMovie ? "movie" : isSeries ? "episode" : (kind as any) === "match" ? "match" : "tv"}
            contentId={isSeries ? (activeEpisode?.id ?? id) : id}
            contentTitle={
              isSeries && activeEpisode
                ? `${title} · ${activeEpisode.title}`
                : title
            }
          />
        )}
      </div>
      {item.description && <p className="mt-6 text-muted-foreground max-w-2xl">{item.description}</p>}
      {isMovie && id && <MovieComments movieId={id} />}
    </div>
  );
}