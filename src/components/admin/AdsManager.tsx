import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Megaphone, Save, Crown, Film, Tv, Plus, Trash2 } from "lucide-react";
import { AdConfig, BreakAd, DEFAULT_AD_CONFIG, fetchAdConfig, formatClock } from "@/lib/ads";

export default function AdsManager() {
  const [cfg, setCfg] = useState<AdConfig>(DEFAULT_AD_CONFIG);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAdConfig().then(setCfg);
  }, []);

  const set = <K extends keyof AdConfig>(key: K, value: AdConfig[K]) => setCfg((c) => ({ ...c, [key]: value }));

  const save = async () => {
    setSaving(true);
    const { error } = await (supabase.from("ad_system" as any).update({ ...cfg }).eq("id", 1) as any);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Ad system saved");
  };

  const addBreakAd = () =>
    set("break_queue", [...cfg.break_queue, { id: crypto.randomUUID(), url: "", title: "", link: "" }]);

  const updateBreakAd = (id: string, patch: Partial<BreakAd>) =>
    set("break_queue", cfg.break_queue.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const removeBreakAd = (id: string) => set("break_queue", cfg.break_queue.filter((a) => a.id !== id));

  const move = (index: number, dir: -1 | 1) => {
    const next = [...cfg.break_queue];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    set("break_queue", next);
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" /> Advanced Ad System
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Toggle
            label="Master Ads Switch"
            hint="Globally enable or disable every ad on the platform."
            checked={cfg.master_enabled}
            onChange={(v) => set("master_enabled", v)}
          />
        </CardContent>
      </Card>

      {/* 1 — External & banner ad networks */}
      <Section title="1 · External & Banner Ad Networks" icon={<Megaphone className="h-5 w-5 text-primary" />}>
        <Toggle label="Network & banner ads enabled" checked={cfg.network_enabled} onChange={(v) => set("network_enabled", v)} />
        <Field label="Sitewide global script (popunder / social bar / loader)">
          <Textarea
            value={cfg.global_scripts}
            onChange={(e) => set("global_scripts", e.target.value)}
            placeholder={`<script src="//pl12345.example.com/invoke.js"></script>`}
            className="font-mono text-xs min-h-[100px]"
          />
        </Field>
        <Field label="Header banner script (top of every page)">
          <Textarea value={cfg.header_banner_script} onChange={(e) => set("header_banner_script", e.target.value)} className="font-mono text-xs min-h-[80px]" />
        </Field>
        <Field label="Section / grid banner script (between content rows)">
          <Textarea value={cfg.grid_banner_script} onChange={(e) => set("grid_banner_script", e.target.value)} className="font-mono text-xs min-h-[80px]" />
        </Field>
        <Field label="Under-player banner script">
          <Textarea value={cfg.under_player_script} onChange={(e) => set("under_player_script", e.target.value)} className="font-mono text-xs min-h-[80px]" />
        </Field>
      </Section>

      {/* 2 — VIP premium spots */}
      <Section title="2 · VIP Premium Spots" icon={<Crown className="h-5 w-5 text-yellow-400" />}>
        <Toggle label="VIP spots enabled" checked={cfg.vip_enabled} onChange={(v) => set("vip_enabled", v)} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Pause Ad Banner — image URL (shown when the viewer pauses)">
            <Input value={cfg.pause_banner_url ?? ""} onChange={(e) => set("pause_banner_url", e.target.value || null)} placeholder="https://…/pause-banner.jpg" />
          </Field>
          <Field label="Pause banner click URL">
            <Input value={cfg.pause_banner_link ?? ""} onChange={(e) => set("pause_banner_link", e.target.value || null)} placeholder="https://advertiser.com" />
          </Field>
          <Field label="Hero VIP Banner — image URL (top of home page)">
            <Input value={cfg.hero_banner_url ?? ""} onChange={(e) => set("hero_banner_url", e.target.value || null)} placeholder="https://…/hero.jpg" />
          </Field>
          <Field label="Hero banner click URL">
            <Input value={cfg.hero_banner_link ?? ""} onChange={(e) => set("hero_banner_link", e.target.value || null)} />
          </Field>
          <Field label="Room Takeover Background — image URL (watch rooms)">
            <Input value={cfg.room_takeover_url ?? ""} onChange={(e) => set("room_takeover_url", e.target.value || null)} placeholder="https://…/takeover.jpg" />
          </Field>
        </div>
        <PreviewRow urls={[cfg.pause_banner_url, cfg.hero_banner_url, cfg.room_takeover_url]} />
      </Section>

      {/* 3 — Timeline video ads */}
      <Section title="3 · Timeline Video Ads" icon={<Film className="h-5 w-5 text-primary" />}>
        <Toggle label="Pre-roll & post-roll enabled" checked={cfg.timeline_enabled} onChange={(v) => set("timeline_enabled", v)} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Pre-roll video URL (plays before the movie)">
            <Input value={cfg.preroll_url ?? ""} onChange={(e) => set("preroll_url", e.target.value || null)} placeholder="https://…/preroll.mp4" />
          </Field>
          <Field label="Pre-roll click URL">
            <Input value={cfg.preroll_link ?? ""} onChange={(e) => set("preroll_link", e.target.value || null)} />
          </Field>
          <Field label="Post-roll video URL (plays when the movie ends)">
            <Input value={cfg.postroll_url ?? ""} onChange={(e) => set("postroll_url", e.target.value || null)} placeholder="https://…/postroll.mp4" />
          </Field>
          <Field label="Post-roll click URL">
            <Input value={cfg.postroll_link ?? ""} onChange={(e) => set("postroll_link", e.target.value || null)} />
          </Field>
          <Field label="Skip Ad Timer (seconds)">
            <Input type="number" min={0} value={cfg.skip_seconds} onChange={(e) => set("skip_seconds", Number(e.target.value) || 0)} />
          </Field>
        </div>
      </Section>

      {/* 4 — TV commercial break */}
      <Section title="4 · TV Commercial Break (Mid-roll Queue)" icon={<Tv className="h-5 w-5 text-primary" />}>
        <Toggle label="Commercial break enabled" checked={cfg.break_enabled} onChange={(v) => set("break_enabled", v)} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label={`Trigger time (seconds into the movie) — ${formatClock(cfg.break_trigger_seconds)}`}>
            <Input type="number" min={5} value={cfg.break_trigger_seconds} onChange={(e) => set("break_trigger_seconds", Number(e.target.value) || 0)} />
          </Field>
          <Field label="Static Hook Image URL (break intro screen)">
            <Input value={cfg.hook_image_url ?? ""} onChange={(e) => set("hook_image_url", e.target.value || null)} placeholder="https://…/break-logo.jpg" />
          </Field>
          <Field label="Hook image duration (seconds)">
            <Input type="number" min={1} value={cfg.hook_duration_seconds} onChange={(e) => set("hook_duration_seconds", Number(e.target.value) || 5)} />
          </Field>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Ad Playlist (plays in order, then the movie resumes)</Label>
            <Button type="button" size="sm" variant="outline" onClick={addBreakAd} className="glass">
              <Plus className="h-4 w-4" /> Add ad
            </Button>
          </div>
          {cfg.break_queue.length === 0 && (
            <div className="text-xs text-muted-foreground italic">No ads queued yet.</div>
          )}
          {cfg.break_queue.map((ad, i) => (
            <div key={ad.id} className="p-3 rounded-xl border border-border/40 bg-secondary/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-widest text-primary">Ad {i + 1}</span>
                <div className="flex items-center gap-1">
                  <Button type="button" size="sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}>↑</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => move(i, 1)} disabled={i === cfg.break_queue.length - 1}>↓</Button>
                  <Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={() => removeBreakAd(ad.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Input value={ad.url} onChange={(e) => updateBreakAd(ad.id, { url: e.target.value })} placeholder="Video URL (mp4)" />
                <Input value={ad.title ?? ""} onChange={(e) => updateBreakAd(ad.id, { title: e.target.value })} placeholder="Title (internal)" />
                <Input value={ad.link ?? ""} onChange={(e) => updateBreakAd(ad.id, { link: e.target.value })} placeholder="Click URL" />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Button onClick={save} disabled={saving} className="bg-gradient-red shadow-neon">
        <Save className="h-4 w-4" /> Save Ad System
      </Button>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">{icon} {title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/40 border border-border/40">
      <div>
        <Label className="text-sm">{label}</Label>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function PreviewRow({ urls }: { urls: (string | null)[] }) {
  const list = urls.filter(Boolean) as string[];
  if (!list.length) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {list.map((u) => (
        <img key={u} src={u} alt="" className="w-full h-28 object-cover rounded-lg border border-border/40 bg-black" />
      ))}
    </div>
  );
}
