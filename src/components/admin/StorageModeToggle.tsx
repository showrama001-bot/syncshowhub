import { useStorageMode } from "@/hooks/useStorageMode";
import { Switch } from "@/components/ui/switch";
import { Cloud, Send } from "lucide-react";
import { toast } from "sonner";

export default function StorageModeToggle() {
  const { mode, setMode, loading } = useStorageMode();
  const isBunny = mode === "bunny";

  const toggle = async (checked: boolean) => {
    const next = checked ? "bunny" : "telegram";
    try {
      await setMode(next);
      toast.success(
        next === "telegram"
          ? "Storage switched to Telegram Free Stream"
          : "Storage switched to Bunny.net Premium CDN"
      );
    } catch (e: any) {
      toast.error(e?.message || "Failed to switch storage mode");
    }
  };

  return (
    <div className="glass rounded-2xl p-4 md:p-5 mb-6 border border-border/40 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-xl grid place-items-center ${isBunny ? "bg-orange-500/15 text-orange-400" : "bg-sky-500/15 text-sky-400"}`}>
          {isBunny ? <Cloud className="h-5 w-5" /> : <Send className="h-5 w-5" />}
        </div>
        <div>
          <div className="text-sm font-medium">
            Active storage: {isBunny ? "Bunny.net Premium CDN" : "Telegram Free Stream"}
          </div>
          <div className="text-xs text-muted-foreground">
            Routes every new upload and player stream through the selected provider.
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-xs ${!isBunny ? "text-sky-400 font-semibold" : "text-muted-foreground"}`}>Telegram</span>
        <Switch checked={isBunny} disabled={loading} onCheckedChange={toggle} aria-label="Toggle storage provider" />
        <span className={`text-xs ${isBunny ? "text-orange-400 font-semibold" : "text-muted-foreground"}`}>Bunny</span>
      </div>
    </div>
  );
}