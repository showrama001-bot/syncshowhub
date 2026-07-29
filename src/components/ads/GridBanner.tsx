import { useAds } from "./AdsProvider";
import { ScriptSlot } from "./ScriptSlot";

export const GridBanner = () => {
  const { enabled, config } = useAds();
  if (!enabled || !config.network_enabled || !config.grid_banner_script?.trim()) return null;
  return (
    <div className="relative rounded-xl overflow-hidden border border-primary/40 shadow-neon h-full min-h-[240px] bg-black flex items-center justify-center">
      <ScriptSlot html={config.grid_banner_script} className="w-full h-full flex items-center justify-center" />
      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/70 text-[10px] uppercase tracking-widest text-yellow-300 border border-yellow-400/50">
        Ad
      </div>
    </div>
  );
};
