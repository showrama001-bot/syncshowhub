import { useEffect, useState, RefObject } from "react";
import type { ResolvedTrack } from "@/lib/subtitles";
import { useLocalPref } from "@/hooks/useLocalPref";

/**
 * Per-viewer Subtitles / CC menu overlay. Applies the selected language to
 * the given <video>'s textTracks locally — never affects other users.
 */
export function CcMenu({
  videoRef,
  tracks,
}: {
  videoRef: RefObject<HTMLVideoElement>;
  tracks: ResolvedTrack[];
}) {
  const [ccLang, setCcLang] = useLocalPref<string>("cc_lang", "off");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const apply = () => {
      const list = v.textTracks;
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        t.mode = ccLang !== "off" && t.language === ccLang ? "showing" : "disabled";
      }
    };
    apply();
    v.textTracks.addEventListener?.("addtrack", apply);
    return () => v.textTracks.removeEventListener?.("addtrack", apply);
  }, [ccLang, tracks, videoRef]);

  if (!tracks || tracks.length === 0) return null;

  return (
    <div className="absolute bottom-14 right-3 z-30">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="px-2.5 py-1 rounded-full bg-black/75 text-white text-[11px] font-semibold border border-white/10 hover:bg-black/90"
        title="Subtitles / Captions"
      >
        CC{ccLang !== "off" && <span className="ml-1 uppercase text-primary">· {ccLang}</span>}
      </button>
      {open && (
        <div className="absolute bottom-full right-0 mb-2 min-w-[180px] rounded-xl bg-black/90 border border-white/10 text-white text-xs shadow-xl overflow-hidden">
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-white/50 border-b border-white/10">
            Subtitles
          </div>
          <button
            type="button"
            onClick={() => { setCcLang("off"); setOpen(false); }}
            className={`w-full text-left px-3 py-1.5 hover:bg-white/10 ${ccLang === "off" ? "text-primary" : ""}`}
          >
            Off
          </button>
          {tracks.map((t) => (
            <button
              key={t.lang}
              type="button"
              onClick={() => { setCcLang(t.lang); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 hover:bg-white/10 ${ccLang === t.lang ? "text-primary" : ""}`}
            >
              <span className="uppercase text-[10px] opacity-70 mr-2">{t.lang}</span>{t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}