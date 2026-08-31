import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { uploadToTelegram } from "@/lib/telegramUpload";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Trash2,
  Shield,
  ShieldOff,
  Film,
  Tv,
  Tv2,
  Trophy,
  Users as UsersIcon,
  Flag,
  Ban,
  CheckCircle2,
  RefreshCw,
  Pencil,
  X,
  Clapperboard,
  ChevronDown,
  ChevronRight,
  Plus,
} from "lucide-react";
import AbuseReportsPanel from "@/components/admin/AbuseReportsPanel";
import PlaybackReportsPanel from "@/components/admin/PlaybackReportsPanel";
import AdsManager from "@/components/admin/AdsManager";
import StorageModeToggle from "@/components/admin/StorageModeToggle";
import CommunityUploadsQueue from "@/components/admin/CommunityUploadsQueue";
import ReelsManager from "@/components/admin/ReelsManager";
import ErrorMonitorPanel from "@/components/admin/ErrorMonitorPanel";
import StreamInjector from "@/components/admin/StreamInjector";
import { MovieSearchPicker } from "@/components/admin/MovieSearchPicker";
import { SubtitlesManager } from "@/components/admin/SubtitlesManager";
import { useStorageMode } from "@/hooks/useStorageMode";

type SourceType = "hls" | "iframe";

export default function Admin() {
  const { isAdmin, loading, roleLoading } = useAuth();

  if (loading || roleLoading) return null;
  if (!isAdmin) {
    return <Navigate to="/admin-login" replace />;
  }

  return (
    <div className="pt-20 px-4 md:px-8 max-w-7xl mx-auto pb-16">
      <header className="mb-8">
        <h1 className="font-display text-3xl md:text-5xl tracking-wider neon-text">
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground text-sm mt-2">
          Full control of users, content & live events.
        </p>
      </header>

      <StorageModeToggle />

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-secondary/40 backdrop-blur flex flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="movies">Movies</TabsTrigger>
          <TabsTrigger value="series">Series</TabsTrigger>
          <TabsTrigger value="trailers">Trailers</TabsTrigger>
          <TabsTrigger value="reels">Reels</TabsTrigger>
          <TabsTrigger value="tv">TV</TabsTrigger>
          <TabsTrigger value="sports">Sports</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="abuse">Abuse</TabsTrigger>
          <TabsTrigger value="playback">Playback Reports</TabsTrigger>
          <TabsTrigger value="ads">Ads Management</TabsTrigger>
          <TabsTrigger value="community">User Uploads Queue</TabsTrigger>
          <TabsTrigger value="errors">Error Monitor</TabsTrigger>
          <TabsTrigger value="inject">Stream Injector</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><Overview /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="movies"><MoviesTab /></TabsContent>
        <TabsContent value="series"><SeriesTab /></TabsContent>
        <TabsContent value="trailers"><TrailersTab /></TabsContent>
        <TabsContent value="reels"><ReelsManager /></TabsContent>
        <TabsContent value="tv"><TvTab /></TabsContent>
        <TabsContent value="sports"><SportsTab /></TabsContent>
        <TabsContent value="reports"><ReportsTab /></TabsContent>
        <TabsContent value="abuse"><AbuseReportsPanel /></TabsContent>
        <TabsContent value="playback"><PlaybackReportsPanel /></TabsContent>
        <TabsContent value="ads"><AdsManager /></TabsContent>
        <TabsContent value="community"><CommunityUploadsQueue /></TabsContent>
        <TabsContent value="errors"><ErrorMonitorPanel /></TabsContent>
        <TabsContent value="inject"><StreamInjector /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ───────────── Overview ───────────── */
function Overview() {
  const [stats, setStats] = useState({ users: 0, movies: 0, tv: 0, matches: 0, reports: 0, banned: 0 });
  const load = async () => {
    const counts = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("movies").select("*", { count: "exact", head: true }),
      supabase.from("tv_channels").select("*", { count: "exact", head: true }),
      supabase.from("matches").select("*", { count: "exact", head: true }),
      supabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "open"),
      supabase.rpc("admin_count_banned"),
    ]);
    setStats({
      users: counts[0].count ?? 0,
      movies: counts[1].count ?? 0,
      tv: counts[2].count ?? 0,
      matches: counts[3].count ?? 0,
      reports: counts[4].count ?? 0,
      banned: (counts[5] as any)?.data ?? 0,
    });
  };
  useEffect(() => { load(); }, []);

  const cards = [
    { label: "Users", value: stats.users, icon: UsersIcon },
    { label: "Banned", value: stats.banned, icon: Ban },
    { label: "Movies", value: stats.movies, icon: Film },
    { label: "TV Channels", value: stats.tv, icon: Tv },
    { label: "Matches", value: stats.matches, icon: Trophy },
    { label: "Open Reports", value: stats.reports, icon: Flag },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="glass rounded-2xl p-5 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</div>
            <div className="font-display text-3xl mt-1 neon-text">{c.value}</div>
          </div>
          <c.icon className="h-8 w-8 text-primary/70" />
        </div>
      ))}
    </div>
  );
}

