import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { UserPlus, Check } from "lucide-react";

type FriendProfile = { id: string; username: string | null; display_name: string | null; avatar_url: string | null };

export function InviteFriendsPanel({ streamId }: { streamId: string }) {
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: fr } = await (supabase.from("friendships" as any) as any)
        .select("requester_id, addressee_id, status")
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .eq("status", "accepted");
      const otherIds = (fr || []).map((r: any) =>
        r.requester_id === user.id ? r.addressee_id : r.requester_id,
      );
      if (otherIds.length === 0) { setFriends([]); return; }
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", otherIds);
      setFriends((profs as any) || []);
    })();
  }, [user?.id]);

  const invite = async (toUser: string) => {
    if (!user) return;
    setBusy(toUser);
    const { error } = await (supabase.from("studio_invites" as any) as any)
      .insert({ stream_id: streamId, from_user: user.id, to_user: toUser });
    setBusy(null);
    if (error) return toast.error(error.message);
    setSent((prev) => new Set(prev).add(toUser));
    toast.success("Invite sent");
  };

  return (
    <div className="glass rounded-2xl p-4 border border-border/40">
      <div className="flex items-center gap-2 mb-3">
        <UserPlus className="h-4 w-4 text-primary" />
        <h3 className="font-display text-sm tracking-widest neon-text">INVITE FRIENDS</h3>
      </div>
      {friends.length === 0 ? (
        <p className="text-xs text-muted-foreground">Add friends first to invite them here.</p>
      ) : (
        <div className="max-h-[280px] overflow-auto space-y-1.5">
          {friends.map((f) => {
            const already = sent.has(f.id);
            return (
              <div key={f.id} className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-secondary/40">
                <div className="h-8 w-8 rounded-full bg-secondary overflow-hidden grid place-items-center text-xs">
                  {f.avatar_url ? <img src={f.avatar_url} alt="" className="w-full h-full object-cover" /> : (f.display_name || f.username || "?").slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{f.display_name || f.username || "Friend"}</div>
                  {f.username && <div className="text-[11px] text-muted-foreground truncate">@{f.username}</div>}
                </div>
                <Button size="sm" variant={already ? "outline" : "default"}
                  className={already ? "" : "bg-gradient-red shadow-neon"}
                  disabled={already || busy === f.id}
                  onClick={() => invite(f.id)}>
                  {already ? <><Check className="h-3.5 w-3.5 mr-1" /> Sent</> : "Invite"}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}