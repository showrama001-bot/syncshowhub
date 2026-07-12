import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Copy, Share2, QrCode } from "lucide-react";
import { toast } from "sonner";

export function RoomInvitePopover({ roomId, title }: { roomId: string; title?: string }) {
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState<string>("");
  const link = `${window.location.origin}/watch/${roomId}`;

  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(link, { width: 240, margin: 1, color: { dark: "#ffffff", light: "#00000000" } })
      .then(setDataUrl)
      .catch(() => setDataUrl(""));
  }, [open, link]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); toast.success("Invite link copied"); }
    catch { toast.error("Couldn't copy"); }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: title || "Join my SyncShow room", url: link });
      } catch {}
    } else {
      copy();
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          <Copy className="h-4 w-4 mr-1" /> Invite
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <div className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1">
          <QrCode className="h-3.5 w-3.5" /> Room invite
        </div>
        <div className="rounded-xl bg-black/60 border border-white/10 p-2 grid place-items-center">
          {dataUrl ? (
            <img src={dataUrl} alt="Room QR code" className="w-56 h-56" />
          ) : (
            <div className="w-56 h-56 grid place-items-center text-xs text-muted-foreground">Generating…</div>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground break-all">{link}</div>
        <div className="flex gap-2">
          <Button size="sm" onClick={copy} className="flex-1 bg-gradient-red shadow-neon">
            <Copy className="h-4 w-4 mr-1" /> Copy link
          </Button>
          <Button size="sm" variant="outline" onClick={share}>
            <Share2 className="h-4 w-4 mr-1" /> Share
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
