import { useEffect, useRef } from "react";
import Hls from "hls.js";
import { useSubtitleTracks, SubtitleTrack } from "@/lib/subtitles";
import { CcMenu } from "./CcMenu";
import { PopoutButton } from "@/components/miniplayer/MiniPlayerProvider";
import { SkipIntroButton } from "@/components/player/SkipIntroButton";
import { ReactionHeatmap } from "@/components/player/ReactionHeatmap";

export const HlsPlayer = ({
  src, poster, subtitles, introStart, introEnd, reactionChannelKey,
}: {
  src: string; poster?: string; subtitles?: SubtitleTrack[];
  introStart?: number | null; introEnd?: number | null; reactionChannelKey?: string;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const tracks = useSubtitleTracks(subtitles);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    let hls: Hls | null = null;
    const isHls = /\.m3u8($|\?)/i.test(src);
    if (isHls && Hls.isSupported()) {
      hls = new Hls({ enableWorker: true });
      hls.loadSource(src);
      hls.attachMedia(video);
    } else {
      video.src = src;
    }
    return () => {
      hls?.destroy();
    };
  }, [src]);

  return (
    <div
      className="group relative w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-card"
      onTouchStart={(e) => {
        const el = e.currentTarget;
        el.classList.add("is-touched");
        window.setTimeout(() => el.classList.remove("is-touched"), 3200);
      }}
    >
      <video
        ref={videoRef}
        controls
        playsInline
        poster={poster}
        controlsList="nodownload noremoteplayback noplaybackrate"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
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
      <CcMenu videoRef={videoRef} tracks={tracks} />
      <SkipIntroButton videoRef={videoRef} introStart={introStart} introEnd={introEnd} />
      {reactionChannelKey && <ReactionHeatmap channelKey={reactionChannelKey} videoRef={videoRef} />}
      <div className="absolute top-2 right-2 z-20">
        <PopoutButton get={() => ({ src, poster, currentTime: videoRef.current?.currentTime ?? 0, href: window.location.pathname })} />
      </div>
    </div>
  );
};