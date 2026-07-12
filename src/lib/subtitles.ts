import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SubtitleTrack = {
  lang: string;   // BCP-47 code, e.g. "en", "ar", "fr"
  label: string;  // Human label, e.g. "English", "العربية"
  path: string;   // Storage path in the "subtitles" bucket
};

export const SUBTITLE_LANGUAGES: { code: string; label: string }[] = [
  { code: "ar", label: "العربية (Arabic)" },
  { code: "de", label: "Deutsch (German)" },
  { code: "en", label: "English" },
  { code: "es", label: "Español (Spanish)" },
  { code: "fr", label: "Français (French)" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "it", label: "Italiano (Italian)" },
  { code: "ja", label: "日本語 (Japanese)" },
  { code: "ko", label: "한국어 (Korean)" },
  { code: "nl", label: "Nederlands (Dutch)" },
  { code: "pl", label: "Polski (Polish)" },
  { code: "pt", label: "Português (Portuguese)" },
  { code: "ru", label: "Русский (Russian)" },
  { code: "sv", label: "Svenska (Swedish)" },
  { code: "tr", label: "Türkçe (Turkish)" },
  { code: "uk", label: "Українська (Ukrainian)" },
  { code: "zh", label: "中文 (Chinese)" },
];

/** Convert SubRip (.srt) content to WebVTT (.vtt). */
export function srtToVtt(srt: string): string {
  const cleaned = srt
    .replace(/\r+/g, "")
    .replace(/^\ufeff/, "")
    // "00:00:01,200 --> 00:00:03,400" → "00:00:01.200 --> 00:00:03.400"
    .replace(/(\d\d:\d\d:\d\d),(\d{3})/g, "$1.$2");
  return "WEBVTT\n\n" + cleaned.trim() + "\n";
}

/** Fetch a subtitle file via Supabase Storage and return a blob URL of a VTT payload. */
export async function resolveSubtitleBlobUrl(path: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage.from("subtitles").download(path);
    if (error || !data) return null;
    const text = await data.text();
    const isSrt = /\.srt(\?|$)/i.test(path) || !/^WEBVTT/m.test(text);
    const vtt = isSrt ? srtToVtt(text) : text;
    return URL.createObjectURL(new Blob([vtt], { type: "text/vtt" }));
  } catch {
    return null;
  }
}

export type ResolvedTrack = { lang: string; label: string; url: string };

/**
 * Load a list of subtitle tracks into ready-to-use blob URLs. Blob URLs
 * are same-origin so no CORS setup is required on the underlying video CDN.
 */
export function useSubtitleTracks(subtitles: SubtitleTrack[] | null | undefined): ResolvedTrack[] {
  const [tracks, setTracks] = useState<ResolvedTrack[]>([]);
  useEffect(() => {
    if (!subtitles || subtitles.length === 0) { setTracks([]); return; }
    let cancelled = false;
    const created: string[] = [];
    (async () => {
      const resolved: ResolvedTrack[] = [];
      for (const s of subtitles) {
        const url = await resolveSubtitleBlobUrl(s.path);
        if (cancelled) return;
        if (url) {
          created.push(url);
          resolved.push({ lang: s.lang, label: s.label, url });
        }
      }
      if (!cancelled) setTracks(resolved);
    })();
    return () => {
      cancelled = true;
      created.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(subtitles ?? [])]);
  return tracks;
}