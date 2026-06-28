import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Trash2, Plus, Save, Megaphone, Code2, Image as ImageIcon } from "lucide-react";
import { AdAsset, AdsSettings, AdPlacement, DEFAULT_SETTINGS } from "@/lib/ads";

const PLACEMENT_LABELS: Record<AdPlacement, string> = {
  preroll: "Pre-roll Video Ad (before content plays)",
  popup: "Pop-up Video/Image Ad (periodic overlay)",
  banner_header: "Header Banner (top of every page)",
  banner_grid: "Grid Banner (between movie cards)",
  banner_under_player: "Under-Player Banner (below video)",
  interstitial: "Interstitial / Redirect Banner",
};

const PLACEMENTS = Object.keys(PLACEMENT_LABELS) as AdPlacement[];

export default function AdsManager() {
  const [settings, setSettings] = useState<AdsSettings>(DEFAULT_SETTINGS);
  const [assets, setAssets] = useState<AdAsset[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [{ data: s }, { data: a }] = await Promise.all([
      (supabase.from("ads_settings" as any).select("*").eq("id", 1).maybeSingle() as any),
      (supabase.from("ads_assets" as any).select("*").order("created_at", { ascending: false }) as any),
    ]);
    if (s) setSettings(s as AdsSettings);
    if (a) setAssets(a as AdAsset[]);
  };

  useEffect(() => { load(); }, []);

  const saveSettings = async () => {
    setSaving(true);
    const { error } = await (supabase.from("ads_settings" as any).update(settings).eq("id", 1) as any);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Ad settings saved");
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" /> Master Ad Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 rounded-xl bg-primary/10 border border-primary/30">
            <div>
              <div className="font-semibold">Master Ads Switch</div>
              <div className="text-xs text-muted-foreground">Globally enable or disable every ad on the platform.</div>
            </div>
            <Switch
              checked={settings.master_enabled}
              onCheckedChange={(v) => setSettings({ ...settings, master_enabled: v })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SettingRow
              label="Pre-roll Ads Enabled"
              checked={settings.preroll_enabled}
              onCheckedChange={(v) => setSettings({ ...settings, preroll_enabled: v })}
            />
            <NumberField
              label="Pre-roll Skip Countdown (sec)"
              value={settings.preroll_skip_seconds}
              onChange={(v) => setSettings({ ...settings, preroll_skip_seconds: v })}
            />
            <SettingRow
              label="Pop-up Ads Enabled"
              checked={settings.popup_enabled}
              onCheckedChange={(v) => setSettings({ ...settings, popup_enabled: v })}
            />
            <NumberField
              label="Pop-up Frequency (sec)"
              value={settings.popup_interval_seconds}
              onChange={(v) => setSettings({ ...settings, popup_interval_seconds: v })}
            />
            <NumberField
              label="Pop-up Lock Duration (sec)"
              value={settings.popup_duration_seconds}
              onChange={(v) => setSettings({ ...settings, popup_duration_seconds: v })}
            />
            <NumberField
              label="Interstitial Wait (sec)"
              value={settings.interstitial_seconds}
              onChange={(v) => setSettings({ ...settings, interstitial_seconds: v })}
            />
            <SettingRow
              label="Anti-AdBlock Detection"
              checked={settings.antiadblock_enabled}
              onCheckedChange={(v) => setSettings({ ...settings, antiadblock_enabled: v })}
            />
          </div>

          <Button onClick={saveSettings} disabled={saving} className="bg-gradient-red shadow-neon">
            <Save className="h-4 w-4" /> Save Settings
          </Button>

          <div className="space-y-2 pt-4 border-t border-border/40">
            <Label className="text-sm font-semibold">Sitewide Global Ad Scripts</Label>
            <p className="text-xs text-muted-foreground">
              Paste Adsterra / PropellerAds Popunder, Social Bar, or Direct Link loaders. Injected once on every page.
            </p>
            <Textarea
              value={settings.global_scripts ?? ""}
              onChange={(e) => setSettings({ ...settings, global_scripts: e.target.value })}
              placeholder={`<script src="//pl12345.example.com/invoke.js"></script>`}
              className="font-mono text-xs min-h-[120px]"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">Anti-AdBlock Message</Label>
            <Textarea
              value={settings.antiadblock_message ?? ""}
              onChange={(e) => setSettings({ ...settings, antiadblock_message: e.target.value })}
              placeholder="Please whitelist our site to continue…"
              className="min-h-[80px]"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ad Assets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <NewAssetForm onCreated={load} />
          {PLACEMENTS.map((p) => {
            const list = assets.filter((a) => a.placement === p);
            return (
              <div key={p} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="uppercase tracking-wider">{p}</Badge>
                  <span className="text-sm text-muted-foreground">{PLACEMENT_LABELS[p]}</span>
                </div>
                {list.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic px-2">No assets yet.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {list.map((a) => (
                      <AssetCard key={a.id} asset={a} onChanged={load} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function SettingRow({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/40 border border-border/40">
      <Label className="text-sm">{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type="number" min={0} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </div>
  );
}

function NewAssetForm({ onCreated }: { onCreated: () => void }) {
  const [placement, setPlacement] = useState<AdPlacement>("banner_grid");
  const [ad_mode, setAdMode] = useState<"direct" | "script">("direct");
  const [media_type, setMediaType] = useState<"video" | "image">("image");
  const [media_url, setMediaUrl] = useState("");
  const [script_code, setScriptCode] = useState("");
  const [redirect_url, setRedirectUrl] = useState("");
  const [title, setTitle] = useState("");
  const [weight, setWeight] = useState(1);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (ad_mode === "direct" && !media_url) { toast.error("Media URL required"); return; }
    if (ad_mode === "script" && !script_code.trim()) { toast.error("Script / HTML snippet required"); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase.from("ads_assets" as any).insert({
      placement,
      ad_mode,
      media_type,
      media_url: ad_mode === "direct" ? media_url : null,
      script_code: ad_mode === "script" ? script_code : null,
      redirect_url: redirect_url || null,
      title: title || null,
      weight,
      active: true,
      created_by: user?.id,
    }) as any);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Ad asset added");
    setMediaUrl(""); setScriptCode(""); setRedirectUrl(""); setTitle(""); setWeight(1);
    onCreated();
  };

  return (
    <div className="p-4 rounded-xl border border-dashed border-primary/40 bg-secondary/20 space-y-3">
      <div className="flex items-center gap-2 font-semibold"><Plus className="h-4 w-4" /> Add new ad asset</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Placement</Label>
          <Select value={placement} onValueChange={(v) => setPlacement(v as AdPlacement)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PLACEMENTS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Ad Source Mode</Label>
          <Select value={ad_mode} onValueChange={(v) => setAdMode(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="direct">Direct media (MP4 / image URL)</SelectItem>
              <SelectItem value="script">Network script / HTML / iframe</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {ad_mode === "direct" ? (
          <>
            <div>
              <Label className="text-xs">Media Type</Label>
              <Select value={media_type} onValueChange={(v) => setMediaType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">Image (banner)</SelectItem>
                  <SelectItem value="video">Video (mp4)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Click-through URL (redirect)</Label>
              <Input value={redirect_url} onChange={(e) => setRedirectUrl(e.target.value)} placeholder="https://advertiser.com" />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Media URL</Label>
              <Input value={media_url} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://…/banner.jpg or ad.mp4" />
            </div>
          </>
        ) : (
          <div className="md:col-span-2">
            <Label className="text-xs flex items-center gap-1"><Code2 className="h-3 w-3" /> Ad Network Snippet (HTML / JS / iframe / VAST)</Label>
            <Textarea
              value={script_code}
              onChange={(e) => setScriptCode(e.target.value)}
              placeholder={`<script async src="//www.example-ads.com/tag.js" data-zone="12345"></script>`}
              className="font-mono text-xs min-h-[120px]"
            />
          </div>
        )}
        <div>
          <Label className="text-xs">Title (internal)</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Weight (rotation)</Label>
          <Input type="number" min={1} value={weight} onChange={(e) => setWeight(Number(e.target.value) || 1)} />
        </div>
      </div>
      <Button onClick={submit} disabled={busy} className="bg-gradient-red shadow-neon">
        <Plus className="h-4 w-4" /> Add Asset
      </Button>
    </div>
  );
}

function AssetCard({ asset, onChanged }: { asset: AdAsset; onChanged: () => void }) {
  const toggle = async () => {
    await (supabase.from("ads_assets" as any).update({ active: !asset.active }).eq("id", asset.id) as any);
    onChanged();
  };
  const remove = async () => {
    if (!confirm("Delete this ad asset?")) return;
    await (supabase.from("ads_assets" as any).delete().eq("id", asset.id) as any);
    onChanged();
  };
  return (
    <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
      <div className="aspect-video bg-black grid place-items-center">
        {asset.ad_mode === "script" ? (
          <div className="text-center p-3 text-xs text-muted-foreground">
            <Code2 className="h-6 w-6 mx-auto mb-1 text-primary" />
            Network script ad
          </div>
        ) : asset.media_type === "image" && asset.media_url ? (
          <img src={asset.media_url} alt={asset.title ?? ""} className="w-full h-full object-cover" />
        ) : asset.media_url ? (
          <video src={asset.media_url} muted className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="h-6 w-6 text-muted-foreground" />
        )}
      </div>
      <div className="p-3 space-y-2">
        <div className="text-sm font-medium truncate">
          {asset.title || asset.media_url || (asset.ad_mode === "script" ? "Script ad" : "Ad")}
        </div>
        {asset.redirect_url && (
          <div className="text-[11px] text-muted-foreground truncate">→ {asset.redirect_url}</div>
        )}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <Switch checked={asset.active} onCheckedChange={toggle} />
            <span className="text-xs">{asset.active ? "Active" : "Paused"}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={remove} className="text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}