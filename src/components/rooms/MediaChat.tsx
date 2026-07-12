import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone, UserX, Radio } from "lucide-react";
import { toast } from "sonner";

interface Props {
  roomId: string;
  userId: string;
  hostId?: string;
  isHost?: boolean;
  onKick?: (userId: string) => void;
}

type PeerState = { id: string; stream: MediaStream | null };

/**
 * In-app WebRTC mesh with audio + optional video.
 * Signaling over Supabase Realtime broadcast channel `media:<roomId>`.
 * Renders a compact grid of remote video tiles next to the movie player.
 */
export function MediaChat({ roomId, userId, hostId, isHost, onKick }: Props) {
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camOn, setCamOn] = useState(true);
  const [pttEnabled, setPttEnabled] = useState(false);
  const [pttActive, setPttActive] = useState(false);
  const [peers, setPeers] = useState<PeerState[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  const rtcCfg = useMemo<RTCConfiguration>(() => ({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  }), []);

  const updatePeers = () => {
    setPeers(Array.from(pcsRef.current.keys()).map(id => ({
      id,
      stream: (pcsRef.current.get(id) as any)?._remoteStream || null,
    })));
  };

  const cleanup = () => {
    pcsRef.current.forEach(pc => pc.close());
    pcsRef.current.clear();
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (chRef.current) supabase.removeChannel(chRef.current);
    chRef.current = null;
    setPeers([]);
  };

  useEffect(() => () => cleanup(), []);

  const createPc = (peerId: string, initiator: boolean) => {
    const pc = new RTCPeerConnection(rtcCfg);
    (pc as any)._remoteStream = new MediaStream();
    streamRef.current?.getTracks().forEach(t => pc.addTrack(t, streamRef.current!));
    pc.onicecandidate = (e) => {
      if (e.candidate) chRef.current?.send({
        type: "broadcast", event: "signal",
        payload: { from: userId, to: peerId, kind: "ice", data: e.candidate.toJSON() },
      });
    };
    pc.ontrack = (e) => {
      const s: MediaStream = (pc as any)._remoteStream;
      e.streams[0]?.getTracks().forEach(t => {
        if (!s.getTracks().find(x => x.id === t.id)) s.addTrack(t);
      });
      updatePeers();
    };
    pcsRef.current.set(peerId, pc);
    updatePeers();
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

  const join = async (withVideo: boolean) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: withVideo ? { width: { ideal: 480 }, height: { ideal: 360 }, facingMode: "user" } : false,
      });
      streamRef.current = stream;
      setCamOn(withVideo);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const ch = supabase.channel(`media:${roomId}`, { config: { presence: { key: userId } } });
      chRef.current = ch;

      ch.on("presence", { event: "sync" }, () => {
        const state = ch.presenceState() as Record<string, any[]>;
        const others = Object.keys(state).filter(id => id !== userId);
        others.forEach(id => {
          if (!pcsRef.current.has(id) && userId < id) createPc(id, true);
        });
        // Drop peers that left
        Array.from(pcsRef.current.keys()).forEach(id => {
          if (!others.includes(id)) {
            pcsRef.current.get(id)?.close();
            pcsRef.current.delete(id);
          }
        });
        updatePeers();
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
        } catch (err) { console.warn("[media] signal error", err); }
      });

      await ch.subscribe(async (status) => {
        if (status === "SUBSCRIBED") await ch.track({ joined_at: Date.now(), video: withVideo });
      });
      setJoined(true);
    } catch (e: any) {
      toast.error(e?.message || "Camera / microphone access denied");
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

  const toggleCam = () => {
    const s = streamRef.current;
    if (!s) return;
    const tracks = s.getVideoTracks();
    if (tracks.length === 0) return;
    const next = !camOn;
    tracks.forEach(t => (t.enabled = next));
    setCamOn(next);
  };

  /** Apply audio track enabled state based on mute + PTT rules. */
  const applyAudioState = (opts?: { forceActive?: boolean }) => {
    const s = streamRef.current;
    if (!s) return;
    const active = opts?.forceActive ?? pttActive;
    const shouldTransmit = !muted && (!pttEnabled || active);
    s.getAudioTracks().forEach((t) => (t.enabled = shouldTransmit));
  };

  // Re-apply whenever mute / PTT state changes.
  useEffect(() => { applyAudioState(); }, [muted, pttEnabled, pttActive]);

  // Global spacebar listener for push-to-talk.
  useEffect(() => {
    if (!joined || !pttEnabled) return;
    const isTypingTarget = (el: EventTarget | null) => {
      const t = el as HTMLElement | null;
      if (!t) return false;
      const tag = t.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || (t as any).isContentEditable;
    };
    const onDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      setPttActive(true);
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      setPttActive(false);
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      setPttActive(false);
    };
  }, [joined, pttEnabled]);

  return (
    <div className="glass rounded-2xl p-3 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-sm flex items-center gap-2">
          <Video className="h-4 w-4 text-primary" />
          <span className="font-semibold">Video & Voice</span>
          <span className="text-xs text-muted-foreground">
            {joined ? `${peers.length + 1} on call` : "In-app WebRTC"}
          </span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {joined ? (
            <>
              <Button size="sm" variant="ghost"
                className={`rounded-full ${muted ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}
                onClick={toggleMute}>
                {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button size="sm" variant="ghost"
                className={`rounded-full ${!camOn ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}
                onClick={toggleCam}>
                {camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </Button>
              <Button size="sm" variant="destructive" onClick={leave}><PhoneOff className="h-4 w-4 mr-1" />Leave</Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => join(false)}>
                <Phone className="h-4 w-4 mr-1" /> Audio
              </Button>
              <Button size="sm" className="bg-gradient-red shadow-neon" onClick={() => join(true)}>
                <Video className="h-4 w-4 mr-1" /> Camera + Mic
              </Button>
            </>
          )}
        </div>
      </div>

      {joined && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-secondary/40 px-3 py-2 text-xs">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={pttEnabled}
              onChange={(e) => setPttEnabled(e.target.checked)}
              className="accent-primary"
            />
            <Radio className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold">Push-to-Talk</span>
            <span className="text-muted-foreground">Hold <kbd className="px-1 rounded bg-black/40 text-white">Space</kbd> to talk</span>
          </label>
          {pttEnabled && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-widest ${
                pttActive ? "bg-emerald-500/25 text-emerald-200" : "bg-black/40 text-muted-foreground"
              }`}
            >
              {pttActive ? "● Live" : "Muted"}
            </span>
          )}
        </div>
      )}

      {joined && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Tile
            id={userId}
            self
            stream={streamRef.current}
            label="You"
            camOn={camOn}
            muted={muted}
            isHostTile={userId === hostId}
          />
          {peers.map(p => (
            <Tile
              key={p.id}
              id={p.id}
              stream={p.stream}
              label={p.id === hostId ? "Host" : p.id.slice(0, 6)}
              isHostTile={p.id === hostId}
              canKick={!!isHost && p.id !== userId}
              onKick={() => onKick?.(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Tile({
  id, stream, label, self, camOn, muted, canKick, onKick, isHostTile,
}: {
  id: string; stream: MediaStream | null; label: string;
  self?: boolean; camOn?: boolean; muted?: boolean;
  canKick?: boolean; onKick?: () => void; isHostTile?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);
  const hasVideo = stream?.getVideoTracks().some(t => t.enabled) ?? false;
  return (
    <div className="relative aspect-video rounded-xl overflow-hidden bg-black/70 border border-border/40">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={self}
        className={`w-full h-full object-cover ${hasVideo ? "" : "opacity-0"}`}
      />
      {!hasVideo && (
        <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
          <div className="h-10 w-10 rounded-full bg-primary/20 grid place-items-center text-primary font-bold">
            {label.slice(0, 1).toUpperCase()}
          </div>
        </div>
      )}
      <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between gap-1">
        <span className={`text-[10px] px-1.5 py-0.5 rounded bg-black/60 ${isHostTile ? "text-primary" : "text-white"}`}>
          {label}{isHostTile ? " · host" : ""}
        </span>
        <div className="flex gap-1">
          {self && muted && <span className="text-[10px] px-1 rounded bg-destructive/80 text-white"><MicOff className="h-3 w-3" /></span>}
          {canKick && (
            <button
              onClick={onKick}
              className="text-[10px] px-1 rounded bg-destructive/80 text-white hover:bg-destructive"
              title="Kick user"
            >
              <UserX className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}