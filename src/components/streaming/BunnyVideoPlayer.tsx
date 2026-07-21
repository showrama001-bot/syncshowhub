import { useEffect, useRef } from "react";
import { useSubtitleTracks, SubtitleTrack } from "@/lib/subtitles";
import { CcMenu } from "./CcMenu";
import { PopoutButton } from "@/components/miniplayer/MiniPlayerProvider";
import { SkipIntroButton } from "@/components/player/SkipIntroButton";
import { ReactionHeatmap } from "@/components/player/ReactionHeatmap";

interface Props {
  src: string;
  poster?: string;
  title?: string;
  onEnded?: () => void;
  subtitles?: SubtitleTrack[];
  introStart?: number | null;
  introEnd?: number | null;
  reactionChannelKey?: string;
}

export const BunnyVideoPlayer = ({ src, poster, title: _title, onEnded, subtitles, introStart, introEnd, reactionChannelKey }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const tracks = useSubtitleTracks(subtitles);
  // Reset on src change (autoplay-safe, best-effort).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    try { v.load(); } catch {}
  }, [src]);

  return (
    <div
      className="group relative w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-card player-shell"
      onTouchStart={(e) => {
        const el = e.currentTarget;
        el.classList.add("is-touched");
        window.setTimeout(() => el.classList.remove("is-touched"), 3200);
      }}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        controls
        playsInline
        controlsList="nodownload noremoteplayback noplaybackrate"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
        onEnded={onEnded}
        className="w-full h-full bg-black"
      >
        {tracks.map((t) => (
          <track
            key={`${t.lang}-${t.url}`}
            kind="subtitles"
            src={t.url}
            srcLang={t.lang}
            label={t.label}
          />
        ))}
      </video>
      {/* Transparent overlay strip over the bottom-right of the controls bar
          to deter the kebab "Save video as" menu without blocking play/seek. */}
      <div
        aria-hidden="true"
        className="absolute bottom-0 right-0 h-12 w-14 z-10 pointer-events-auto"
        onContextMenu={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
      />
      <CcMenu videoRef={videoRef} tracks={tracks} />
      <SkipIntroButton videoRef={videoRef} introStart={introStart} introEnd={introEnd} />
      {reactionChannelKey && <ReactionHeatmap channelKey={reactionChannelKey} videoRef={videoRef} />}
      <div className="absolute top-2 right-2 z-20">
        <PopoutButton get={() => ({ src, poster, title: _title, currentTime: videoRef.current?.currentTime ?? 0, href: window.location.pathname })} />
      </div>
    </div>
  );
};