interface EmbedPlayerProps {
  src: string;
  title?: string;
  poster?: string;
}

export function isEmbedUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const normalized = url.trim();
  // Direct video / stream links always play natively in the HTML5 player.
  const directVideo = /\.(m3u8|mpd|mp4|webm|ogg|ogv|mov|mkv|ts)($|\?)/i;
  if (directVideo.test(normalized)) return false;
  // Only page-based players that must run in a document render as an iframe.
  const iframeOnly = /(youtube\.com|youtu\.be|dailymotion\.com|vimeo\.com|\/embed\/|player\.)/i;
  return iframeOnly.test(normalized);
}

function normalizeEmbedSrc(url: string) {
  const trimmed = url.trim();
  if (/^\/\//.test(trimmed)) return `https:${trimmed}`;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export const EmbedPlayer = ({ src, title }: EmbedPlayerProps) => {
  const embedSrc = normalizeEmbedSrc(src);

  // Wrap the provider URL in a srcdoc document. The outer iframe is
  // same-origin (about:srcdoc) so the inner iframe's request to the
  // provider carries NO Referer/Origin from our domain — bypassing
  // hotlink checks while keeping the user fully inside our app.
  const srcDoc = `<!doctype html><html><head><meta name="referrer" content="no-referrer"><style>html,body,iframe{margin:0;padding:0;border:0;width:100%;height:100%;background:#000;overflow:hidden}</style></head><body><iframe src="${embedSrc.replace(/"/g, "&quot;")}" allow="autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write; web-share" allowfullscreen referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-popups allow-presentation"></iframe></body></html>`;

  return (
    <div className="aspect-video w-full overflow-hidden rounded-2xl glass bg-black">
      <iframe
        key={embedSrc}
        srcDoc={srcDoc}
        title={title || "Video player"}
        className="w-full h-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen={true}
        sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation"
      />
    </div>
  );
};
