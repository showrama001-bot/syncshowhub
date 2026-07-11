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

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) setP(data);
    });
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
      <p className="text-sm text-muted-foreground mb-8">{user?.email} {isAdmin && <span className="ml-2 text-primary">· Admin</span>}</p>
      <div className="glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20 ring-2 ring-primary/40">
            <AvatarImage src={p.avatar_url} />
            <AvatarFallback>{(p.display_name || p.username || user?.email || "?").slice(0,1).toUpperCase()}</AvatarFallback>
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