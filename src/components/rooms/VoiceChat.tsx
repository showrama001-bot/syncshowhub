import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, PhoneOff, Phone } from "lucide-react";
import { toast } from "sonner";

interface Props {
  roomId: string;
  userId: string;
}

/**
 * Lightweight in-app WebRTC mesh audio chat.
 * Signaling: Supabase Realtime broadcast channel `voice:<roomId>`.
 * Media: audio only, STUN only. Mobile-optimized.
 */
export function VoiceChat({ roomId, userId }: Props) {
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [peers, setPeers] = useState<string[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audiosRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const rtcCfg = useMemo<RTCConfiguration>(() => ({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  }), []);

  const cleanup = () => {
    pcsRef.current.forEach(pc => pc.close());
    pcsRef.current.clear();
    audiosRef.current.forEach(a => { a.pause(); a.srcObject = null; });
    audiosRef.current.clear();
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (chRef.current) supabase.removeChannel(chRef.current);
    chRef.current = null;
    setPeers([]);
  };

  useEffect(() => () => cleanup(), []);

  const createPc = (peerId: string, initiator: boolean) => {
    const pc = new RTCPeerConnection(rtcCfg);
    streamRef.current?.getTracks().forEach(t => pc.addTrack(t, streamRef.current!));
    pc.onicecandidate = (e) => {
      if (e.candidate) chRef.current?.send({
        type: "broadcast", event: "signal",
        payload: { from: userId, to: peerId, kind: "ice", data: e.candidate.toJSON() },
      });
    };
    pc.ontrack = (e) => {
      let audio = audiosRef.current.get(peerId);
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        audiosRef.current.set(peerId, audio);
      }
      audio.srcObject = e.streams[0];
      audio.play().catch(() => {});
    };
    pcsRef.current.set(peerId, pc);
    setPeers(Array.from(pcsRef.current.keys()));
    if (initiator) {
      (async () => {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        chRef.current?.send({
          type: "broadcast", event: "signal",
          payload: { from: userId, to: peerId, kind: "offer", data: offer },
        });
      })();
    }
    return pc;
  };

  const join = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      streamRef.current = stream;
      const ch = supabase.channel(`voice:${roomId}`, { config: { presence: { key: userId } } });
      chRef.current = ch;

      ch.on("presence", { event: "sync" }, () => {
        const state = ch.presenceState() as Record<string, any[]>;
        const others = Object.keys(state).filter(id => id !== userId);
        // Deterministic initiator: lower id calls higher id.
        others.forEach(id => {
          if (!pcsRef.current.has(id) && userId < id) createPc(id, true);
        });
      });

      ch.on("broadcast", { event: "signal" }, async ({ payload }) => {
        if (payload.to !== userId) return;
        const from = payload.from as string;
        let pc = pcsRef.current.get(from);
        if (!pc) pc = createPc(from, false);
        try {
          if (payload.kind === "offer") {
            await pc.setRemoteDescription(payload.data);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ch.send({ type: "broadcast", event: "signal", payload: { from: userId, to: from, kind: "answer", data: answer }});
          } else if (payload.kind === "answer") {
            await pc.setRemoteDescription(payload.data);
          } else if (payload.kind === "ice") {
            await pc.addIceCandidate(payload.data);
          }
        } catch (err) { console.warn("[voice] signal error", err); }
      });

      await ch.subscribe(async (status) => {
        if (status === "SUBSCRIBED") await ch.track({ joined_at: Date.now() });
      });
      setJoined(true);
    } catch (e: any) {
      toast.error(e?.message || "Microphone access denied");
    }
  };

  const leave = () => { cleanup(); setJoined(false); setMuted(false); };

  const toggleMute = () => {
    const s = streamRef.current;
    if (!s) return;
    const next = !muted;
    s.getAudioTracks().forEach(t => (t.enabled = !next));
    setMuted(next);
  };

  return (
    <div className="glass rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
      <div className="text-sm flex items-center gap-2">
        <Mic className="h-4 w-4 text-primary" />
        <span className="font-semibold">Voice</span>
        <span className="text-xs text-muted-foreground">
          {joined ? `${peers.length + 1} in call` : "In-app WebRTC audio"}
        </span>
      </div>
      <div className="flex gap-2">
        {joined && (
          <Button size="sm" variant="ghost"
            className={`rounded-full ${muted ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}
            onClick={toggleMute}>
            {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
        )}
        {joined ? (
          <Button size="sm" variant="destructive" onClick={leave}><PhoneOff className="h-4 w-4 mr-1" />Leave</Button>
        ) : (
          <Button size="sm" className="bg-gradient-red shadow-neon" onClick={join}><Phone className="h-4 w-4 mr-1" />Join voice</Button>
        )}
      </div>
    </div>
  );
}