import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Radio, Users } from "lucide-react";

type Msg = { id: string; user: string; text: string; at: number };

// Public viewer for /room/:username. Joins the studio's WebRTC broadcast and
// a Realtime chat channel. No auth required — anyone can watch and chat.
export default function Room() {
  const { username = "" } = useParams();
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamChanRef = useRef<any>(null);
  const chatChanRef = useRef<any>(null);
  const viewerId = useRef<string>(crypto.randomUUID());
  const [live, setLive] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [viewers, setViewers] = useState(0);
  const displayName =
    (user as any)?.user_metadata?.username ||
    user?.email?.split("@")[0] ||
    `guest-${viewerId.current.slice(0, 4)}`;

  useEffect(() => {
    if (!username) return;

    // === Stream (WebRTC signaling) ===
    const streamChan = supabase.channel(`studio:${username}`, { config: { broadcast: { self: false } } });
    streamChanRef.current = streamChan;

    const setupPeer = () => {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      pcRef.current = pc;
      pc.ontrack = (e) => {
        if (videoRef.current) {
          videoRef.current.srcObject = e.streams[0];
          videoRef.current.play().catch(() => {});
          setLive(true);
        }
      };
      pc.onicecandidate = (e) => {
        if (e.candidate) streamChan.send({ type: "broadcast", event: "viewer-ice", payload: { viewerId: viewerId.current, candidate: e.candidate } });
      };
      return pc;
    };

    streamChan.on("broadcast", { event: "host-offer" }, async ({ payload }: any) => {
      if (payload.viewerId !== viewerId.current) return;
      const pc = pcRef.current || setupPeer();
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      streamChan.send({ type: "broadcast", event: "viewer-answer", payload: { viewerId: viewerId.current, sdp: answer } });
    });

    streamChan.on("broadcast", { event: "host-ice" }, async ({ payload }: any) => {
      if (payload.viewerId !== viewerId.current) return;
      const pc = pcRef.current;
      if (pc && payload.candidate) {
        try { await pc.addIceCandidate(payload.candidate); } catch {}
      }
    });

    streamChan.on("broadcast", { event: "host-live" }, () => {
      setupPeer();
      streamChan.send({ type: "broadcast", event: "viewer-join", payload: { viewerId: viewerId.current } });
    });

    streamChan.on("broadcast", { event: "host-offline" }, () => {
      setLive(false);
      pcRef.current?.close();
      pcRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    });

    streamChan.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setupPeer();
        streamChan.send({ type: "broadcast", event: "viewer-join", payload: { viewerId: viewerId.current } });
      }
    });

    // === Chat + presence ===
    const chatChan = supabase.channel(`room-chat:${username}`, {
      config: { broadcast: { self: true }, presence: { key: viewerId.current } },
    });
    chatChanRef.current = chatChan;

    chatChan.on("broadcast", { event: "msg" }, ({ payload }: any) => {
      setMessages((m) => [...m.slice(-199), payload as Msg]);
    });
    chatChan.on("presence", { event: "sync" }, () => {
      setViewers(Object.keys(chatChan.presenceState()).length);
    });

    chatChan.subscribe((status) => {
      if (status === "SUBSCRIBED") chatChan.track({ name: displayName });
    });

    return () => {
      pcRef.current?.close();
      pcRef.current = null;
      supabase.removeChannel(streamChan);
      supabase.removeChannel(chatChan);
    };
  }, [username, displayName]);

  const send = () => {
    const clean = text.trim();
    if (!clean || !chatChanRef.current) return;
    const msg: Msg = { id: crypto.randomUUID(), user: displayName, text: clean, at: Date.now() };
    chatChanRef.current.send({ type: "broadcast", event: "msg", payload: msg });
    setText("");
  };

  return (
    <div className="pt-20 px-4 md:px-6 pb-12 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl tracking-wider">@{username}</h1>
          <p className="text-muted-foreground text-sm flex items-center gap-3">
            {live ? (
              <span className="text-red-400 flex items-center gap-1"><Radio className="h-4 w-4 animate-pulse" /> Live</span>
            ) : (
              <span>Waiting for stream…</span>
            )}
            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {viewers}</span>
          </p>
        </div>
        <Link to="/studio" className="text-xs text-primary hover:underline">Start your own stream →</Link>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-4">
        <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-border/50">
          <video ref={videoRef} className="w-full h-full object-contain" playsInline controls />
          {!live && (
            <div className="absolute inset-0 grid place-items-center bg-black/60 text-muted-foreground">
              <div className="text-center">
                <Radio className="h-12 w-12 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Waiting for @{username} to go live…</p>
              </div>
            </div>
          )}
        </div>

        <aside className="glass rounded-2xl flex flex-col h-[70vh] lg:h-[calc(100vh-180px)]">
          <div className="px-4 py-3 border-b border-border/50 font-semibold">Live chat</div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm">
            {messages.length === 0 ? (
              <p className="text-muted-foreground text-center pt-6">Say hi 👋</p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="leading-tight">
                  <span className="text-primary font-semibold">{m.user}:</span>{" "}
                  <span>{m.text}</span>
                </div>
              ))
            )}
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="p-2 border-t border-border/50 flex gap-2"
          >
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message" maxLength={300} />
            <Button type="submit" size="icon" className="bg-gradient-red shadow-neon"><Send className="h-4 w-4" /></Button>
          </form>
        </aside>
      </div>
    </div>
  );
}