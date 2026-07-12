import { useEffect, useRef } from "react";
import Hls from "hls.js";
import { useSubtitleTracks, SubtitleTrack } from "@/lib/subtitles";
import { CcMenu } from "./CcMenu";

export const HlsPlayer = ({
  src, poster, subtitles,
}: { src: string; poster?: string; subtitles?: SubtitleTrack[] }) => {
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
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-card">
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
    </div>
  );
};