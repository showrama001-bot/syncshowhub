import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Flag, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Props = {
  movieId: string;
  isAdminUpload?: boolean;
  uploaderId?: string | null;
};

export function ReportMovieButton({ movieId, isAdminUpload, uploaderId }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<"inappropriate" | "wrong_video">("inappropriate");
  const [busy, setBusy] = useState(false);

  if (isAdminUpload) return null;
  if (!user) return null;
  if (uploaderId && uploaderId === user.id) return null;

  const submit = async () => {
    setBusy(true);
    const { error } = await supabase.from("movie_reports").insert({
      movie_id: movieId,
      reporter_id: user.id,
      reason,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Report submitted. Thank you.");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Flag className="h-4 w-4" /> Report
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report this movie</DialogTitle>
        </DialogHeader>
        <RadioGroup value={reason} onValueChange={(v) => setReason(v as any)} className="space-y-2">
          <div className="flex items-center gap-2">
            <RadioGroupItem id="r-inapp" value="inappropriate" />
            <Label htmlFor="r-inapp">Inappropriate Content / Spam</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem id="r-wrong" value="wrong_video" />
            <Label htmlFor="r-wrong">Wrong Video</Label>
          </div>
        </RadioGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}