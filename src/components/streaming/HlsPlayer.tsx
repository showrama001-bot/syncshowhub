import { useEffect, useRef } from "react";
import Hls from "hls.js";

export const HlsPlayer = ({ src, poster }: { src: string; poster?: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

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
    <video
      ref={videoRef}
      controls
      playsInline
      poster={poster}
      controlsList="nodownload noremoteplayback noplaybackrate"
      disablePictureInPicture
      onContextMenu={(e) => e.preventDefault()}
      className="w-full aspect-video rounded-2xl bg-black shadow-card"
    />
  );
};