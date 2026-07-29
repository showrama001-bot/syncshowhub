import { useAds } from "./AdsProvider";
import { ScriptSlot } from "./ScriptSlot";

export const UnderPlayerBanner = () => {
  const { enabled, config } = useAds();
  if (!enabled || !config.network_enabled || !config.under_player_script?.trim()) return null;
  return (
    <div className="mt-4">
      <ScriptSlot html={config.under_player_script} className="w-full flex justify-center" />
    </div>
  );
};
