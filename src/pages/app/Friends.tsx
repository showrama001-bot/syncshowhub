import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserPlus, Check, X, Search, Trash2 } from "lucide-react";
import {
  listFriendships, searchUsers, sendFriendRequest, respondFriendRequest, removeFriendship,
  type FriendRow,
} from "@/lib/friends";
import { toast } from "sonner";

export default function Friends() {
  const { user } = useAuth();
  const [rows, setRows] = useState<FriendRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);

  const refresh = async () => {
    if (!user) return;
    const data = await listFriendships(user.id);
    setRows(data);
    const otherIds = Array.from(new Set(data.map(r => r.requester_id === user.id ? r.addressee_id : r.requester_id)));
    if (otherIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", otherIds);
      const map: Record<string, any> = {};
      (profs || []).forEach(p => { map[p.id] = p; });
      setProfiles(map);
    }
  };

  useEffect(() => { refresh(); }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("friendships-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  useEffect(() => {
    if (!q.trim() || !user) { setResults([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      const r = await searchUsers(q, user.id);
      if (!cancelled) setResults(r);
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, user?.id]);

  const friends = useMemo(() => rows.filter(r => r.status === "accepted"), [rows]);
  const incoming = useMemo(() => rows.filter(r => r.status === "pending" && r.addressee_id === user?.id), [rows, user?.id]);
  const outgoing = useMemo(() => rows.filter(r => r.status === "pending" && r.requester_id === user?.id), [rows, user?.id]);

  const Row = ({ row }: { row: FriendRow }) => {
    const otherId = row.requester_id === user!.id ? row.addressee_id : row.requester_id;
    const p = profiles[otherId] || {};
    return (
      <div className="flex items-center gap-3 glass rounded-2xl p-3">
        <Avatar><AvatarImage src={p.avatar_url} /><AvatarFallback>{(p.display_name || p.username || "?").slice(0,1).toUpperCase()}</AvatarFallback></Avatar>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{p.display_name || p.username || "Unknown"}</div>
          <div className="text-xs text-muted-foreground truncate">@{p.username}</div>
        </div>
        {row.status === "accepted" && (
          <Button size="icon" variant="ghost" onClick={() => removeFriendship(row.id).then(refresh)}><Trash2 className="h-4 w-4" /></Button>
        )}
        {row.status === "pending" && row.addressee_id === user?.id && (
          <div className="flex gap-1">
            <Button size="icon" className="bg-gradient-red" onClick={() => respondFriendRequest(row.id, true).then(refresh)}><Check className="h-4 w-4" /></Button>
            <Button size="icon" variant="outline" onClick={() => respondFriendRequest(row.id, false).then(refresh)}><X className="h-4 w-4" /></Button>
          </div>
        )}
        {row.status === "pending" && row.requester_id === user?.id && (
          <span className="text-xs text-muted-foreground">Pending…</span>
        )}
      </div>
    );
  };

  return (
    <div className="pt-20 px-4 sm:px-6 max-w-3xl mx-auto pb-16">
      <h1 className="font-display text-3xl md:text-5xl tracking-wider neon-text mb-6">Friends</h1>
      <Tabs defaultValue="friends">
        <TabsList className="grid grid-cols-4 w-full bg-secondary/50">
          <TabsTrigger value="friends">Friends</TabsTrigger>
          <TabsTrigger value="requests">Requests{incoming.length ? ` (${incoming.length})` : ""}</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
          <TabsTrigger value="search">Find</TabsTrigger>
        </TabsList>
        <TabsContent value="friends" className="space-y-2 mt-4">
          {friends.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No friends yet.</p>}
          {friends.map(r => <Row key={r.id} row={r} />)}
        </TabsContent>
        <TabsContent value="requests" className="space-y-2 mt-4">
          {incoming.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No incoming requests.</p>}
          {incoming.map(r => <Row key={r.id} row={r} />)}
        </TabsContent>
        <TabsContent value="sent" className="space-y-2 mt-4">
          {outgoing.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No outgoing requests.</p>}
          {outgoing.map(r => <Row key={r.id} row={r} />)}
        </TabsContent>
        <TabsContent value="search" className="space-y-2 mt-4">
          <div className="flex gap-2 items-center glass rounded-2xl px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users by name…" className="bg-transparent border-0 focus-visible:ring-0" />
          </div>
          {results.map((p) => (
            <div key={p.id} className="flex items-center gap-3 glass rounded-2xl p-3">
              <Avatar><AvatarImage src={p.avatar_url} /><AvatarFallback>{(p.display_name || p.username || "?").slice(0,1).toUpperCase()}</AvatarFallback></Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{p.display_name || p.username}</div>
                <div className="text-xs text-muted-foreground truncate">@{p.username}</div>
              </div>
              <Button size="sm" className="bg-gradient-red" onClick={async () => {
                const { error } = await sendFriendRequest(user!.id, p.id);
                if (error) toast.error(error); else { toast.success("Request sent"); refresh(); }
              }}>
                <UserPlus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}