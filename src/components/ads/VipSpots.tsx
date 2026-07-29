import { useAds } from "./AdsProvider";

/** VIP Hero banner — rendered at the top of the home page. */
export const HeroVipBanner = () => {
  const { enabled, config } = useAds();
  if (!enabled || !config.vip_enabled || !config.hero_banner_url) return null;
  const img = (
    <div className="relative rounded-2xl overflow-hidden border border-primary/40 shadow-neon">
      <img src={config.hero_banner_url} alt="Featured sponsor" className="w-full max-h-56 object-cover" />
      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/70 text-[10px] uppercase tracking-widest text-yellow-300 border border-yellow-400/50">
        VIP
      </div>
    </div>
  );
  return (
    <div className="mb-6">
      {config.hero_banner_link ? (
        <a href={`/redirect?to=${encodeURIComponent(config.hero_banner_link)}`} className="block">
          {img}
        </a>
      ) : (
        img
      )}
    </div>
  );
};

/** Room takeover background — full-bleed sponsored backdrop inside watch rooms. */
export const RoomTakeoverBackground = () => {
  const { enabled, config } = useAds();
  if (!enabled || !config.vip_enabled || !config.room_takeover_url) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center opacity-30"
      style={{ backgroundImage: `url(${config.room_takeover_url})` }}
    />
  );
};
