import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Issue = "not_loading" | "broken_link" | "wrong_subtitles" | "audio_sync" | "other";
type Kind = "movie" | "episode" | "tv" | "match";

const ISSUES: { id: Issue; label: string }[] = [
  { id: "not_loading", label: "Video Not Loading" },
  { id: "broken_link", label: "Broken Link" },
  { id: "wrong_subtitles", label: "Wrong Subtitles" },
  { id: "audio_sync", label: "Audio Sync Issue" },
  { id: "other", label: "Other" },
];

export function PlaybackReportButton({
  contentKind,
  contentId,
  contentTitle,
}: {
  contentKind: Kind;
  contentId: string;
  contentTitle?: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [issue, setIssue] = useState<Issue>("not_loading");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const submit = async () => {
    setBusy(true);
    const { error } = await supabase.from("playback_reports" as any).insert({
      reporter_id: user.id,
      content_kind: contentKind,
      content_id: contentId,
      content_title: contentTitle ?? null,
      issue,
      note: note.trim() || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Report sent — thanks for letting us know.");
    setOpen(false);
    setNote("");
    setIssue("not_loading");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-500" /> Report Issue
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" /> Report a playback issue
          </DialogTitle>
        </DialogHeader>
        <RadioGroup value={issue} onValueChange={(v) => setIssue(v as Issue)} className="space-y-2">
          {ISSUES.map((i) => (
            <div key={i.id} className="flex items-center gap-2 rounded-lg border border-border/40 px-3 py-2 hover:border-primary/40 transition">
              <RadioGroupItem id={`pi-${i.id}`} value={i.id} />
              <Label htmlFor={`pi-${i.id}`} className="cursor-pointer flex-1">{i.label}</Label>
            </div>
          ))}
        </RadioGroup>
        <Textarea
          placeholder="Add details (optional)…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Send report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}