import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { useNavigate, useParams } from "react-router-dom";
import Seo from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  ArrowLeft,
  Maximize,
  Pause,
  Play,
  Share2,
  Volume2,
  VolumeX,
  MoreHorizontal,
  Flag,
  Send,
  Smile,
  Clock,
  Eye,
} from "lucide-react";

import { createRealtimeClient, type RealtimeClient, type RealtimeMessage, type RealtimeStatus } from "@/lib/realtime";
import { appendChatHistory, appendTipHistory, clearChatHistory, loadChatHistory, loadTipsHistory } from "@/lib/chat-history";

// Demo helpers
function useInterval(callback: () => void, delay: number | null) {
  const savedRef = useRef(callback);
  useEffect(() => {
    savedRef.current = callback;
  }, [callback]);
  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedRef.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

function hashToHsl(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
  const hue = Math.abs(h) % 360;
  return `hsl(${hue} 70% 55%)`;
}

// Types
type ChatType = "chat" | "tip" | "system";
interface ChatMessage {
  id: string;
  user: string;
  text: string;
  type: ChatType;
  ts: number;
  amount?: number;
}

// Video Player
function VideoPlayer({ src, poster }: { src: string; poster?: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.9);
  const isHls = useMemo(() => /\.m3u8(\?.*)?$/i.test(src), [src]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    // cleanup previous hls instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    setError(null);
    setLoading(true);

    if (isHls) {
      // Native HLS (Safari)
      if (v.canPlayType("application/vnd.apple.mpegurl")) {
        v.src = src;
        v.load();
      } else if (Hls.isSupported()) {
        const hls = new Hls({ lowLatencyMode: true, liveSyncDurationCount: 3 });
        hlsRef.current = hls;
        hls.attachMedia(v);
        hls.loadSource(src);
        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (data?.fatal) {
            setError("HLS fatal error: " + (data?.type || "unknown"));
          }
        });
      } else {
        setError("HLS not supported in this browser");
      }
    } else {
      // MP4 or other supported
      v.src = src;
      v.load();
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, isHls]);

  const onTogglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().then(() => setPlaying(true)).catch(() => setError("Failed to play"));
    } else {
      v.pause();
      setPlaying(false);
    }
  }, []);

  const onToggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  const onVolume = useCallback((val: number) => {
    const v = videoRef.current;
    if (!v) return;
    const clamped = Math.max(0, Math.min(1, val));
    v.volume = clamped;
    setVolume(clamped);
    if (clamped > 0 && v.muted) {
      v.muted = false;
      setMuted(false);
    }
  }, []);

  const onFullscreen = useCallback(() => {
    const container = videoRef.current?.parentElement;
    if (!container) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      container.requestFullscreen().catch(() => {});
    }
  }, []);

  return (
    <div className="relative aspect-video w-full bg-black rounded-md overflow-hidden">
      {loading && (
        <div className="absolute inset-0 grid place-items-center">
          <Skeleton className="h-20 w-20 rounded-full" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 p-3">
          <Alert variant="destructive" className="h-full">
            <AlertTitle>Player error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        poster={poster}
        playsInline
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedData={() => setLoading(false)}
        onError={() => setError("Video failed to load")}
        aria-label="Live video player"
      >
      </video>

      {/* Controls overlay */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3">
        <div className="flex items-center justify-between">
          {/* Top-left live badge shown by parent header */}
        </div>
        <div className="flex items-center justify-between">
          <div className="pointer-events-auto flex items-center gap-2">
            <Button aria-label={playing ? "Pause" : "Play"} size="icon" variant="secondary" className="min-h-[44px] min-w-[44px]" onClick={onTogglePlay}>
              {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
            </Button>
            <Button aria-label={muted ? "Unmute" : "Mute"} size="icon" variant="secondary" className="min-h-[44px] min-w-[44px]" onClick={onToggleMute}>
              {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
            </Button>
            <input
              aria-label="Volume"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => onVolume(parseFloat(e.target.value))}
              className="h-2 w-28 accent-indigo-500"
            />
          </div>
          <div className="pointer-events-auto">
            <Button aria-label="Fullscreen" size="icon" variant="secondary" className="min-h-[44px] min-w-[44px]" onClick={onFullscreen}>
              <Maximize className="size-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Header
function StreamHeader({
  title,
  streamer,
  avatar,
  startedAt,
  viewers,
  onBack,
  onFollow,
}: {
  title: string;
  streamer: string;
  avatar: string;
  startedAt: number;
  viewers: number;
  onBack: () => void;
  onFollow: () => void;
}) {
  const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - startedAt) / 1000));
  useInterval(() => setElapsed((e) => e + 1), 1000);
  const mm = Math.floor(elapsed / 60);
  const ss = String(elapsed % 60).padStart(2, "0");
  return (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon" aria-label="Back" className="min-h-[44px] min-w-[44px]" onClick={onBack}>
        <ArrowLeft className="size-5" />
      </Button>
      <Avatar className="h-10 w-10">
        <AvatarImage src={avatar} alt={streamer} />
        <AvatarFallback>{streamer[0]}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="truncate font-medium">{title}</h1>
          <Badge className="bg-red-600">LIVE</Badge>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{streamer}</span>
          <span className="flex items-center gap-1"><Eye className="size-3" /> {Intl.NumberFormat().format(viewers)}</span>
          <span className="flex items-center gap-1"><Clock className="size-3" /> {mm}:{ss}</span>
        </div>
      </div>
      <Button onClick={onFollow} className="ml-auto bg-indigo-600">Follow</Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Options" className="min-h-[44px] min-w-[44px]"><MoreHorizontal className="size-5" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => {
            navigator.clipboard.writeText(window.location.href).then(() => toast.success("Link copied"));
          }}>
            <Share2 className="mr-2 size-4" /> Share
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => toast.message("Reported. Our team will review.")}> <Flag className="mr-2 size-4"/> Report</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Quality</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => toast.success("Quality: Auto")}>Auto</DropdownMenuItem>
          <DropdownMenuItem onClick={() => toast.success("Quality: 1080p")}>1080p</DropdownMenuItem>
          <DropdownMenuItem onClick={() => toast.success("Quality: 720p")}>720p</DropdownMenuItem>
          <DropdownMenuItem onClick={() => toast.success("Quality: 480p")}>480p</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// Tip Card
