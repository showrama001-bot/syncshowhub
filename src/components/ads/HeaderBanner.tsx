import { useAds } from "./AdsProvider";
import { ScriptSlot } from "./ScriptSlot";

export const HeaderBanner = () => {
  const { enabled, config } = useAds();
  if (!enabled || !config.network_enabled || !config.header_banner_script?.trim()) return null;
  return (
    <div className="px-4 md:px-8 pt-16 pb-2 max-w-7xl mx-auto">
      <ScriptSlot html={config.header_banner_script} className="w-full flex justify-center" />
    </div>
  );
};
