import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Users, Send } from "lucide-react";
import { listFriendships, inviteToRoom } from "@/lib/friends";
import { toast } from "sonner";

/** Compact friends panel that lets a host invite friends into a watch room. */
export function FriendsSidebar({ roomId }: { roomId: string }) {
  const { user } = useAuth();
  const [friends, setFriends] = useState<{ id: string; profile: any }[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const rows = await listFriendships(user.id);
      const accepted = rows.filter(r => r.status === "accepted");
      const otherIds = accepted.map(r => r.requester_id === user.id ? r.addressee_id : r.requester_id);
      if (!otherIds.length) { setFriends([]); return; }
      const { data } = await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", otherIds);
      setFriends((data || []).map(p => ({ id: p.id, profile: p })));
    })();
  }, [user?.id]);

  const invite = async (friendId: string) => {
    if (!user) return;
    const { error } = await inviteToRoom(roomId, user.id, friendId);
    if (error) toast.error(error); else toast.success("Invite sent");
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline"><Users className="h-4 w-4 mr-1" /> Friends</Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[300px] sm:w-[360px] bg-background/95 backdrop-blur-xl">
        <SheetHeader><SheetTitle>Invite friends</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-2 overflow-y-auto max-h-[calc(100vh-100px)]">
          {friends.length === 0 && <p className="text-sm text-muted-foreground">No friends yet. Add some from the Friends page.</p>}
          {friends.map(f => (
            <div key={f.id} className="flex items-center gap-3 glass rounded-xl p-2">
              <Avatar className="h-9 w-9"><AvatarImage src={f.profile.avatar_url} /><AvatarFallback>{(f.profile.display_name || f.profile.username || "?").slice(0,1).toUpperCase()}</AvatarFallback></Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{f.profile.display_name || f.profile.username}</div>
              </div>
              <Button size="sm" className="bg-gradient-red" onClick={() => invite(f.id)}><Send className="h-3 w-3 mr-1" /> Invite</Button>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}