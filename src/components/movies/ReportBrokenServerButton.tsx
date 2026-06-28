import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type ServerId = "voe" | "streamtape" | "doodstream";

type Props = {
  movieId: string;
  availableServers: { id: ServerId; label: string }[];
};

export function ReportBrokenServerButton({ movieId, availableServers }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [server, setServer] = useState<ServerId>(availableServers[0]?.id ?? "voe");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user || availableServers.length === 0) return null;

  const submit = async () => {
    setBusy(true);
    const { error } = await supabase.from("server_reports").insert({
      movie_id: movieId,
      reporter_id: user.id,
      server,
      note: note.trim() || null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Thanks — admins have been notified.");
    setOpen(false);
    setNote("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <AlertTriangle className="h-4 w-4" /> Report Broken Server
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Which server is broken?</DialogTitle>
        </DialogHeader>
        <RadioGroup
          value={server}
          onValueChange={(v) => setServer(v as ServerId)}
          className="space-y-2"
        >
          {availableServers.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <RadioGroupItem id={`srv-${s.id}`} value={s.id} />
              <Label htmlFor={`srv-${s.id}`}>{s.label} not working</Label>
            </div>
          ))}
        </RadioGroup>
        <Textarea
          placeholder="Optional: describe the issue (e.g. black screen, ad loop, 404)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}