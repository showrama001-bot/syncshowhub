import { useAds } from "./AdsProvider";
import { ScriptSlot } from "./ScriptSlot";

export const GridBanner = () => {
  const { enabled, settings, pick } = useAds();
  if (!enabled || !settings.section_banner_enabled) return null;
  const ad = pick("banner_grid");
  if (!ad) return null;
  if (ad.ad_mode === "script" && ad.script_code) {
    return (
      <div className="relative rounded-xl overflow-hidden border border-primary/40 shadow-neon h-full min-h-[240px] bg-black flex items-center justify-center">
        <ScriptSlot html={ad.script_code} className="w-full h-full flex items-center justify-center" />
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/70 text-[10px] uppercase tracking-widest text-yellow-300 border border-yellow-400/50">Ad</div>
      </div>
    );
  }
  if (!ad.media_url) return null;
  const inner = (
    <div className="relative rounded-xl overflow-hidden border border-primary/40 shadow-neon h-full min-h-[240px] bg-black">
      <img src={ad.media_url} alt={ad.title ?? "Sponsored"} className="w-full h-full object-cover" />
      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/70 text-[10px] uppercase tracking-widest text-yellow-300 border border-yellow-400/50">
        Ad
      </div>
    </div>
  );
  return ad.redirect_url ? (
    <a href={`/redirect?to=${encodeURIComponent(ad.redirect_url)}`} target="_blank" rel="noopener noreferrer" className="block h-full">
      {inner}
    </a>
  ) : (
    inner
  );
};