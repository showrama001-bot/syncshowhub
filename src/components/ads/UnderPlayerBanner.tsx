import { useAds } from "./AdsProvider";
import { ScriptSlot } from "./ScriptSlot";

export const UnderPlayerBanner = () => {
  const { enabled, pick } = useAds();
  if (!enabled) return null;
  const ad = pick("banner_under_player");
  if (!ad) return null;
  if (ad.ad_mode === "script" && ad.script_code) {
    return (
      <div className="mt-4">
        <ScriptSlot html={ad.script_code} className="w-full flex justify-center" />
      </div>
    );
  }
  if (!ad.media_url) return null;
  const inner = (
    <img
      src={ad.media_url}
      alt={ad.title ?? "Sponsor"}
      className="w-full max-h-32 object-cover rounded-xl border border-border/40"
    />
  );
  return (
    <div className="mt-4">
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