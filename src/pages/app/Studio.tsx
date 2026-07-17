import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Eye, EyeOff, Send, Radio, Users, Video, Settings } from "lucide-react";
import { toast } from "sonner";

const RTMP_URL = "rtmp://stream.syncshow.com/live";
const STREAM_KEY = "sk_live_9c031ce6_4948_4dea_9e93_627de32828b1";
const REACTIONS = ["🔥", "😂", "😮", "❤️", "👏", "🎉", "💯", "😢"] as const;

type ChatMsg = { id: string; user: string; text: string; color: string };

const seedChat: ChatMsg[] = [
  { id: "1", user: "NovaKing", text: "yo the stream looks 🔥", color: "text-primary" },
  { id: "2", user: "Zara_88", text: "quality is insane 👏", color: "text-emerald-400" },
  { id: "3", user: "Dr_Neon", text: "who's the host?", color: "text-sky-400" },
  { id: "4", user: "PixelWolf", text: "GG 🎉", color: "text-amber-400" },
  { id: "5", user: "Luma", text: "turn up the mic pls", color: "text-fuchsia-400" },
];

export default function Studio() {
  const [showKey, setShowKey] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>(seedChat);
  const [draft, setDraft] = useState("");

  const copy = async (val: string, label: string) => {
    try {
      await navigator.clipboard.writeText(val);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  };

  const send = (text: string) => {
    const t = text.trim();
    if (!t) return;
    setMessages((m) => [
      ...m,
      { id: `${Date.now()}`, user: "You", text: t, color: "text-primary" },
    ]);
    setDraft("");
  };

  return (
    <div className="min-h-screen bg-background text-foreground pt-16 pb-10 px-4 md:px-8">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-red grid place-items-center shadow-neon">
              <Radio className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-2xl md:text-3xl neon-text tracking-wider">
                LIVE STUDIO
              </h1>
              <p className="text-xs text-muted-foreground">
                Broadcast in real-time to your audience
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Server connected
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          {/* LEFT: Player + Settings */}
          <div className="space-y-6 min-w-0">
            {/* Player */}
            <Card className="relative overflow-hidden aspect-video bg-black border-border/60 shadow-card">
              {/* Ambient gradient */}
              <div className="absolute inset-0 bg-gradient-hero" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.25),transparent_60%)]" />

              {/* Center placeholder */}
              <div className="absolute inset-0 grid place-items-center">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="w-20 h-20 rounded-full glass grid place-items-center neon-border animate-pulse-glow">
                    <Video className="w-9 h-9 text-primary" />
                  </div>
                  <div className="font-display text-lg tracking-widest text-foreground/80">
                    WAITING FOR SIGNAL
                  </div>
                  <div className="text-xs text-muted-foreground max-w-xs">
                    Configure OBS with your RTMP URL and Stream Key below to go live.
                  </div>
                </div>
              </div>

              {/* LIVE badge */}
              <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/90 backdrop-blur-sm shadow-neon">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
                </span>
                <span className="font-display text-xs font-bold text-white tracking-widest">
                  LIVE
                </span>
              </div>

              {/* Viewer counter */}
              <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-white/10">
                <Users className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium tabular-nums">1,245 watching</span>
              </div>

              {/* Bottom bar */}
              <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between">
                <div className="text-sm">
                  <div className="font-semibold">My First Livestream</div>
                  <div className="text-xs text-muted-foreground">Starting soon…</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-[10px] px-2 py-1 rounded bg-white/5 border border-white/10 text-muted-foreground uppercase tracking-wider">
                    1080p · 60fps
                  </div>
                </div>
              </div>
            </Card>

            {/* Stream Settings */}
            <Card className="p-4 md:p-6 bg-card/60 backdrop-blur border-border/60">
              <Tabs defaultValue="stream">
                <TabsList className="bg-secondary/40">
                  <TabsTrigger value="stream" className="gap-2">
                    <Settings className="w-4 h-4" /> Stream Settings
                  </TabsTrigger>
                  <TabsTrigger value="info">Stream Info</TabsTrigger>
                </TabsList>

                <TabsContent value="stream" className="mt-5 space-y-5">
                  <div className="text-xs text-muted-foreground">
                    Paste these values into OBS → Settings → Stream to connect.
                  </div>

                  {/* RTMP URL */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      RTMP Server URL
                    </label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={RTMP_URL}
                        className="font-mono text-sm bg-background/60"
                      />
                      <Button
                        variant="secondary"
                        onClick={() => copy(RTMP_URL, "RTMP URL")}
                        className="shrink-0"
                      >
                        <Copy className="w-4 h-4 mr-2" /> Copy
                      </Button>
                    </div>
                  </div>

                  {/* Stream Key */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Stream Key <span className="text-primary">(keep private)</span>
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          readOnly
                          type={showKey ? "text" : "password"}
                          value={STREAM_KEY}
                          className="font-mono text-sm bg-background/60 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey((s) => !s)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          aria-label={showKey ? "Hide key" : "Show key"}
                        >
                          {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <Button
                        onClick={() => copy(STREAM_KEY, "Stream key")}
                        className="shrink-0 bg-gradient-red hover:opacity-90 shadow-neon"
                      >
                        <Copy className="w-4 h-4 mr-2" /> Copy
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Never share your stream key. Rotate it if you suspect it's compromised.
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="info" className="mt-5">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: "Bitrate", value: "6000 kbps" },
                      { label: "Resolution", value: "1920×1080" },
                      { label: "FPS", value: "60" },
                      { label: "Codec", value: "H.264" },
                    ].map((s) => (
                      <div key={s.label} className="rounded-lg glass p-3">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {s.label}
                        </div>
                        <div className="font-display text-lg neon-text">{s.value}</div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </Card>
          </div>

          {/* RIGHT: Chat */}
          <Card className="flex flex-col bg-card/60 backdrop-blur border-border/60 h-[720px] lg:sticky lg:top-20 overflow-hidden">
            <div className="p-4 border-b border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <h2 className="font-display tracking-wider text-sm">LIVE CHAT</h2>
              </div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                1,245 online
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
              {messages.map((m) => (
                <div key={m.id} className="text-sm leading-snug animate-float-up">
                  <span className={`font-semibold mr-2 ${m.color}`}>{m.user}</span>
                  <span className="text-foreground/90">{m.text}</span>
                </div>
              ))}
            </div>

            {/* Reactions bar */}
            <div className="px-3 py-2 border-t border-border/60 flex items-center gap-1 overflow-x-auto scrollbar-hide">
              {REACTIONS.map((e) => (
                <button
                  key={e}
                  onClick={() => send(e)}
                  className="text-xl hover:scale-125 transition-transform shrink-0 px-1"
                  title={`React ${e}`}
                >
                  {e}
                </button>
              ))}
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(draft);
              }}
              className="p-3 border-t border-border/60 flex items-center gap-2"
            >
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Say something…"
                className="bg-background/60"
                maxLength={240}
              />
              <Button
                type="submit"
                size="icon"
                className="bg-gradient-red shadow-neon shrink-0"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}