import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { uploadAvatar } from "@/lib/avatars";
import { Upload } from "lucide-react";
import { toast } from "sonner";

export default function Profile() {
  const { user, isAdmin } = useAuth();
  const [p, setP] = useState<any>({ username: "", display_name: "", avatar_url: "", bio: "" });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [stats, setStats] = useState<{ total: number; genres: [string, number][]; last: { title: string | null; at: string } | null }>({
    total: 0,
    genres: [],
    last: null,
  });

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio, created_at, updated_at")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
      if (data) setP(data);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("watch_history" as any)
        .select("content_title, genre, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error || !data) return;
      const rows = data as any[];
      const counts: Record<string, number> = {};
      rows.forEach((r) => {
        if (!r.genre) return;
        String(r.genre)
          .split(/[,/|]/)
          .map((g) => g.trim())
          .filter(Boolean)
          .forEach((g) => { counts[g] = (counts[g] ?? 0) + 1; });
      });
      const genres = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const last = rows[0] ? { title: rows[0].content_title ?? "Untitled", at: rows[0].created_at } : null;
      setStats({ total: rows.length, genres, last });
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      bio: p.bio,
    });
    setLoading(false);
    if (error) toast.error(error.message); else toast.success("Profile updated");
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    setUploading(true);
    try {
      const url = await uploadAvatar(user.id, file);
      const next = { ...p, avatar_url: url };
      setP(next);
      await supabase.from("profiles").upsert({ id: user.id, ...next });
      toast.success("Avatar updated");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="pt-20 px-6 max-w-2xl mx-auto pb-16">
      <h1 className="font-display text-3xl md:text-5xl tracking-wider neon-text mb-2">Profile</h1>
      <p className="text-sm text-muted-foreground mb-8">
        {p.display_name || p.username
          ? <>{p.display_name || p.username}{p.username && <span className="opacity-70"> · @{p.username}</span>}</>
          : <span className="text-primary">Set a username below</span>}
        {isAdmin && <span className="ml-2 text-primary">· Admin</span>}
      </p>
      <div className="glass rounded-2xl p-6 mb-6">
        <h2 className="font-display text-xl tracking-wider mb-4">Watch Stats</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl bg-secondary/40 p-4">
            <div className="text-xs uppercase text-muted-foreground">Total sessions</div>
            <div className="text-3xl font-display mt-1">{stats.total}</div>
          </div>
          <div className="rounded-xl bg-secondary/40 p-4">
            <div className="text-xs uppercase text-muted-foreground mb-2">Favorite genres</div>
            {stats.genres.length === 0 ? (
              <div className="text-sm text-muted-foreground">No data yet</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {stats.genres.map(([g, n]) => (
                  <span key={g} className="text-xs px-2 py-1 rounded-full bg-primary/15 text-primary">
                    {g} · {n}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-xl bg-secondary/40 p-4">
            <div className="text-xs uppercase text-muted-foreground">Last watched</div>
            {stats.last ? (
              <>
                <div className="text-sm font-medium mt-1 truncate">{stats.last.title}</div>
                <div className="text-xs text-muted-foreground">{new Date(stats.last.at).toLocaleString()}</div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground mt-1">Nothing yet</div>
            )}
          </div>
        </div>
      </div>
      <div className="glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20 ring-2 ring-primary/40">
            <AvatarImage src={p.avatar_url} />
            <AvatarFallback>{(p.display_name || p.username || "?").slice(0,1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            {(p.display_name || p.username) && (
              <div className="mb-2">
                {p.display_name && (
                  <div className="font-display text-lg leading-tight">{p.display_name}</div>
                )}
                {p.username && (
                  <div className="text-sm text-muted-foreground">@{p.username}</div>
                )}
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickFile} />
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload className="h-4 w-4 mr-1" /> {uploading ? "Uploading…" : "Change photo"}
            </Button>
            <p className="text-xs text-muted-foreground mt-1">PNG/JPG up to 5MB</p>
          </div>
        </div>
        <div><Label>Username</Label><Input value={p.username ?? ""} onChange={(e) => setP({ ...p, username: e.target.value })} /></div>
        <div><Label>Display name</Label><Input value={p.display_name ?? ""} onChange={(e) => setP({ ...p, display_name: e.target.value })} /></div>
        <div><Label>Avatar URL</Label><Input value={p.avatar_url ?? ""} onChange={(e) => setP({ ...p, avatar_url: e.target.value })} /></div>
        <div><Label>Bio</Label><Textarea value={p.bio ?? ""} onChange={(e) => setP({ ...p, bio: e.target.value })} /></div>
        <Button onClick={save} disabled={loading} className="bg-gradient-red shadow-neon">Save</Button>
      </div>
    </div>
  );
}