const TipCard = memo(function TipCard({ username, amount, message }: { username: string; amount: number; message?: string }) {
  return (
    <div className="rounded-md p-3 text-white shadow transition-all duration-300 bg-gradient-to-r from-indigo-500 to-purple-600">
      <div className="text-sm"><span className="font-semibold">{username}</span> has tipped <span className="font-bold">${amount.toFixed(2)}</span></div>
      {message ? <div className="text-xs/6 opacity-90 mt-0.5">“{message}”</div> : null}
    </div>
  );
});

// Chat Message
const ChatMessageItem = memo(function ChatMessageItem({ m }: { m: ChatMessage }) {
  const color = useMemo(() => hashToHsl(m.user), [m.user]);
  const time = useMemo(() => new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), [m.ts]);
  return (
    <div className="text-sm">
      <span className="font-medium" style={{ color }}>{m.user}</span>
      <span className="mx-1 text-muted-foreground">•</span>
      <span className="text-xs text-muted-foreground">{time}</span>
      {m.type === "tip" ? (
        <div className="mt-0.5 rounded border border-indigo-400/40 bg-indigo-500/10 px-2 py-1">
          <span className="font-medium">tipped ${m.amount?.toFixed(2)}</span>
          {m.text ? <span className="ml-1 opacity-90">“{m.text}”</span> : null}
        </div>
      ) : (
        <div className="mt-0.5">{m.text}</div>
      )}
    </div>
  );
});

