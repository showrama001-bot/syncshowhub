import { sanitizeMessage, sanitizeBody, sanitizeTitle, sanitizeUrl } from "@/lib/sanitize";
import { checkRate, RATE_RULES, rateMessage } from "@/lib/submitGuard";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Newspaper, Heart, MessageCircle, ImagePlus, Send, Trash2, Film, Clapperboard, PlaySquare, Search, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GridBanner } from "@/components/ads/GridBanner";
import { toast } from "sonner";

type Post = {
  id: string;
  user_id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  likes: number;
  liked: boolean;
  comment_count: number;
  attachment_kind: "movie" | "series" | "reel" | "trailer" | null;
  attachment_id: string | null;
  attachment_title: string | null;
  attachment_thumb: string | null;
  author?: { username?: string; display_name?: string; avatar_url?: string };
};

type CatalogItem = {
  kind: "movie" | "series" | "reel" | "trailer";
  id: string;
  title: string;
  thumb: string | null;
};

export default function Accueil() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploadingImg, setUploadingImg] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [posting, setPosting] = useState(false);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQ, setPickerQ] = useState("");
  const [attachment, setAttachment] = useState<CatalogItem | null>(null);

  const load = async () => {
    if (!user) return;
    const { data: rows } = await (supabase.from("feed_posts" as any) as any)
      .select("*").order("created_at", { ascending: false }).limit(60);
    const list = (rows || []) as any[];
    const ids = list.map(p => p.id);
    const authorIds = Array.from(new Set(list.map(p => p.user_id)));
    const [{ data: likes }, { data: myLikes }, { data: comments }, { data: profs }] = await Promise.all([
      (supabase.from("feed_likes" as any) as any).select("post_id").in("post_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      (supabase.from("feed_likes" as any) as any).select("post_id").eq("user_id", user.id).in("post_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      (supabase.from("feed_comments" as any) as any).select("post_id").in("post_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      authorIds.length
        ? supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", authorIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const likeMap: Record<string, number> = {};
    (likes || []).forEach((l: any) => { likeMap[l.post_id] = (likeMap[l.post_id] || 0) + 1; });
    const mine = new Set((myLikes || []).map((l: any) => l.post_id));
    const cMap: Record<string, number> = {};
    (comments || []).forEach((c: any) => { cMap[c.post_id] = (cMap[c.post_id] || 0) + 1; });
    const authorMap: Record<string, any> = {};
    (profs || []).forEach((p: any) => { authorMap[p.id] = p; });
    setPosts(list.map(p => ({
      ...p,
      likes: likeMap[p.id] || 0,
      liked: mine.has(p.id),
      comment_count: cMap[p.id] || 0,
      author: authorMap[p.user_id],
    })));
  };

  useEffect(() => {
    load();
    loadCatalog();
    const ch = supabase.channel("feed-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "feed_posts" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "feed_likes" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "feed_comments" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const loadCatalog = async () => {
    const [{ data: mv }, { data: sr }, rls, tls] = await Promise.all([
      supabase.from("movies").select("id, title, poster_url").order("title").limit(500),
      (supabase.from("series" as any).select("id, title, poster_url").order("title").limit(500) as any),
      (supabase.from("reels" as any) as any).select("id, title, poster_url, youtube_id").order("created_at", { ascending: false }).limit(200),
      (supabase.from("trailers" as any) as any).select("id, movie_title, youtube_url").order("created_at", { ascending: false }).limit(200),
    ]);
    const items: CatalogItem[] = [];
    (mv || []).forEach((m: any) => items.push({ kind: "movie", id: m.id, title: m.title, thumb: m.poster_url }));
    (sr || []).forEach((s: any) => items.push({ kind: "series", id: s.id, title: s.title, thumb: s.poster_url }));
    (rls.data || []).forEach((r: any) => items.push({ kind: "reel", id: r.id, title: r.title || "Reel", thumb: r.poster_url || (r.youtube_id ? `https://i.ytimg.com/vi/${r.youtube_id}/hqdefault.jpg` : null) }));
    (tls.data || []).forEach((t: any) => {
      const m = String(t.youtube_url || "").match(/[?&]v=([A-Za-z0-9_-]{6,})/);
      items.push({ kind: "trailer", id: t.id, title: t.movie_title || "Trailer", thumb: m ? `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` : null });
    });
    setCatalog(items);
  };

  const submit = async () => {
    if (!user) return toast.error("Sign in to post");
    const cleanContent = sanitizeBody(content);
    const cleanImage = sanitizeUrl(imageUrl);
    if (!cleanContent && !cleanImage && !attachment) return;
    if (imageUrl.trim() && !cleanImage) return toast.error("Image link must be a valid http(s) URL");
    const rl = checkRate(`post:${user.id}`, RATE_RULES.post);
    if (!rl.ok) return toast.error(rateMessage(rl));
    setPosting(true);
    const { error } = await (supabase.from("feed_posts" as any) as any).insert({
      user_id: user.id,
      content: cleanContent || null,
      image_url: cleanImage,
      attachment_kind: attachment?.kind ?? null,
      attachment_id: attachment?.id ?? null,
      attachment_title: attachment?.title ? sanitizeTitle(attachment.title) : null,
      attachment_thumb: attachment?.thumb ?? null,
    });
    setPosting(false);
    if (error) return toast.error(error.message);
    setContent(""); setImageUrl(""); setAttachment(null); setPickerOpen(false); setPickerQ("");
  };

  const onPickFile = async (file: File) => {
    if (!user) return toast.error("Sign in to upload");
    if (!file.type.startsWith("image/")) return toast.error("Please pick an image");
    if (file.size > 8 * 1024 * 1024) return toast.error("Max 8 MB");
    setUploadingImg(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("feed-images").upload(path, file, { cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage.from("feed-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      if (sErr || !signed?.signedUrl) throw sErr || new Error("Sign failed");
      setImageUrl(signed.signedUrl);
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploadingImg(false);
    }
  };

  const toggleLike = async (p: Post) => {
    if (!user) return;
    if (p.liked) {
      await (supabase.from("feed_likes" as any) as any).delete().eq("post_id", p.id).eq("user_id", user.id);
    } else {
      await (supabase.from("feed_likes" as any) as any).insert({ post_id: p.id, user_id: user.id });
    }
  };

  const del = async (p: Post) => {
    if (!user || p.user_id !== user.id) return;
    await (supabase.from("feed_posts" as any) as any).delete().eq("id", p.id);
  };

  // Injected banner ad every 3 posts.
  const interleaved = useMemo(() => {
    const out: Array<{ type: "post"; post: Post } | { type: "ad"; k: string }> = [];
    posts.forEach((p, i) => {
      out.push({ type: "post", post: p });
      if ((i + 1) % 3 === 0) out.push({ type: "ad", k: `ad-${i}` });
    });
    return out;
  }, [posts]);

  return (
    <div className="pt-20 px-4 md:px-6 max-w-2xl mx-auto pb-16">
      <header className="mb-6">
        <h1 className="font-display text-3xl md:text-4xl tracking-wider neon-text flex items-center gap-3">
          <Newspaper className="h-7 w-7" /> Accueil
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Say what you're watching. React. Comment.</p>
      </header>

      {/* Composer */}
      <div className="glass rounded-2xl p-4 space-y-3 mb-6">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What are you watching?"
          className="bg-secondary/40 resize-none min-h-[80px]"
          maxLength={1000}
        />
        {imageUrl && (
          <div className="relative rounded-xl overflow-hidden border border-border/40 bg-black/40">
            <img src={imageUrl} alt="" className="w-full max-h-72 object-contain" />
            <button
              onClick={() => setImageUrl("")}
              className="absolute top-2 right-2 rounded-full bg-background/80 hover:bg-background p-1.5 border border-border/60"
              aria-label="Remove image"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {attachment && (
          <div className="flex items-center gap-3 rounded-xl bg-secondary/40 border border-primary/30 p-2">
            <div className="w-10 h-14 rounded overflow-hidden bg-black/40">
              {attachment.thumb && <img src={attachment.thumb} alt="" className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-primary">{attachment.kind}</div>
              <div className="text-sm truncate">{attachment.title}</div>
            </div>
            <button onClick={() => setAttachment(null)} className="text-muted-foreground hover:text-destructive p-1"><X className="h-4 w-4" /></button>
          </div>
        )}
        {pickerOpen && !attachment && (
          <div className="rounded-xl border border-border/40 bg-background/60 p-2 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input autoFocus value={pickerQ} onChange={(e) => setPickerQ(e.target.value)} placeholder="Search movies, series, reels, trailers…" className="pl-9 bg-secondary/40" />
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-border/30">
              {catalog
                .filter((c) => !pickerQ.trim() || c.title.toLowerCase().includes(pickerQ.toLowerCase()))
                .slice(0, 20)
                .map((c) => (
                  <button key={`${c.kind}-${c.id}`} onClick={() => { setAttachment(c); setPickerOpen(false); }} className="w-full flex items-center gap-3 px-2 py-2 hover:bg-secondary/60 text-left">
                    <div className="w-8 h-11 rounded bg-black/40 overflow-hidden shrink-0">
                      {c.thumb && <img src={c.thumb} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{c.title}</div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{c.kind}</div>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickFile(f); e.currentTarget.value = ""; }}
            />
            <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()} disabled={uploadingImg}>
              {uploadingImg ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ImagePlus className="h-4 w-4 mr-1" />}
              {uploadingImg ? "Uploading…" : "Photo"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPickerOpen(v => !v)}>
              <Film className="h-4 w-4 mr-1" /> Attach
            </Button>
          </div>
          <Button size="sm" className="bg-gradient-red shadow-neon" onClick={submit} disabled={posting}>
            <Send className="h-4 w-4 mr-1" /> Post
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {interleaved.length === 0 && (
          <div className="glass rounded-2xl p-8 text-center text-muted-foreground">Be the first to post.</div>
        )}
        {interleaved.map((item) =>
          item.type === "ad" ? (
            <GridBanner key={item.k} />
          ) : (
            <PostCard key={item.post.id} post={item.post} onLike={() => toggleLike(item.post)} onDelete={() => del(item.post)} me={user?.id} />
          )
        )}
      </div>
    </div>
  );
}

function PostCard({ post, onLike, onDelete, me }: { post: Post; onLike: () => void; onDelete: () => void; me?: string }) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!showComments) return;
    (async () => {
      const { data } = await (supabase.from("feed_comments" as any) as any)
        .select("*").eq("post_id", post.id).order("created_at", { ascending: true });
    const authorIds = Array.from(new Set((data || []).map((c: any) => c.user_id as string))) as string[];
      const { data: profs } = authorIds.length
        ? await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", authorIds)
        : { data: [] as any[] };
      const map: Record<string, any> = {};
      (profs || []).forEach((p: any) => { map[p.id] = p; });
      setComments((data || []).map((c: any) => ({ ...c, author: map[c.user_id] })));
    })();
  }, [showComments, post.id, post.comment_count]);

  const send = async () => {
    const content = sanitizeMessage(text);
    if (!me || !content) return;
    const rl = checkRate(`comment:${post.id}`, RATE_RULES.comment);
    if (!rl.ok) return toast.error(rateMessage(rl));
    await (supabase.from("feed_comments" as any) as any).insert({ post_id: post.id, user_id: me, content });
    setText("");
  };

  const name = post.author?.display_name || post.author?.username || "User";
  return (
    <article className="glass rounded-2xl p-4">
      <header className="flex items-center gap-3 mb-3">
        <Avatar className="h-9 w-9">
          <AvatarImage src={post.author?.avatar_url} />
          <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{name}</div>
          <div className="text-[11px] text-muted-foreground">{new Date(post.created_at).toLocaleString()}</div>
        </div>
        {me === post.user_id && (
          <button onClick={onDelete} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
        )}
      </header>
      {post.content && <p className="text-sm whitespace-pre-wrap break-words mb-3">{post.content}</p>}
      {post.image_url && (
        <div className="rounded-xl overflow-hidden mb-3 bg-black/40">
          <img src={post.image_url} alt="" className="w-full max-h-[520px] object-contain" loading="lazy" />
        </div>
      )}
      {post.attachment_kind && post.attachment_id && (
        <AttachmentCard
          kind={post.attachment_kind}
          id={post.attachment_id}
          title={post.attachment_title || ""}
          thumb={post.attachment_thumb}
        />
      )}
      <div className="flex items-center gap-4 text-sm">
        <button onClick={onLike} className={`flex items-center gap-1 ${post.liked ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
          <Heart className={`h-4 w-4 ${post.liked ? "fill-current" : ""}`} /> {post.likes}
        </button>
        <button onClick={() => setShowComments(v => !v)} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
          <MessageCircle className="h-4 w-4" /> {post.comment_count}
        </button>
      </div>
      {showComments && (
        <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="text-sm flex gap-2">
              <span className="text-primary font-semibold">{c.author?.display_name || c.author?.username || "User"}:</span>
              <span className="flex-1 break-words">{c.content}</span>
            </div>
          ))}
          <div className="flex gap-2">
            <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Write a comment…" className="bg-secondary/40" />
            <Button size="sm" onClick={send} className="bg-gradient-red"><Send className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </article>
  );
}

function AttachmentCard({ kind, id, title, thumb }: { kind: "movie" | "series" | "reel" | "trailer"; id: string; title: string; thumb: string | null }) {
  const to =
    kind === "movie" ? `/play/movie/${id}` :
    kind === "series" ? `/play/series/${id}` :
    kind === "reel" ? `/reels?id=${id}` :
    `/trailers?id=${id}`;
  const Icon = kind === "reel" ? PlaySquare : kind === "trailer" ? Clapperboard : Film;
  return (
    <Link to={to} className="block mb-3 rounded-xl overflow-hidden border border-primary/30 bg-black/40 hover:border-primary transition group">
      <div className="flex">
        <div className="w-28 sm:w-36 aspect-[2/3] bg-black shrink-0 overflow-hidden">
          {thumb
            ? <img src={thumb} alt="" className="w-full h-full object-cover group-hover:scale-105 transition" loading="lazy" />
            : <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Icon className="h-8 w-8" /></div>}
        </div>
        <div className="p-3 flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-primary flex items-center gap-1"><Icon className="h-3 w-3" /> {kind}</div>
            <div className="font-semibold text-sm sm:text-base mt-1 line-clamp-2">{title}</div>
          </div>
          <div className="text-xs text-primary group-hover:underline mt-2">▶ Watch now</div>
        </div>
      </div>
    </Link>
  );
}

