import { useEffect, useMemo, useState } from "react";
import { Newspaper, Heart, MessageCircle, Image as ImageIcon, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { fetchAdsAssets, fetchAdsSettings, pickWeighted, type AdAsset } from "@/lib/ads";
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
  author?: { username?: string; display_name?: string; avatar_url?: string };
};

export default function Accueil() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [showImage, setShowImage] = useState(false);
  const [posting, setPosting] = useState(false);
  const [ads, setAds] = useState<AdAsset[]>([]);
  const [adsOn, setAdsOn] = useState(true);

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
    Promise.all([fetchAdsAssets(), fetchAdsSettings()]).then(([a, s]) => {
      setAds(a); setAdsOn(!!s.master_enabled);
    });
    const ch = supabase.channel("feed-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "feed_posts" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "feed_likes" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "feed_comments" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const submit = async () => {
    if (!user) return toast.error("Sign in to post");
    if (!content.trim() && !imageUrl.trim()) return;
    setPosting(true);
    const { error } = await (supabase.from("feed_posts" as any) as any).insert({
      user_id: user.id, content: content.trim() || null, image_url: imageUrl.trim() || null,
    });
    setPosting(false);
    if (error) return toast.error(error.message);
    setContent(""); setImageUrl(""); setShowImage(false);
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
    const out: Array<{ type: "post"; post: Post } | { type: "ad"; ad: AdAsset; k: string }> = [];
    posts.forEach((p, i) => {
      out.push({ type: "post", post: p });
      if (adsOn && (i + 1) % 3 === 0) {
        const ad = pickWeighted(ads, "banner_grid");
        if (ad) out.push({ type: "ad", ad, k: `ad-${i}` });
      }
    });
    return out;
  }, [posts, ads, adsOn]);

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
        {showImage && (
          <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Paste an image URL (https://…)" className="bg-secondary/40" />
        )}
        <div className="flex items-center justify-between">
          <Button size="sm" variant="ghost" onClick={() => setShowImage(v => !v)}>
            <ImageIcon className="h-4 w-4 mr-1" /> {showImage ? "Remove image" : "Add image"}
          </Button>
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
            <FeedAdCard key={item.k} ad={item.ad} />
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
      const authorIds = Array.from(new Set((data || []).map((c: any) => c.user_id)));
      const { data: profs } = authorIds.length
        ? await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", authorIds)
        : { data: [] as any[] };
      const map: Record<string, any> = {};
      (profs || []).forEach((p: any) => { map[p.id] = p; });
      setComments((data || []).map((c: any) => ({ ...c, author: map[c.user_id] })));
    })();
  }, [showComments, post.id, post.comment_count]);

  const send = async () => {
    if (!me || !text.trim()) return;
    await (supabase.from("feed_comments" as any) as any).insert({ post_id: post.id, user_id: me, content: text.trim().slice(0, 500) });
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

function FeedAdCard({ ad }: { ad: AdAsset }) {
  const body = (
    <div className="glass rounded-2xl overflow-hidden border border-primary/30">
      <div className="px-3 py-1 text-[10px] uppercase tracking-widest text-primary bg-primary/10">Sponsored</div>
      {ad.media_type === "video" && ad.media_url ? (
        <video src={ad.media_url} muted playsInline autoPlay loop className="w-full max-h-[360px] object-cover" />
      ) : ad.media_url ? (
        <img src={ad.media_url} alt={ad.title || "ad"} className="w-full max-h-[360px] object-cover" loading="lazy" />
      ) : null}
      {ad.title && <div className="px-3 py-2 text-sm font-medium">{ad.title}</div>}
    </div>
  );
  return ad.redirect_url
    ? <a href={ad.redirect_url} target="_blank" rel="noopener noreferrer sponsored">{body}</a>
    : body;
}