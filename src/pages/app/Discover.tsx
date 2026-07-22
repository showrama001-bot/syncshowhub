import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, UserPlus, Users as UsersIcon, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { sendFriendRequest, listFriendships } from "@/lib/friends";

const GENRES = ["Action","Adventure","Animation","Anime","Comedy","Crime","Documentary","Drama","Family","Fantasy","Horror","Music","Mystery","Romance","Sci-Fi","Sports","Thriller","War","Western"];

type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  favorite_genres: string[] | null;
  favorite_movie: string | null;
};

type Room = { id: string; title: string | null };

export default function Discover() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [myGenres, setMyGenres] = useState<string[]>([]);
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [friendsMap, setFriendsMap] = useState<Record<string, "pending" | "accepted">>({});
  const [rooms, setRooms] = useState<Room[]>([]);

  // Load my profile + friendships + my hosted rooms
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: me } = await supabase
        .from("profiles")
        .select("favorite_genres" as any)
        .eq("id", user.id)
        .maybeSingle();
      const mg = ((me as any)?.favorite_genres ?? []) as string[];
      setMyGenres(mg);
      if (mg.length && selectedGenres.length === 0) setSelectedGenres(mg);

      const fs = await listFriendships(user.id);
      const map: Record<string, "pending" | "accepted"> = {};
      fs.forEach((f) => {
        const other = f.requester_id === user.id ? f.addressee_id : f.requester_id;
        if (f.status === "accepted" || f.status === "pending") map[other] = f.status as any;
      });
      setFriendsMap(map);

      const { data: rr } = await (supabase.from("watch_rooms" as any) as any)
        .select("id,title")
        .eq("host_id", user.id)
        .in("status", ["scheduled", "live"])
        .order("created_at", { ascending: false })
        .limit(10);
      setRooms((rr as Room[]) || []);
    })();
  }, [user]);

  const search = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const term = q.trim();
      let query = supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio, favorite_genres, favorite_movie" as any)
        .neq("id", user.id)
        .limit(60);
      if (term) {
        const like = `%${term}%`;
        query = query.or(
          `username.ilike.${like},display_name.ilike.${like},favorite_movie.ilike.${like}` as any
        );
      }
      if (selectedGenres.length) {
        query = (query as any).overlaps("favorite_genres", selectedGenres);
      }
      const { data, error } = await query;
      if (error) throw error;
      setRows(((data as any) || []) as ProfileRow[]);
    } catch (e: any) {
      toast.error(e.message || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) search();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedGenres.join("|")]);

  const ranked = useMemo(() => {
    const mg = new Set(myGenres);
    return [...rows]
      .map((r) => {
        const shared = (r.favorite_genres || []).filter((g) => mg.has(g));
        return { r, shared };
      })
      .sort((a, b) => b.shared.length - a.shared.length);
  }, [rows, myGenres]);

  const toggleFilter = (g: string) => {
    setSelectedGenres((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]));
  };

  const follow = async (targetId: string) => {
    if (!user) return;
    setPending((s) => new Set(s).add(targetId));
    const { error } = await sendFriendRequest(user.id, targetId);
    setPending((s) => { const n = new Set(s); n.delete(targetId); return n; });
    if (error) return toast.error(error);
    setFriendsMap((m) => ({ ...m, [targetId]: "pending" }));
    toast.success("Friend request sent");
  };

  const invite = async (targetId: string, roomId: string) => {
    if (!user) return;
    const { error } = await (supabase.from("room_invites" as any) as any)
      .insert({ room_id: roomId, from_user: user.id, to_user: targetId, status: "pending" });
    if (error) return toast.error(error.message);
    toast.success("Invite sent");
  };

  return (
    <div className="px-6 md:px-12 pt-20 pb-16 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <Sparkles className="h-6 w-6 text-primary" />
        <h1 className="font-display text-3xl md:text-5xl tracking-wider neon-text">Discover Friends</h1>
      </div>
      <p className="text-muted-foreground mb-6">Find people who love the same movies as you.</p>

      <div className="glass rounded-2xl p-4 flex items-center gap-2 mb-4">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Search by username, display name, or favorite movie…"
          className="bg-transparent border-none focus-visible:ring-0"
        />
        <Button onClick={search} disabled={loading} size="sm">Search</Button>
      </div>

      <div className="mb-6">
        <div className="text-xs uppercase text-muted-foreground mb-2">Filter by genre</div>
        <div className="flex flex-wrap gap-2">
          {GENRES.map((g) => {
            const on = selectedGenres.includes(g);
            return (
              <button
                key={g}
                onClick={() => toggleFilter(g)}
                className={`px-3 py-1.5 rounded-full text-xs border transition ${on ? "bg-primary text-primary-foreground border-primary shadow-neon" : "border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/50"}`}
              >
                {g}
              </button>
            );
          })}
          {selectedGenres.length > 0 && (
            <button
              onClick={() => setSelectedGenres([])}
              className="px-3 py-1.5 rounded-full text-xs border border-border/60 text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-16">Searching…</div>
      ) : ranked.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
          No members match those filters yet. Try a different genre or clear the search.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ranked.map(({ r, shared }) => {
            const relation = friendsMap[r.id];
            const isPending = pending.has(r.id);
            const name = r.display_name || r.username || "Member";
            return (
              <div key={r.id} className="glass rounded-2xl p-5 flex flex-col gap-3 hover:neon-border transition">
                <div className="flex items-center gap-3">
                  <Avatar className="h-14 w-14 ring-2 ring-primary/30">
                    <AvatarImage src={r.avatar_url ?? undefined} />
                    <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="font-display text-lg leading-tight truncate">{name}</div>
                    {r.username && <div className="text-xs text-muted-foreground truncate">@{r.username}</div>}
                  </div>
                  {shared.length > 0 && (
                    <Badge className="ml-auto bg-primary/20 text-primary border-primary/40">
                      {shared.length} match{shared.length === 1 ? "" : "es"}
                    </Badge>
                  )}
                </div>

                {r.bio && <p className="text-sm text-muted-foreground line-clamp-2">{r.bio}</p>}

                {r.favorite_movie && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Favorite movie: </span>
                    <span className="text-foreground">{r.favorite_movie}</span>
                  </div>
                )}

                {r.favorite_genres && r.favorite_genres.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {r.favorite_genres.slice(0, 8).map((g) => {
                      const isShared = shared.includes(g);
                      return (
                        <span
                          key={g}
                          className={`text-[10px] px-2 py-0.5 rounded-full border ${isShared ? "bg-primary/20 text-primary border-primary/50" : "border-border/60 text-muted-foreground"}`}
                        >
                          {g}
                        </span>
                      );
                    })}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 mt-auto pt-2">
                  {relation === "accepted" ? (
                    <Button size="sm" variant="outline" disabled>
                      <Check className="h-3.5 w-3.5 mr-1" /> Friends
                    </Button>
                  ) : relation === "pending" ? (
                    <Button size="sm" variant="outline" disabled>Requested</Button>
                  ) : (
                    <Button size="sm" onClick={() => follow(r.id)} disabled={isPending} className="bg-gradient-red shadow-neon">
                      <UserPlus className="h-3.5 w-3.5 mr-1" /> Follow
                    </Button>
                  )}
                  {rooms.length > 0 && (
                    <div className="relative group">
                      <Button size="sm" variant="outline">
                        <UsersIcon className="h-3.5 w-3.5 mr-1" /> Invite to Room
                      </Button>
                      <div className="absolute z-20 right-0 mt-1 hidden group-hover:block glass rounded-lg border border-border/50 min-w-[220px] p-1">
                        {rooms.map((room) => (
                          <button
                            key={room.id}
                            onClick={() => invite(r.id, room.id)}
                            className="w-full text-left px-3 py-2 text-sm rounded hover:bg-primary/10 truncate"
                          >
                            {room.title || "Untitled room"}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <Link to={`/friends?user=${r.id}`} className="ml-auto text-xs text-primary hover:underline self-center">
                    View profile
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}