export default function StreamLivePage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const username = useMemo(() => "you", []);
  const [rtStatus, setRtStatus] = useState<RealtimeStatus>("idle");
  const clientRef = useRef<RealtimeClient | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const sentTypingRef = useRef(false);

  // Demo stream info derived from id
  const stream = useMemo(() => {
    const idx = Math.abs((id || "0").split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % 7;
    const titles = [
      "Daily Sketch Session",
      "Music Production Live",
      "Photo Retouch Marathon",
      "Coding UI Live",
      "3D Sculpt Jam",
      "Piano Practice",
      "Chill Art Stream",
    ];
    const creators = ["Ava Streams", "Noah VT", "Mia", "Liam", "Zoe", "Kai", "Ivy"];
    return {
      title: titles[idx],
      streamer: creators[idx],
      avatar: `https://i.pravatar.cc/100?img=${(idx % 70) + 1}`,
      startedAt: Date.now() - (idx + 1) * 1000 * 60 * 17,
      viewers: 1200 + idx * 53,
      src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
      poster: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1600&auto=format&fit=crop",
    };
  }, [id]);

  // Resolve playback source (HLS if available, else demo MP4)
  const [playSrc, setPlaySrc] = useState<string>("");
  useEffect(() => {
    const sid = id || "default";
    const hlsBase = (import.meta as any).env?.VITE_HLS_BASE_URL as string | undefined;
    if (hlsBase) {
      setPlaySrc(`${hlsBase.replace(/\/$/, "")}/${sid}.m3u8`);
    } else {
      // fallback demo video
      setPlaySrc("https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4");
    }
  }, [id]);

  // Optionally fetch server stream data to refine playback URL
  useEffect(() => {
    const sid = id;
    const base = (import.meta as any).env?.VITE_AUTH_BASE_URL as string | undefined;
    if (!sid || !base) return;
    const controller = new AbortController();
    fetch(`${base.replace(/\/$/, "")}/api/streams`, { signal: controller.signal, credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        const arr = Array.isArray(data) ? data : Array.isArray(data?.streams) ? data.streams : [];
        const found = arr.find((s: any) => s?.id === sid || s?.streamId === sid);
        if (found?.playbackUrl && typeof found.playbackUrl === "string") {
          setPlaySrc(found.playbackUrl);
        }
      })
      .catch(() => {})
      .finally(() => {});
    return () => controller.abort();
  }, [id]);

  // Dynamic stats
  const [viewers, setViewers] = useState(stream.viewers);
  useInterval(() => setViewers((v) => v + Math.floor(Math.random() * 3) - 1), rtStatus === "open" ? null : 2500);
  const [present, setPresent] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<string, number>>({});
  const [muted, setMuted] = useState<Set<string>>(new Set());

  // Tips
  const [tips, setTips] = useState<Array<{ id: string; username: string; amount: number; message?: string }>>([]);
  const totalTips = useMemo(() => tips.reduce((s, t) => s + t.amount, 0), [tips]);

  // Chat
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: crypto.randomUUID(), user: "system", text: "Welcome to the stream! Be nice and have fun.", type: "system", ts: Date.now()
  }]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Load persisted history on stream change
  useEffect(() => {
    const sid = id || "default";
    const history = loadChatHistory(sid);
    setMessages((prev) => {
      // keep the first welcome/system message, then load history
      const [welcome] = prev;
      return [welcome, ...history];
    });
    const tipsHistory = loadTipsHistory(sid);
    setTips(tipsHistory.map((r) => ({ id: r.id, username: r.user, amount: r.amount || 0, message: r.text })).slice(0, 5));
  }, [id]);

  // Realtime: WebSocket client
  useEffect(() => {
    const c = createRealtimeClient({ streamId: id || "default", user: username });
    clientRef.current = c;
    const onStatus = (s: RealtimeStatus) => {
      setRtStatus(s);
      if (s === "open") {
        setPresent((prev) => Array.from(new Set([username, ...prev])));
      } else if (s === "closed" || s === "error") {
        setPresent((prev) => prev.filter((u) => u === username ? false : true));
      }
    };
    const onMsg = (msg: RealtimeMessage) => {
      if ("streamId" in msg && msg.streamId !== (id || "default")) return;
      switch (msg.type) {
        case "chat":
          setMessages((m) => {
            const rec = { id: crypto.randomUUID(), user: msg.user, text: msg.text, type: "chat" as const, ts: msg.ts || Date.now() };
            appendChatHistory(id || "default", rec);
            return m.concat(rec);
          });
          break;
        case "tip":
          setTips((arr) => [{ id: crypto.randomUUID(), username: msg.user, amount: msg.amount, message: msg.message }, ...arr].slice(0, 5));
          setMessages((m) => {
            const rec = { id: crypto.randomUUID(), user: msg.user, text: msg.message || "", type: "tip" as const, ts: msg.ts || Date.now(), amount: msg.amount };
            appendChatHistory(id || "default", rec);
            appendTipHistory(id || "default", rec);
            return m.concat(rec);
          });
          break;
        case "viewer_update":
          setViewers(msg.viewers);
          break;
        case "system":
          setMessages((m) => {
            const rec = { id: crypto.randomUUID(), user: "system", text: msg.text, type: "system" as const, ts: msg.ts || Date.now() };
            appendChatHistory(id || "default", rec);
            return m.concat(rec);
          });
          break;
        case "typing":
          if (msg.user !== username) {
            setTypingUsers((prev) => ({ ...prev, [msg.user]: Date.now() }));
            if (msg.isTyping === false) {
              setTypingUsers((prev) => {
                const next = { ...prev };
                delete next[msg.user];
                return next;
              });
            }
          }
          break;
        case "presence":
          setPresent(msg.users);
          break;
        default:
          break;
      }
    };
    c.on("status", onStatus);
    c.on("message", onMsg);
    c.connect();
    return () => {
      c.off("status", onStatus);
      c.off("message", onMsg);
      c.close();
      clientRef.current = null;
    };
  }, [id, username]);

  // Prune stale typers regularly
  useInterval(() => {
    const now = Date.now();
    setTypingUsers((prev) => {
      const next = { ...prev };
      for (const u of Object.keys(next)) {
        if (next[u] < now - 3000) delete next[u];
      }
      return next;
    });
  }, 1000);

  // Tip form state
  const [amount, setAmount] = useState<number>(5);
  const [tipMsg, setTipMsg] = useState("");
  const [sending, setSending] = useState(false);

  const sendTip = useCallback(async () => {
    setSending(true);
    try {
      clientRef.current?.sendTip(amount, tipMsg || undefined);
      toast.success(`Tipped $${amount.toFixed(2)}`);
      setTipMsg("");
    } finally {
      setSending(false);
    }
  }, [amount, tipMsg]);

  // Chat input
  const [draft, setDraft] = useState("");
  const onSendMessage = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    // Moderation commands
    if (text.startsWith("/")) {
      const [cmd, ...rest] = text.slice(1).split(/\s+/);
      const arg = rest.join(" ");
      const sid = id || "default";
      switch (cmd.toLowerCase()) {
        case "clear": {
          clearChatHistory(sid);
          setMessages([{ id: crypto.randomUUID(), user: "system", text: "Chat cleared by moderator.", type: "system", ts: Date.now() }]);
          toast.success("Chat cleared");
          break;
        }
        case "mute": {
          if (!arg) { toast.error("Usage: /mute <user>"); break; }
          setMuted((prev) => new Set(prev).add(arg));
          setMessages((m) => m.concat({ id: crypto.randomUUID(), user: "system", text: `${arg} was muted.`, type: "system", ts: Date.now() }));
          break;
        }
        case "unmute": {
          if (!arg) { toast.error("Usage: /unmute <user>"); break; }
          setMuted((prev) => {
            const next = new Set(prev);
            next.delete(arg);
            return next;
          });
          setMessages((m) => m.concat({ id: crypto.randomUUID(), user: "system", text: `${arg} was unmuted.`, type: "system", ts: Date.now() }));
          break;
        }
        case "help": {
          setMessages((m) => m.concat({ id: crypto.randomUUID(), user: "system", text: "Commands: /clear, /mute <user>, /unmute <user>", type: "system", ts: Date.now() }));
          break;
        }
        default: {
          setMessages((m) => m.concat({ id: crypto.randomUUID(), user: "system", text: `Unknown command: /${cmd}`, type: "system", ts: Date.now() }));
        }
      }
    } else {
      clientRef.current?.sendChat(text);
    }
    // stop typing indicator
    if (sentTypingRef.current) {
      clientRef.current?.sendTyping(false);
      sentTypingRef.current = false;
    }
    if (typingTimerRef.current) {
      window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    setDraft("");
  }, [draft, id]);

  const [chatOpen, setChatOpen] = useState(true);
  const activeTypers = useMemo(() => Object.keys(typingUsers).filter((u) => u !== username), [typingUsers, username]);

  return (
    <div className="mx-auto max-w-6xl h-full min-h-0 grid grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
      <Seo title={`${stream.title} • Live`} description={`Watch ${stream.streamer} live`} />

      {/* Left: Video + Header + Tips + Tip form */}
      <div className="mx-auto w-full max-w-3xl h-full min-h-0 overflow-y-auto overscroll-contain pr-1">
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-2">
          <StreamHeader
            title={stream.title}
            streamer={stream.streamer}
            avatar={stream.avatar}
            startedAt={stream.startedAt}
            viewers={viewers}
            onBack={() => navigate(-1)}
            onFollow={() => toast.success("Followed")}
          />
        </div>

        <div className="mt-2">
          <VideoPlayer src={playSrc || stream.src} poster={stream.poster} />
        </div>

        {/* Tip notifications */}
        {tips.length > 0 && (
          <div className="mt-3 space-y-2">
            {tips.map((t) => (
              <TipCard key={t.id} username={t.username} amount={t.amount} message={t.message} />
            ))}
          </div>
        )}

        {/* Tip form */}
        <div className="mt-4 rounded-lg border bg-card p-3">
          <div className="text-sm font-medium">Send a Tip</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {[1, 5, 10, 20].map((v) => (
              <Button key={v} variant={amount === v ? "default" : "outline"} onClick={() => setAmount(v)}>
                ${v}
              </Button>
            ))}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Custom</span>
              <Input
                aria-label="Custom amount"
                type="number"
                className="w-24"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value || 0))}
                min={1}
              />
            </div>
          </div>
          <Textarea
            aria-label="Tip message"
            placeholder="Say something nice (optional)"
            className="mt-2"
            value={tipMsg}
            onChange={(e) => setTipMsg(e.target.value)}
            rows={3}
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={sending} className="bg-indigo-600">
                  <Send className="mr-2 size-4" /> {sending ? "Sending..." : "Send Tip"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm tip</AlertDialogTitle>
                  <AlertDialogDescription>
                    You are about to send a tip of ${amount.toFixed(2)}. Continue?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={sendTip}>Confirm</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-3">
            <div className="text-xs text-muted-foreground">Viewers</div>
            <div className="text-xl font-semibold">{Intl.NumberFormat().format(viewers)}</div>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <div className="text-xs text-muted-foreground">Total Tips</div>
            <div className="text-xl font-semibold">${totalTips.toFixed(2)}</div>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <div className="text-xs text-muted-foreground">Uptime</div>
            <Uptime startedAt={stream.startedAt} />
          </div>
        </div>

        {/* Error notice for offline (demo: always live) */}
        <div className="sr-only">
          <Alert>
            <AlertTitle>Offline</AlertTitle>
            <AlertDescription>The stream is currently offline.</AlertDescription>
          </Alert>
        </div>
      </div>

      {/* Right: Chat */}
      <aside className="lg:sticky lg:top-4 lg:right-6">
        <div className="lg:hidden">
          <Button variant="outline" className="w-full" onClick={() => setChatOpen((s) => !s)}>
            {chatOpen ? "Hide Chat" : "Show Chat"}
          </Button>
        </div>
        {(chatOpen || typeof window !== "undefined") && (
          <div className="mt-2 rounded-lg border bg-card flex h-[60vh] min-h-0 flex-col lg:h-[70vh]">
            <div className="flex items-center justify-between border-b p-2">
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium">Chat</div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className={`inline-block h-2 w-2 rounded-full ${rtStatus === "open" ? "bg-green-500" : rtStatus === "connecting" ? "bg-amber-500" : "bg-red-500"}`} />
                  <span>
                    {rtStatus === "open" ? "Connected" : rtStatus === "connecting" ? "Connecting…" : rtStatus === "error" ? "Error" : rtStatus === "closing" ? "Closing…" : "Disconnected"}
                  </span>
                  <span className="hidden sm:inline">• {present.length} in chat</span>
                </div>
              </div>
              <Button size="icon" variant="ghost" aria-label="Emojis"><Smile className="size-5" /></Button>
            </div>
            {rtStatus !== "open" && (
              <div className="px-2 py-1 text-xs text-muted-foreground">Realtime service unavailable. Messages will send when reconnected.</div>
            )}
            <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
              {messages.filter((m) => m.type === "system" || !muted.has(m.user)).map((m) => (
                <ChatMessageItem key={m.id} m={m} />
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="border-t p-2">
              <Textarea
                aria-label="Message"
                placeholder="Write a message"
                value={draft}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraft(v);
                  if (clientRef.current && rtStatus === "open") {
                    if (!sentTypingRef.current) {
                      clientRef.current.sendTyping(true);
                      sentTypingRef.current = true;
                    }
                    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
                    typingTimerRef.current = window.setTimeout(() => {
                      sentTypingRef.current = false;
                      clientRef.current?.sendTyping(false);
                    }, 1500);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSendMessage();
                  }
                }}
                rows={2}
              />
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{activeTypers.length > 0 ? `${activeTypers.slice(0, 3).join(", ")}${activeTypers.length > 3 ? "…" : ""} ${activeTypers.length === 1 ? "is" : "are"} typing…` : `${draft.length}/240`}</span>
                <Button size="sm" onClick={onSendMessage} disabled={!draft.trim() || rtStatus !== "open"}>
                  Send
                </Button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function Uptime({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - startedAt) / 1000));
  useInterval(() => setElapsed((e) => e + 1), 1000);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  return <div className="text-xl font-semibold">{h > 0 ? `${h}h ` : ""}{m}m {String(s).padStart(2, "0")}s</div>;
}