/* ───────────── Users ───────────── */
function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [admins, setAdmins] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");

  const load = async () => {
    const [{ data: profs }, { data: roles }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio, created_at, updated_at")
        .order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const ids = (profs ?? []).map((p: any) => p.id);
    const { data: bans } = ids.length
      ? await supabase.rpc("admin_get_ban_status", { _ids: ids })
      : { data: [] as any[] };
    const banMap = new Map<string, any>((bans ?? []).map((b: any) => [b.id, b]));
    setUsers((profs ?? []).map((p: any) => ({ ...p, ...(banMap.get(p.id) ?? {}) })));
    setAdmins(new Set((roles ?? []).filter((r: any) => r.role === "admin").map((r: any) => r.user_id)));
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () => users.filter((u) =>
      !q ||
      (u.username ?? "").toLowerCase().includes(q.toLowerCase()) ||
      (u.display_name ?? "").toLowerCase().includes(q.toLowerCase()) ||
      u.id.includes(q)
    ),
    [users, q]
  );

  const toggleBan = async (u: any) => {
    const { error } = await supabase.from("profiles").update({ is_banned: !u.is_banned }).eq("id", u.id);
    if (error) toast.error(error.message);
    else { toast.success(u.is_banned ? "User unbanned" : "User banned"); load(); }
  };

  const toggleAdmin = async (u: any) => {
    if (admins.has(u.id)) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", u.id).eq("role", "admin");
      if (error) return toast.error(error.message);
      toast.success("Admin role removed");
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: u.id, role: "admin" });
      if (error) return toast.error(error.message);
      toast.success("Promoted to admin");
    }
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input placeholder="Search by name or user id…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      <div className="glass rounded-2xl divide-y divide-border/30">
        {filtered.length === 0 && <div className="p-6 text-sm text-muted-foreground">No users.</div>}
        {filtered.map((u) => (
          <div key={u.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{u.display_name || u.username || "Unnamed"}</span>
                {admins.has(u.id) && <Badge className="bg-primary/20 text-primary border-primary/40">admin</Badge>}
                {u.is_banned && <Badge variant="destructive">banned</Badge>}
              </div>
              <div className="text-xs text-muted-foreground truncate max-w-[400px]">{u.id}</div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => toggleAdmin(u)}>
                {admins.has(u.id) ? <ShieldOff className="h-4 w-4 mr-1" /> : <Shield className="h-4 w-4 mr-1" />}
                {admins.has(u.id) ? "Demote" : "Make admin"}
              </Button>
              <Button size="sm" variant={u.is_banned ? "outline" : "destructive"} onClick={() => toggleBan(u)}>
                {u.is_banned ? <CheckCircle2 className="h-4 w-4 mr-1" /> : <Ban className="h-4 w-4 mr-1" />}
                {u.is_banned ? "Unban" : "Ban"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────── Movies ───────────── */
function MoviesTab() {
  const { user } = useAuth();
  const { mode: storageMode } = useStorageMode();
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState<any>({ source_type: "mp4" as SourceType });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tmdbQuery, setTmdbQuery] = useState("");
  const [tmdbBusy, setTmdbBusy] = useState(false);
  const [sourceMode, setSourceMode] = useState<"upload" | "direct" | "telegram">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [directUrl, setDirectUrl] = useState("");
  const [telegramUrl, setTelegramUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Bunny CDN uploads are proxied through the `bunny-upload` edge function (admin-only).

  const load = () =>
    supabase.from("movies").select("*").order("created_at", { ascending: false }).then(({ data }) => setItems(data ?? []));
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) return toast.error("Title is required");

    setUploading(true);
    setProgress(0);
    try {
      // Block duplicate movies by TMDB id before uploading.
      if (!editingId && form.tmdb_id) {
        const { data: dup } = await supabase
          .from("movies")
          .select("id, title")
          .eq("tmdb_id", form.tmdb_id)
          .maybeSingle();
        if (dup) {
          toast.error(`This content already exists! ("${dup.title}")`);
          return;
        }
      }
      let finalUrl = form.stream_url || "";

      if (!editingId) {
        if (sourceMode === "upload") {
          if (!file) throw new Error("Choose a video file to upload");
          const res = await uploadToTelegram(file, form.title, (p) => setProgress(p));
          finalUrl = res.stream_url;
          setProgress(100);
        } else if (sourceMode === "direct") {
          if (!directUrl.trim() || !/^https?:\/\//i.test(directUrl.trim())) {
            throw new Error("Paste a valid direct video URL (http/https)");
          }
          finalUrl = directUrl.trim();
          setProgress(100);
        } else {
          const tg = telegramUrl.trim();
          if (!tg || !/^https?:\/\//i.test(tg)) {
            throw new Error("Paste a Telegram video stream URL (http/https)");
          }
          finalUrl = tg;
          setProgress(100);
        }
      }

      const payload: any = {
        title: form.title,
        stream_url: finalUrl,
        source_type: "mp4",
        voe_sx_url: null,
        streamtape_url: null,
        doodstream_url: null,
        poster_url: form.poster_url || null,
        backdrop_url: form.backdrop_url || null,
        genre: form.genre || null,
        category: form.category || null,
        tmdb_id: form.tmdb_id || null,
        imdb_rating: form.imdb_rating ?? null,
        duration_minutes: form.duration_minutes ?? null,
        year: form.year ? Number(form.year) : null,
        description: form.description || null,
        featured: !!form.featured,
      };

      let error;
      if (editingId) {
        ({ error } = await supabase.from("movies").update(payload).eq("id", editingId));
      } else {
        payload.created_by = user?.id;
        ({ error } = await supabase.from("movies").insert(payload));
      }
      if (error) throw error;

      toast.success(editingId ? "Movie updated" : "Movie added");
      setForm({ source_type: "mp4" });
      setEditingId(null);
      setFile(null);
      setDirectUrl("");
      setTelegramUrl("");
      setProgress(0);
      (e.target as HTMLFormElement).reset();
      load();
    } catch (err: any) {
      toast.error(err?.message || "Save failed");
    } finally {
      setUploading(false);
    }
  };

  const fetchFromTmdb = async () => {
    if (!tmdbQuery.trim()) return;
    setTmdbBusy(true);
    const { data, error } = await supabase.functions.invoke("tmdb-fetch", {
      body: { query: tmdbQuery.trim() },
    });
    setTmdbBusy(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "TMDB lookup failed");
      return;
    }
    setForm((f: any) => ({ ...f, ...data }));
    toast.success(`Loaded: ${data.title}`);
  };

  const del = async (id: string) => {
    const movie = items.find((m) => m.id === id);
    if (!confirm(`Delete "${movie?.title ?? "this movie"}"? This cannot be undone.`)) return;
    const prev = items;
    setItems((list) => list.filter((m) => m.id !== id));
    const { error } = await supabase.from("movies").delete().eq("id", id);
    if (error) { setItems(prev); return toast.error(error.message); }
    toast.success("Movie deleted");
  };

  const startEdit = (m: any) => {
    setEditingId(m.id);
    setForm({
      title: m.title ?? "",
      source_type: m.source_type ?? "mp4",
      stream_url: m.stream_url ?? "",
      poster_url: m.poster_url ?? "",
      backdrop_url: m.backdrop_url ?? "",
      genre: m.genre ?? "",
      category: m.category ?? "",
      tmdb_id: m.tmdb_id ?? null,
      imdb_rating: m.imdb_rating ?? null,
      duration_minutes: m.duration_minutes ?? null,
      year: m.year ?? "",
      description: m.description ?? "",
      featured: !!m.featured,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ source_type: "mp4" });
    setFile(null);
    setDirectUrl("");
  };

  const filteredMovies = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((m) =>
      (m.title ?? "").toLowerCase().includes(s) ||
      (m.genre ?? "").toLowerCase().includes(s) ||
      String(m.year ?? "").includes(s)
    );
  }, [items, q]);

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-5 space-y-3">
        <div className="text-sm font-medium">Auto-fill from TMDB</div>
        <p className="text-xs text-muted-foreground">
          Search by movie title to auto-populate the form (poster, year, genre, IMDb rating, etc.)
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. Inception"
            value={tmdbQuery}
            onChange={(e) => setTmdbQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); fetchFromTmdb(); } }}
          />
          <Button type="button" onClick={fetchFromTmdb} disabled={tmdbBusy} className="bg-gradient-red shadow-neon">
            {tmdbBusy ? "Loading…" : "Fetch"}
          </Button>
        </div>
      </div>

      <form onSubmit={submit} className="glass rounded-2xl p-5 grid sm:grid-cols-2 gap-4">
        {editingId && (
          <div className="sm:col-span-2 flex items-center justify-between text-sm">
            <span className="text-primary">Editing existing movie</span>
            <Button type="button" variant="ghost" size="sm" onClick={cancelEdit}>
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
          </div>
        )}
        <Field label="Title *"><Input required value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Category">
          <Select value={form.category ?? ""} onValueChange={(v) => setForm({ ...form, category: v })}>
            <SelectTrigger><SelectValue placeholder="Pick a category" /></SelectTrigger>
            <SelectContent>
              {["Action","Adventure","Animation","Comedy","Crime","Documentary","Drama","Family","Fantasy","Horror","Mystery","Romance","Science Fiction","Thriller","War","Western"].map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Genre tags"><Input value={form.genre ?? ""} onChange={(e) => setForm({ ...form, genre: e.target.value })} placeholder="Action, Drama…" /></Field>
        <Field label="Poster URL"><Input value={form.poster_url ?? ""} onChange={(e) => setForm({ ...form, poster_url: e.target.value })} /></Field>
        <Field label="Backdrop URL"><Input value={form.backdrop_url ?? ""} onChange={(e) => setForm({ ...form, backdrop_url: e.target.value })} /></Field>
        <Field label="Year"><Input type="number" value={form.year ?? ""} onChange={(e) => setForm({ ...form, year: e.target.value })} /></Field>
        <Field label="IMDb / TMDB rating"><Input type="number" step="0.1" value={form.imdb_rating ?? ""} onChange={(e) => setForm({ ...form, imdb_rating: e.target.value ? Number(e.target.value) : null })} /></Field>
        <Field label="Duration (min)"><Input type="number" value={form.duration_minutes ?? ""} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value ? Number(e.target.value) : null })} /></Field>
        <Field label="Featured">
          <Select defaultValue="false" onValueChange={(v) => setForm({ ...form, featured: v === "true" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="false">No</SelectItem>
              <SelectItem value="true">Yes — show on home</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="sm:col-span-2"><Field label="Description"><Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field></div>

        {!editingId && (
          <div className="sm:col-span-2 space-y-2">
            <Label>
              Video source ·{" "}
              <span className={storageMode === "telegram" ? "text-sky-400" : "text-orange-400"}>
                {storageMode === "telegram" ? "Telegram Free Stream (active)" : "Bunny.net Premium CDN (active)"}
              </span>
            </Label>
            <Tabs value={sourceMode} onValueChange={(v) => setSourceMode(v as "upload" | "direct" | "telegram")}>
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="upload" disabled={uploading}>PC File Upload</TabsTrigger>
                <TabsTrigger value="direct" disabled={uploading}>HLS / M3U8 / MP4</TabsTrigger>
                <TabsTrigger value="telegram" disabled={uploading}>Telegram Link</TabsTrigger>
              </TabsList>
              <TabsContent value="upload" className="space-y-2 pt-3">
                <Input
                  type="file"
                  accept="video/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  disabled={uploading}
                />
                {file && (
                  <p className="text-xs text-muted-foreground">
                    {file.name} — {(file.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  File is streamed into the private Telegram channel (50 MB max) and played back natively.
                </p>
              </TabsContent>
              <TabsContent value="direct" className="space-y-2 pt-3">
                <Input
                  type="url"
                  placeholder="https://example.com/stream.m3u8  or  …/video.mp4"
                  value={directUrl}
                  onChange={(e) => setDirectUrl(e.target.value)}
                  disabled={uploading}
                />
                <p className="text-xs text-muted-foreground">
                  Paste a direct .mp4, .webm, or HLS (.m3u8) playlist — played by the hardened HTML5 player.
                </p>
              </TabsContent>
              <TabsContent value="telegram" className="space-y-2 pt-3">
                <Input
                  type="url"
                  placeholder="https://t.me/c/.../123  or  https://api.telegram.org/file/bot…/video.mp4"
                  value={telegramUrl}
                  onChange={(e) => setTelegramUrl(e.target.value)}
                  disabled={uploading}
                />
                <p className="text-xs text-muted-foreground">
                  Paste a public Telegram channel message link or a direct Bot API stream URL.
                </p>
              </TabsContent>
            </Tabs>
            {uploading && (
              <div className="space-y-1">
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground">
                  {sourceMode === "upload"
                    ? `Uploading to Telegram… ${progress}%`
                    : "Saving…"}
                </p>
              </div>
            )}
          </div>
        )}

        {editingId && (
          <div className="sm:col-span-2">
            <Field label="Stream URL">
              <Input
                value={form.stream_url ?? ""}
                onChange={(e) => setForm({ ...form, stream_url: e.target.value })}
                placeholder="https://syncshow.b-cdn.net/…"
              />
            </Field>
          </div>
        )}

        <div className="sm:col-span-2">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
            Subtitles / Captions
          </div>
          {editingId ? (
            <SubtitlesManager contentId={editingId} table="movies" />
          ) : (
            <div className="glass rounded-2xl p-4 text-xs text-muted-foreground">
              Save the movie first, then edit it to attach <code>.vtt</code> or <code>.srt</code>
              subtitle tracks in multiple languages (Arabic, English, French, German, Russian, and more).
            </div>
          )}
        </div>

        <div className="sm:col-span-2">
          <Button className="bg-gradient-red shadow-neon" disabled={uploading}>
            {uploading ? "Working…" : editingId ? "Save changes" : "Add movie"}
          </Button>
        </div>
      </form>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="p-3 border-b border-border/30 flex items-center gap-2">
          <Input
            placeholder="Search movies by title, genre or year…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Badge variant="outline">{filteredMovies.length}</Badge>
        </div>
        <div className="divide-y divide-border/30">
        {filteredMovies.length === 0 && <div className="p-6 text-sm text-muted-foreground">{items.length === 0 ? "No movies yet." : "No matches."}</div>}
        {filteredMovies.map((m) => (
          <div key={m.id} className="p-4 flex items-center justify-between gap-3">
            <div className="flex gap-3 items-center min-w-0">
              {m.poster_url && <img src={m.poster_url} alt="" className="h-12 w-9 object-cover rounded" />}
              <div className="min-w-0">
                <div className="font-medium truncate">{m.title}</div>
                <div className="text-xs text-muted-foreground flex gap-2 flex-wrap">
                  <Badge variant="outline">{m.source_type}</Badge>
                  {m.stream_url && <span className="truncate max-w-[260px]">{m.stream_url}</span>}
                  {m.genre && <span>{m.genre}</span>}
                  {m.year && <span>{m.year}</span>}
                  {m.featured && <Badge className="bg-primary/20 text-primary border-primary/40">featured</Badge>}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => startEdit(m)}>
                <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
              </Button>
              <Button size="sm" variant="destructive" onClick={() => del(m.id)}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
              </Button>
            </div>
          </div>
        ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────── TV ───────────── */
function TvTab() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ source_type: "hls" as SourceType });

  const load = () => supabase.from("tv_channels").select("*").order("name").then(({ data }) => setItems(data ?? []));
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.m3u_url) return toast.error("Name and M3U URL required");
    const { error } = await supabase.from("tv_channels").insert({
      name: form.name,
      m3u_url: form.m3u_url,
      source_type: form.source_type ?? "hls",
      country: form.country || null,
      category: form.category || null,
      logo_url: form.logo_url || null,
      created_by: user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Channel added");
    setForm({ source_type: "hls" });
    (e.target as HTMLFormElement).reset();
    load();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this channel?")) return;
    const { error } = await supabase.from("tv_channels").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="glass rounded-2xl p-5 grid sm:grid-cols-2 gap-4">
        <Field label="Channel name *"><Input required onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="M3U / HLS URL *"><Input required onChange={(e) => setForm({ ...form, m3u_url: e.target.value })} placeholder="https://…/stream.m3u8" /></Field>
        <Field label="Source type">
          <Select defaultValue="hls" onValueChange={(v) => setForm({ ...form, source_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="hls">M3U / HLS stream</SelectItem>
              <SelectItem value="iframe">Iframe embed</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Country"><Input onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="US, UK, FR…" /></Field>
        <Field label="Category">
          <Select onValueChange={(v) => setForm({ ...form, category: v })}>
            <SelectTrigger><SelectValue placeholder="Pick a category" /></SelectTrigger>
            <SelectContent>
              {["News", "Sports", "Movies", "Kids", "Music", "Entertainment", "Documentary"].map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Logo URL"><Input onChange={(e) => setForm({ ...form, logo_url: e.target.value })} /></Field>
        <div className="sm:col-span-2"><Button className="bg-gradient-red shadow-neon">Add channel</Button></div>
      </form>

      <div className="glass rounded-2xl divide-y divide-border/30">
        {items.length === 0 && <div className="p-6 text-sm text-muted-foreground">No channels yet.</div>}
        {items.map((c) => (
          <div key={c.id} className="p-4 flex items-center justify-between gap-3">
            <div className="flex gap-3 items-center min-w-0">
              {c.logo_url && <img src={c.logo_url} alt="" className="h-10 w-10 object-contain rounded bg-secondary/40" />}
              <div className="min-w-0">
                <div className="font-medium truncate">{c.name}</div>
                <div className="text-xs text-muted-foreground flex gap-2 flex-wrap">
                  <Badge variant="outline">{c.source_type}</Badge>
                  {c.country && <span>{c.country}</span>}
                  {c.category && <span>{c.category}</span>}
                </div>
              </div>
            </div>
            <Button size="icon" variant="ghost" onClick={() => del(c.id)}><Trash2 className="h-4 w-4 text-primary" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────── Sports ───────────── */
function SportsTab() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ status: "scheduled", source_type: "hls" as SourceType });
  const [apiUrl, setApiUrl] = useState("");
  const [importing, setImporting] = useState(false);

  const load = () => supabase.from("matches").select("*").order("kickoff_at").then(({ data }) => setItems(data ?? []));
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.home_team || !form.away_team || !form.kickoff_at) return toast.error("Teams and kickoff required");
    const { error } = await supabase.from("matches").insert({
      league: form.league || null,
      home_team: form.home_team,
      away_team: form.away_team,
      home_logo: form.home_logo || null,
      away_logo: form.away_logo || null,
      home_score: Number(form.home_score) || 0,
      away_score: Number(form.away_score) || 0,
      status: form.status || "scheduled",
      kickoff_at: new Date(form.kickoff_at).toISOString(),
      stream_url: form.stream_url || null,
      source_type: form.source_type ?? "hls",
      created_by: user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Match added");
    setForm({ status: "scheduled", source_type: "hls" });
    (e.target as HTMLFormElement).reset();
    load();
  };

  const updateMatch = async (id: string, patch: any) => {
    const { error } = await supabase.from("matches").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this match?")) return;
    const { error } = await supabase.from("matches").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  // Lightweight API import: expects JSON array of { league, home_team, away_team, kickoff_at, home_score?, away_score?, status?, stream_url?, home_logo?, away_logo? }
  const importFromApi = async () => {
    if (!apiUrl) return;
    setImporting(true);
    try {
      const res = await fetch(apiUrl);
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.matches ?? data.results ?? [];
      if (!list.length) throw new Error("No matches in response");
      const rows = list.map((m: any) => ({
        league: m.league ?? null,
        home_team: m.home_team ?? m.homeTeam ?? m.home,
        away_team: m.away_team ?? m.awayTeam ?? m.away,
        home_logo: m.home_logo ?? null,
        away_logo: m.away_logo ?? null,
        home_score: Number(m.home_score ?? m.score?.home ?? 0),
        away_score: Number(m.away_score ?? m.score?.away ?? 0),
        status: m.status ?? "scheduled",
        kickoff_at: new Date(m.kickoff_at ?? m.date ?? m.utcDate).toISOString(),
        stream_url: m.stream_url ?? null,
        source_type: m.source_type ?? "hls",
        created_by: user?.id,
      })).filter((r: any) => r.home_team && r.away_team && r.kickoff_at);
      const { error } = await supabase.from("matches").insert(rows);
      if (error) throw error;
      toast.success(`Imported ${rows.length} match(es)`);
      load();
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-5 space-y-3">
        <div className="text-sm font-medium">Import from sports API</div>
        <p className="text-xs text-muted-foreground">
          Paste a JSON endpoint returning an array of matches. Expected fields: <code>league, home_team, away_team, kickoff_at, status, stream_url</code>.
        </p>
        <div className="flex gap-2">
          <Input placeholder="https://api.example.com/fixtures" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
          <Button onClick={importFromApi} disabled={importing} className="bg-gradient-red shadow-neon">
            {importing ? "Importing…" : "Import"}
          </Button>
        </div>
      </div>

      <form onSubmit={submit} className="glass rounded-2xl p-5 grid sm:grid-cols-2 gap-4">
        <Field label="League"><Input onChange={(e) => setForm({ ...form, league: e.target.value })} /></Field>
        <Field label="Status">
          <Select defaultValue="scheduled" onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="live">Live</SelectItem>
              <SelectItem value="finished">Finished</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Home team *"><Input required onChange={(e) => setForm({ ...form, home_team: e.target.value })} /></Field>
        <Field label="Away team *"><Input required onChange={(e) => setForm({ ...form, away_team: e.target.value })} /></Field>
        <Field label="Home logo URL"><Input onChange={(e) => setForm({ ...form, home_logo: e.target.value })} /></Field>
        <Field label="Away logo URL"><Input onChange={(e) => setForm({ ...form, away_logo: e.target.value })} /></Field>
        <Field label="Home score"><Input type="number" onChange={(e) => setForm({ ...form, home_score: e.target.value })} /></Field>
        <Field label="Away score"><Input type="number" onChange={(e) => setForm({ ...form, away_score: e.target.value })} /></Field>
        <Field label="Kickoff *"><Input type="datetime-local" required onChange={(e) => setForm({ ...form, kickoff_at: e.target.value })} /></Field>
        <Field label="Source type">
          <Select defaultValue="hls" onValueChange={(v) => setForm({ ...form, source_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="hls">HLS / MP4</SelectItem>
              <SelectItem value="iframe">Iframe embed</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="sm:col-span-2"><Field label="Stream URL"><Input onChange={(e) => setForm({ ...form, stream_url: e.target.value })} /></Field></div>
        <div className="sm:col-span-2"><Button className="bg-gradient-red shadow-neon">Add match</Button></div>
      </form>

      <div className="glass rounded-2xl divide-y divide-border/30">
        {items.length === 0 && <div className="p-6 text-sm text-muted-foreground">No matches yet.</div>}
        {items.map((m) => (
          <div key={m.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium">{m.home_team} <span className="text-primary">{m.home_score}</span> — <span className="text-primary">{m.away_score}</span> {m.away_team}</div>
              <div className="text-xs text-muted-foreground flex gap-2 flex-wrap mt-1">
                {m.league && <span>{m.league}</span>}
                <span>{new Date(m.kickoff_at).toLocaleString()}</span>
                <Badge variant="outline">{m.status}</Badge>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <Select defaultValue={m.status} onValueChange={(v) => updateMatch(m.id, { status: v })}>
                <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="live">Live</SelectItem>
                  <SelectItem value="finished">Finished</SelectItem>
                </SelectContent>
              </Select>
              <Input className="w-16 h-8" type="number" defaultValue={m.home_score} onBlur={(e) => updateMatch(m.id, { home_score: Number(e.target.value) })} />
              <Input className="w-16 h-8" type="number" defaultValue={m.away_score} onBlur={(e) => updateMatch(m.id, { away_score: Number(e.target.value) })} />
              <Button size="icon" variant="ghost" onClick={() => del(m.id)}><Trash2 className="h-4 w-4 text-primary" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────── Reports ───────────── */
function ReportsTab() {
  const [items, setItems] = useState<any[]>([]);
  const load = () => supabase.from("reports").select("*").order("created_at", { ascending: false }).then(({ data }) => setItems(data ?? []));
  useEffect(() => { load(); }, []);

  const resolve = async (id: string, status: string) => {
    const { error } = await supabase.from("reports").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="glass rounded-2xl divide-y divide-border/30">
      {items.length === 0 && <div className="p-6 text-sm text-muted-foreground">No reports.</div>}
      {items.map((r) => (
        <div key={r.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm">{r.reason}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Reporter: <code>{r.reporter_id.slice(0, 8)}…</code>
              {r.reported_user_id && <> · Target: <code>{r.reported_user_id.slice(0, 8)}…</code></>}
              · {new Date(r.created_at).toLocaleString()}
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <Badge variant={r.status === "open" ? "destructive" : "outline"}>{r.status}</Badge>
            {r.status === "open" && (
              <>
                <Button size="sm" variant="outline" onClick={() => resolve(r.id, "dismissed")}>Dismiss</Button>
                <Button size="sm" className="bg-gradient-red" onClick={() => resolve(r.id, "resolved")}>Resolve</Button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ───────────── helpers ───────────── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/* ───────────── Trailers ───────────── */
function TrailersTab() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [movies, setMovies] = useState<any[]>([]);
  const [seriesList, setSeriesList] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ kind: "movie" });
  const [editingId, setEditingId] = useState<string | null>(null);

  // Accepts: raw 11-char YouTube IDs, watch URLs, youtu.be URLs, or embed/iframe paths.
  const normalizeYoutube = (input: string): string | null => {
    const v = input.trim();
    if (!v) return null;
    // Pull src= out of a pasted iframe snippet.
    const iframeMatch = v.match(/src=["']([^"']+)["']/i);
    const candidate = iframeMatch ? iframeMatch[1] : v;
    const m = candidate.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{6,})/);
    if (m) return `https://www.youtube.com/watch?v=${m[1]}`;
    if (/^[A-Za-z0-9_-]{6,15}$/.test(candidate)) return `https://www.youtube.com/watch?v=${candidate}`;
    return null;
  };

  const load = async () => {
    const [{ data: t }, { data: m }, { data: s }] = await Promise.all([
      supabase.from("trailers" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("movies").select("id,title,poster_url").order("title"),
      (supabase.from("series" as any).select("id,title,poster_url").order("title") as any),
    ]);
    setItems(t ?? []);
    setMovies(m ?? []);
    setSeriesList(s ?? []);
  };
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const kind = form.kind ?? "movie";
    const targetId = kind === "series" ? form.series_id : form.movie_id;
    if (!targetId) return toast.error(`Pick a ${kind}`);
    const list = kind === "series" ? seriesList : movies;
    const target = list.find((mv) => mv.id === targetId);
    if (!target) return toast.error("Title not found");
    const normalized = normalizeYoutube(form.youtube_url ?? "");
    if (!normalized) {
      return toast.error("Paste a valid YouTube URL, video ID, or iframe embed path");
    }
    const payload: any = {
      kind,
      movie_id: kind === "movie" ? targetId : null,
      series_id: kind === "series" ? targetId : null,
      movie_title: target.title,
      voe_sx_url: null,
      doodstream_url: null,
      streamtape_url: null,
      youtube_url: normalized,
    };
    let error;
    if (editingId) {
      ({ error } = await supabase.from("trailers" as any).update(payload).eq("id", editingId));
    } else {
      payload.created_by = user?.id;
      ({ error } = await supabase.from("trailers" as any).insert(payload));
    }
    if (error) return toast.error(error.message);
    toast.success(editingId ? "Trailer updated" : "Trailer added");
    setForm({ kind: "movie" });
    setEditingId(null);
    (e.target as HTMLFormElement).reset();
    load();
  };

  const startEdit = (t: any) => {
    setEditingId(t.id);
    setForm({
      kind: t.kind ?? (t.series_id ? "series" : "movie"),
      movie_id: t.movie_id,
      series_id: t.series_id,
      youtube_url: t.youtube_url ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => { setEditingId(null); setForm({ kind: "movie" }); };

  const del = async (id: string) => {
    if (!confirm("Delete this trailer?")) return;
    const { error } = await supabase.from("trailers" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="glass rounded-2xl p-5 grid sm:grid-cols-2 gap-4">
        {editingId && (
          <div className="sm:col-span-2 flex items-center justify-between text-sm">
            <span className="text-primary">Editing existing trailer</span>
            <Button type="button" variant="ghost" size="sm" onClick={cancelEdit}>
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
          </div>
        )}
        <Field label="Kind">
          <Select value={form.kind ?? "movie"} onValueChange={(v) => setForm({ ...form, kind: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="movie">Movie</SelectItem>
              <SelectItem value="series">Series</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="sm:col-span-1">
          {(form.kind ?? "movie") === "movie" ? (
            <MovieSearchPicker
              label="Movie * (search your catalog)"
              items={movies}
              value={form.movie_id ?? ""}
              onChange={(id) => setForm({ ...form, movie_id: id })}
              placeholder="Type a movie title from your uploads…"
            />
          ) : (
            <MovieSearchPicker
              label="Series * (search your catalog)"
              items={seriesList}
              value={form.series_id ?? ""}
              onChange={(id) => setForm({ ...form, series_id: id })}
              placeholder="Type a series title from your uploads…"
            />
          )}
        </div>
        <div className="sm:col-span-2">
          <Field label="YouTube URL, video ID, or iframe embed path *">
            <Input
              value={form.youtube_url ?? ""}
              onChange={(e) => setForm({ ...form, youtube_url: e.target.value })}
              placeholder="dQw4w9WgXcQ  ·  https://youtu.be/…  ·  https://www.youtube.com/embed/…  ·  <iframe src=…>"
            />
          </Field>
        </div>
        <div className="sm:col-span-2"><Button className="bg-gradient-red shadow-neon">{editingId ? "Save changes" : "Add trailer"}</Button></div>
      </form>

      <div className="glass rounded-2xl divide-y divide-border/30">
        {items.length === 0 && <div className="p-6 text-sm text-muted-foreground">No trailers yet.</div>}
        {items.map((t) => (
          <div key={t.id} className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium truncate flex items-center gap-2">
                <Clapperboard className="h-4 w-4 text-primary" /> {t.movie_title}
                <Badge variant="outline" className="ml-1">{t.kind ?? "movie"}</Badge>
              </div>
              <div className="text-xs text-muted-foreground flex gap-2 flex-wrap mt-1">
                {t.youtube_url && <span>YouTube</span>}
              </div>
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => startEdit(t)}><Pencil className="h-4 w-4 text-primary" /></Button>
              <Button size="icon" variant="ghost" onClick={() => del(t.id)}><Trash2 className="h-4 w-4 text-primary" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────── Series ───────────── */
function SeriesTab() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState<any>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tmdbQuery, setTmdbQuery] = useState("");
  const [tmdbBusy, setTmdbBusy] = useState(false);
  const [pendingTrailerUrl, setPendingTrailerUrl] = useState<string | null>(null);

  const load = () =>
    (supabase.from("series" as any).select("*").order("created_at", { ascending: false }) as any)
      .then(({ data }: any) => setItems(data ?? []));
  useEffect(() => { load(); }, []);

  const upsertTrailer = async (seriesId: string, title: string, youtubeUrl: string) => {
    const { data: existing } = await (supabase
      .from("trailers" as any)
      .select("id")
      .eq("kind", "series")
      .eq("series_id", seriesId)
      .maybeSingle() as any);
    if (existing?.id) {
      await (supabase.from("trailers" as any).update({ youtube_url: youtubeUrl, movie_title: title }).eq("id", existing.id) as any);
    } else {
      await (supabase.from("trailers" as any).insert({
        kind: "series",
        series_id: seriesId,
        movie_title: title,
        youtube_url: youtubeUrl,
        created_by: user?.id,
      }) as any);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) return toast.error("Title required");
    const payload: any = {
      title: form.title,
      description: form.description || null,
      poster_url: form.poster_url || null,
      backdrop_url: form.backdrop_url || null,
      genre: form.genre || null,
      category: form.category || null,
      tmdb_id: form.tmdb_id || null,
      imdb_rating: form.imdb_rating ?? null,
      year: form.year ? Number(form.year) : null,
      featured: !!form.featured,
    };
    let error: any;
    let savedId = editingId;
    if (editingId) {
      ({ error } = await (supabase.from("series" as any).update(payload).eq("id", editingId) as any));
    } else {
      if (payload.tmdb_id) {
        const { data: dup } = await (supabase
          .from("series" as any)
          .select("id, title")
          .eq("tmdb_id", payload.tmdb_id)
          .maybeSingle() as any);
        if (dup) {
          return toast.error(`This content already exists! ("${dup.title}")`);
        }
      }
      payload.created_by = user?.id;
      const { data, error: e2 } = await (supabase.from("series" as any).insert(payload).select("id").single() as any);
      error = e2;
      savedId = data?.id ?? null;
    }
    if (error) return toast.error(error.message);
    if (savedId && pendingTrailerUrl) {
      await upsertTrailer(savedId, form.title, pendingTrailerUrl);
    }
    toast.success(editingId ? "Series updated" : "Series added");
    setForm({});
    setEditingId(null);
    setPendingTrailerUrl(null);
    (e.target as HTMLFormElement).reset();
    load();
  };

  const fetchFromTmdb = async () => {
    const q = tmdbQuery.trim();
    if (!q && !form.tmdb_id) return;
    setTmdbBusy(true);
    const body: any = { kind: "series" };
    if (/^\d+$/.test(q)) body.tmdb_id = Number(q);
    else if (q) body.query = q;
    else body.tmdb_id = form.tmdb_id;
    const { data, error } = await supabase.functions.invoke("tmdb-fetch", { body });
    setTmdbBusy(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "TMDB lookup failed");
      return;
    }
    const { youtube_trailer_url, kind: _k, ...rest } = data as any;
    setForm((f: any) => ({ ...f, ...rest }));
    setPendingTrailerUrl(youtube_trailer_url ?? null);
    toast.success(youtube_trailer_url ? `Loaded: ${rest.title} (trailer found)` : `Loaded: ${rest.title}`);
  };

  const startEdit = (s: any) => {
    setEditingId(s.id);
    setForm({ ...s });
    setPendingTrailerUrl(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const cancelEdit = () => { setEditingId(null); setForm({}); setPendingTrailerUrl(null); };

  const del = async (id: string) => {
    const s = items.find((x) => x.id === id);
    if (!confirm(`Delete "${s?.title ?? "this series"}" and every season/episode? This cannot be undone.`)) return;
    const prev = items;
    setItems((list) => list.filter((x) => x.id !== id));
    const { error } = await (supabase.from("series" as any).delete().eq("id", id) as any);
    if (error) { setItems(prev); return toast.error(error.message); }
    toast.success("Series deleted");
  };

  const filteredSeries = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((x) =>
      (x.title ?? "").toLowerCase().includes(s) ||
      (x.genre ?? "").toLowerCase().includes(s) ||
      String(x.year ?? "").includes(s)
    );
  }, [items, q]);

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-5 space-y-3">
        <div className="text-sm font-medium">Auto-fill from TMDB</div>
        <p className="text-xs text-muted-foreground">
          Search by series title or TMDB ID. The YouTube trailer is fetched automatically and saved when you save the series.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. Breaking Bad or 1396"
            value={tmdbQuery}
            onChange={(e) => setTmdbQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); fetchFromTmdb(); } }}
          />
          <Button type="button" onClick={fetchFromTmdb} disabled={tmdbBusy} className="bg-gradient-red shadow-neon">
            {tmdbBusy ? "Loading…" : "Fetch"}
          </Button>
        </div>
        {pendingTrailerUrl && (
          <div className="text-xs text-primary truncate">Trailer ready: {pendingTrailerUrl}</div>
        )}
      </div>

      <form onSubmit={submit} className="glass rounded-2xl p-5 grid sm:grid-cols-2 gap-4">
        {editingId && (
          <div className="sm:col-span-2 flex items-center justify-between text-sm">
            <span className="text-primary">Editing existing series</span>
            <Button type="button" variant="ghost" size="sm" onClick={cancelEdit}>
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
          </div>
        )}
        <Field label="Title *"><Input required value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Category">
          <Select value={form.category ?? ""} onValueChange={(v) => setForm({ ...form, category: v })}>
            <SelectTrigger><SelectValue placeholder="Pick a category" /></SelectTrigger>
            <SelectContent>
              {["Action","Adventure","Animation","Comedy","Crime","Documentary","Drama","Family","Fantasy","Horror","Mystery","Romance","Science Fiction","Thriller","War","Western"].map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Genre tags"><Input value={form.genre ?? ""} onChange={(e) => setForm({ ...form, genre: e.target.value })} /></Field>
        <Field label="Year"><Input type="number" value={form.year ?? ""} onChange={(e) => setForm({ ...form, year: e.target.value })} /></Field>
        <Field label="TMDB ID"><Input type="number" value={form.tmdb_id ?? ""} onChange={(e) => setForm({ ...form, tmdb_id: e.target.value ? Number(e.target.value) : null })} /></Field>
        <Field label="IMDb rating"><Input type="number" step="0.1" value={form.imdb_rating ?? ""} onChange={(e) => setForm({ ...form, imdb_rating: e.target.value ? Number(e.target.value) : null })} /></Field>
        <Field label="Poster URL"><Input value={form.poster_url ?? ""} onChange={(e) => setForm({ ...form, poster_url: e.target.value })} /></Field>
        <Field label="Backdrop URL"><Input value={form.backdrop_url ?? ""} onChange={(e) => setForm({ ...form, backdrop_url: e.target.value })} /></Field>
        <Field label="Featured">
          <Select value={form.featured ? "true" : "false"} onValueChange={(v) => setForm({ ...form, featured: v === "true" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="false">No</SelectItem>
              <SelectItem value="true">Yes</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="sm:col-span-2"><Field label="Description"><Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field></div>
        <div className="sm:col-span-2"><Button className="bg-gradient-red shadow-neon">{editingId ? "Save changes" : "Add series"}</Button></div>
      </form>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="p-3 border-b border-border/30 flex items-center gap-2">
          <Input
            placeholder="Search series by title, genre or year…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Badge variant="outline">{filteredSeries.length}</Badge>
        </div>
        <div className="divide-y divide-border/30">
        {filteredSeries.length === 0 && <div className="p-6 text-sm text-muted-foreground">{items.length === 0 ? "No series yet." : "No matches."}</div>}
        {filteredSeries.map((s) => (
          <div key={s.id}>
            <div className="p-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                className="flex gap-3 items-center min-w-0 text-left flex-1"
              >
                {expandedId === s.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {s.poster_url && <img src={s.poster_url} alt="" className="h-12 w-9 object-cover rounded" />}
                <div className="min-w-0">
                  <div className="font-medium truncate flex items-center gap-2">
                    <Tv2 className="h-4 w-4 text-primary" /> {s.title}
                  </div>
                  <div className="text-xs text-muted-foreground flex gap-2 flex-wrap">
                    {s.year && <span>{s.year}</span>}
                    {s.genre && <span>{s.genre}</span>}
                    {s.featured && <Badge className="bg-primary/20 text-primary border-primary/40">featured</Badge>}
                  </div>
                </div>
              </button>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => startEdit(s)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
                <Button size="sm" variant="destructive" onClick={() => del(s.id)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                </Button>
              </div>
            </div>
            {expandedId === s.id && <SeasonsManager seriesId={s.id} />}
          </div>
        ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────── Seasons / Episodes manager ───────────── */
function SeasonsManager({ seriesId }: { seriesId: string }) {
  const [seasons, setSeasons] = useState<any[]>([]);
  const [newSeason, setNewSeason] = useState<{ season_number: string; title: string }>({ season_number: "", title: "" });
  const [activeSeasonId, setActiveSeasonId] = useState<string>("");
  const [showNewSeason, setShowNewSeason] = useState(false);

  const load = () =>
    (supabase.from("seasons" as any).select("*").eq("series_id", seriesId).order("season_number") as any)
      .then(({ data }: any) => {
        setSeasons(data ?? []);
        if (data && data.length && !activeSeasonId) setActiveSeasonId(data[0].id);
      });
  useEffect(() => { load(); }, [seriesId]);

  const addSeason = async () => {
    const num = Number(newSeason.season_number);
    if (!num) return toast.error("Season number required");
    const { data, error } = await (supabase.from("seasons" as any).insert({
      series_id: seriesId,
      season_number: num,
      title: newSeason.title || null,
    }).select("id").single() as any);
    if (error) return toast.error(error.message);
    setNewSeason({ season_number: "", title: "" });
    setShowNewSeason(false);
    if (data?.id) setActiveSeasonId(data.id);
    load();
  };

  const delSeason = async (id: string) => {
    if (!confirm("Delete season and all its episodes?")) return;
    const { error } = await (supabase.from("seasons" as any).delete().eq("id", id) as any);
    if (error) return toast.error(error.message);
    if (id === activeSeasonId) setActiveSeasonId("");
    load();
  };

  const activeSeason = seasons.find((s) => s.id === activeSeasonId);

  return (
    <div className="px-4 pb-4 pl-10 space-y-3 bg-secondary/20">
      <div className="flex flex-wrap gap-2 items-end pt-3">
        <div className="flex-1 min-w-[200px]">
          <Field label="Select Season">
            <Select value={activeSeasonId} onValueChange={(v) => setActiveSeasonId(v)}>
              <SelectTrigger><SelectValue placeholder={seasons.length ? "Pick a season" : "No seasons yet"} /></SelectTrigger>
              <SelectContent>
                {seasons.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    Season {s.season_number}{s.title ? ` — ${s.title}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Button type="button" variant="outline" onClick={() => setShowNewSeason((v) => !v)}>
          <Plus className="h-4 w-4 mr-1" /> {showNewSeason ? "Cancel" : "New Season"}
        </Button>
        {activeSeason && (
          <Button type="button" size="icon" variant="ghost" onClick={() => delSeason(activeSeason.id)} title="Delete season">
            <Trash2 className="h-4 w-4 text-primary" />
          </Button>
        )}
      </div>
      {showNewSeason && (
        <div className="flex gap-2 items-end glass rounded-xl p-3">
          <div className="w-24"><Field label="Season #"><Input type="number" value={newSeason.season_number} onChange={(e) => setNewSeason({ ...newSeason, season_number: e.target.value })} /></Field></div>
          <div className="flex-1"><Field label="Title (optional)"><Input value={newSeason.title} onChange={(e) => setNewSeason({ ...newSeason, title: e.target.value })} placeholder="e.g. The Beginning" /></Field></div>
          <Button type="button" onClick={addSeason} className="bg-gradient-red shadow-neon"><Plus className="h-4 w-4 mr-1" /> Save</Button>
        </div>
      )}
      {activeSeason ? (
        <div className="glass rounded-xl p-3">
          <div className="text-xs text-muted-foreground mb-2">
            Managing episodes for Season {activeSeason.season_number}{activeSeason.title ? ` — ${activeSeason.title}` : ""}
          </div>
          <EpisodesManager seasonId={activeSeason.id} />
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">Create or pick a season to add episodes.</div>
      )}
    </div>
  );
}

function EpisodesManager({ seasonId }: { seasonId: string }) {
  const [eps, setEps] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [editingEp, setEditingEp] = useState<{ id: string; title: string; episode_number: number } | null>(null);
  const [form, setForm] = useState<any>({});
  const [sourceMode, setSourceMode] = useState<"upload" | "direct" | "telegram">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [directUrl, setDirectUrl] = useState("");
  const [telegramUrl, setTelegramUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Bunny CDN uploads are proxied through the `bunny-upload` edge function (admin-only).

  const load = () =>
    (supabase.from("episodes" as any).select("*").eq("season_id", seasonId).order("episode_number") as any)
      .then(({ data }: any) => setEps(data ?? []));
  useEffect(() => { load(); }, [seasonId]);

  const addEp = async () => {
    if (!form.episode_number || !form.title) return toast.error("Episode number and title required");
    const epNum = Number(form.episode_number);
    const existing = eps.find((e) => Number(e.episode_number) === epNum);
    if (existing) {
      const ok = confirm(
        `Episode ${epNum} already exists for this season ("${existing.title}").\n\nClick OK to overwrite its video, or Cancel to abort.`
      );
      if (!ok) return;
    }
    setUploading(true);
    setProgress(0);
    try {
      let finalUrl = "";
      if (sourceMode === "upload") {
        if (!file) throw new Error("Choose a video file to upload");
        const res = await uploadToTelegram(file, form.title, (p) => setProgress(p));
        finalUrl = res.stream_url;
        setProgress(100);
      } else if (sourceMode === "direct") {
        if (!directUrl.trim() || !/^https?:\/\//i.test(directUrl.trim())) {
          throw new Error("Paste a valid direct video URL (http/https)");
        }
        finalUrl = directUrl.trim();
        setProgress(100);
      } else {
        const tg = telegramUrl.trim();
        if (!tg || !/^https?:\/\//i.test(tg)) {
          throw new Error("Paste a Telegram video stream URL (http/https)");
        }
        finalUrl = tg;
        setProgress(100);
      }

      let error: any;
      if (existing) {
        ({ error } = await (supabase
          .from("episodes" as any)
          .update({ title: form.title, stream_url: finalUrl })
          .eq("id", existing.id) as any));
      } else {
        ({ error } = await (supabase.from("episodes" as any).insert({
          season_id: seasonId,
          episode_number: epNum,
          title: form.title,
          stream_url: finalUrl,
          voe_sx_url: null,
          doodstream_url: null,
          streamtape_url: null,
        }) as any));
      }
      if (error) throw error;

      toast.success(existing ? "Episode overwritten" : "Episode added");
      setForm({});
      setFile(null);
      setDirectUrl("");
      setTelegramUrl("");
      setProgress(0);
      load();
    } catch (err: any) {
      toast.error(err?.message || "Save failed");
    } finally {
      setUploading(false);
    }
  };

  const delEp = async (id: string) => {
    const ep = eps.find((e) => e.id === id);
    if (!confirm(`Delete Episode ${ep?.episode_number} — "${ep?.title ?? ""}"?`)) return;
    const prev = eps;
    setEps((list) => list.filter((e) => e.id !== id));
    const { error } = await (supabase.from("episodes" as any).delete().eq("id", id) as any);
    if (error) { setEps(prev); return toast.error(error.message); }
    toast.success("Episode deleted");
  };

  const saveEpEdit = async () => {
    if (!editingEp) return;
    const { id, title, episode_number } = editingEp;
    const { error } = await (supabase.from("episodes" as any)
      .update({ title, episode_number }).eq("id", id) as any);
    if (error) return toast.error(error.message);
    setEps((list) => list.map((e) => e.id === id ? { ...e, title, episode_number } : e));
    setEditingEp(null);
    toast.success("Episode updated");
  };

  const filteredEps = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return eps;
    return eps.filter((e) =>
      (e.title ?? "").toLowerCase().includes(s) ||
      String(e.episode_number ?? "").includes(s)
    );
  }, [eps, q]);

  return (
    <div className="space-y-2">
      <div className="space-y-2 p-3 rounded-xl bg-background/40 border border-border/30">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Input type="number" placeholder="EP #" value={form.episode_number ?? ""} onChange={(e) => setForm({ ...form, episode_number: e.target.value })} />
          <Input className="sm:col-span-2" placeholder="Episode title" value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <Tabs value={sourceMode} onValueChange={(v) => setSourceMode(v as "upload" | "direct" | "telegram")}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="upload" disabled={uploading}>PC File Upload</TabsTrigger>
            <TabsTrigger value="direct" disabled={uploading}>HLS / M3U8 / MP4</TabsTrigger>
            <TabsTrigger value="telegram" disabled={uploading}>Telegram Link</TabsTrigger>
          </TabsList>
          <TabsContent value="upload" className="pt-2 space-y-1">
            <Input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={uploading} />
            {file && <p className="text-xs text-muted-foreground">{file.name} — {(file.size / (1024 * 1024)).toFixed(1)} MB</p>}
          </TabsContent>
          <TabsContent value="direct" className="pt-2">
            <Input type="url" placeholder="https://example.com/episode.m3u8  or  …/episode.mp4" value={directUrl} onChange={(e) => setDirectUrl(e.target.value)} disabled={uploading} />
          </TabsContent>
          <TabsContent value="telegram" className="pt-2">
            <Input type="url" placeholder="https://t.me/c/.../123  or  https://api.telegram.org/file/bot…/video.mp4" value={telegramUrl} onChange={(e) => setTelegramUrl(e.target.value)} disabled={uploading} />
          </TabsContent>
        </Tabs>
        {uploading && (
          <div className="space-y-1">
            <Progress value={progress} />
            <p className="text-xs text-muted-foreground">{sourceMode === "upload" ? `Uploading to Telegram… ${progress}%` : "Saving…"}</p>
          </div>
        )}
        <Button type="button" onClick={addEp} disabled={uploading} className="bg-gradient-red shadow-neon">
          <Plus className="h-4 w-4 mr-1" /> {uploading ? "Working…" : "Add episode"}
        </Button>
      </div>
      {eps.length > 0 && (
        <div className="flex items-center gap-2 pt-2">
          <Input placeholder="Search episodes…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Badge variant="outline">{filteredEps.length}</Badge>
        </div>
      )}
      {eps.length === 0 ? (
        <div className="text-xs text-muted-foreground">No episodes yet.</div>
      ) : filteredEps.length === 0 ? (
        <div className="text-xs text-muted-foreground">No matches.</div>
      ) : (
        <div className="divide-y divide-border/30">
          {filteredEps.map((ep) => (
            <div key={ep.id} className="py-2 flex items-center justify-between gap-2">
              {editingEp?.id === ep.id ? (
                <>
                  <div className="flex gap-2 flex-1 min-w-0">
                    <Input type="number" className="w-20"
                      value={editingEp.episode_number}
                      onChange={(e) => setEditingEp({ ...editingEp, episode_number: Number(e.target.value) || 0 })} />
                    <Input value={editingEp.title}
                      onChange={(e) => setEditingEp({ ...editingEp, title: e.target.value })} />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEpEdit} className="bg-gradient-red">Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingEp(null)}>Cancel</Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="min-w-0">
                    <div className="text-sm">EP {ep.episode_number} — <span className="font-medium">{ep.title}</span></div>
                    {ep.stream_url && <div className="text-xs text-muted-foreground truncate max-w-[420px]">{ep.stream_url}</div>}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline"
                      onClick={() => setEditingEp({ id: ep.id, title: ep.title, episode_number: ep.episode_number })}>
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => delEp(ep.id)}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}