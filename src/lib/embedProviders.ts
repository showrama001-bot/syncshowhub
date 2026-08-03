/**
 * Stable multi-provider embed sources.
 * Some providers serve short preview/trailer reels for certain titles, so we
 * always offer several so the user can switch to a full-length stream.
 */
export type EmbedSource = { provider: string; label: string; url: string; type: "embed" };

export function movieEmbedSources(tmdbId: number | string): EmbedSource[] {
  const id = String(tmdbId);
  return [
    { provider: "vidsrc.cc", label: "Server 1", url: `https://vidsrc.cc/v2/embed/movie/${id}`, type: "embed" },
    { provider: "embed.su", label: "Server 2", url: `https://embed.su/embed/movie/${id}`, type: "embed" },
    { provider: "vidsrc.xyz", label: "Server 3", url: `https://vidsrc.xyz/embed/movie?tmdb=${id}`, type: "embed" },
  ];
}

export function episodeEmbedSources(tmdbId: number | string, season: number, episode: number): EmbedSource[] {
  const id = String(tmdbId);
  const s = season || 1;
  const e = episode || 1;
  return [
    { provider: "vidsrc.cc", label: "Server 1", url: `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}`, type: "embed" },
    { provider: "embed.su", label: "Server 2", url: `https://embed.su/embed/tv/${id}/${s}/${e}`, type: "embed" },
    { provider: "vidsrc.xyz", label: "Server 3", url: `https://vidsrc.xyz/embed/tv?tmdb=${id}&season=${s}&episode=${e}`, type: "embed" },
  ];
}
