import { useAds } from "./AdsProvider";
import { ScriptSlot } from "./ScriptSlot";

export const HeaderBanner = () => {
  const { enabled, pick } = useAds();
  if (!enabled) return null;
  const ad = pick("banner_header");
  if (!ad) return null;
  if (ad.ad_mode === "script" && ad.script_code) {
    return (
      <div className="px-4 md:px-8 pt-16 pb-2 max-w-7xl mx-auto">
        <ScriptSlot html={ad.script_code} className="w-full flex justify-center" />
      </div>
    );
  }
  if (!ad.media_url) return null;
  const inner = (
    <img
      src={ad.media_url}
      alt={ad.title ?? "Sponsor"}
      className="w-full max-h-24 object-cover rounded-xl border border-border/40"
    />
  );
  return (
    <div className="px-4 md:px-8 pt-16 pb-2 max-w-7xl mx-auto">
      {ad.redirect_url ? (
        <a href={`/redirect?to=${encodeURIComponent(ad.redirect_url)}`} target="_blank" rel="noopener noreferrer" className="block">
          {inner}
        </a>
      ) : (
        inner
      )}
    </div>
  );
};