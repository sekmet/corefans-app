import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import Seo from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { createRealtimeClient, type RealtimeClient, type RealtimeMessage, type RealtimeStatus } from "@/lib/realtime";

export default function GoLive() {
  const { data: session } = authClient.useSession();
  const user = session?.user as any | undefined;

  const [title, setTitle] = useState("");
  const [streamId, setStreamId] = useState<string | null>(null);
  const [streamKey, setStreamKey] = useState<string>("");
  const [rtmpUrl, setRtmpUrl] = useState<string>("");
  const [hlsUrl, setHlsUrl] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [wsStatus, setWsStatus] = useState<RealtimeStatus>("idle");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const rtRef = useRef<RealtimeClient | null>(null);

  const hlsBase = useMemo(() => {
    const base = (import.meta as any).env?.VITE_HLS_BASE_URL as string | undefined;
    return base ? base.replace(/\/$/, "") : "";
  }, []);

  const apiBase = useMemo(() => {
    const base = (import.meta as any).env?.VITE_AUTH_BASE_URL as string | undefined;
    return base ? base.replace(/\/$/, "") : "";
  }, []);

  // Setup/teardown hls preview when URL is present
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    // Cleanup previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (!hlsUrl) return;

    if (v.canPlayType("application/vnd.apple.mpegurl")) {
      v.src = hlsUrl;
      v.load();
    } else if (Hls.isSupported()) {
      const hls = new Hls({ lowLatencyMode: true, liveSyncDurationCount: 3 });
      hlsRef.current = hls;
      hls.attachMedia(v);
      hls.loadSource(hlsUrl);
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data?.fatal) {
          setError("HLS fatal error: " + (data?.type || "unknown"));
        }
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [hlsUrl]);

  const computeDefaultRtmp = useCallback(() => {
    // Fallback RTMP if API does not provide
    return "rtmp://localhost:1935/live";
  }, []);

  const computeStreamKey = useCallback(() => {
    const uid = user?.id || "user";
    return `${uid}_${Date.now()}`;
  }, [user?.id]);

  const computeHlsFromKey = useCallback((key: string) => {
    if (!key) return "";
    if (!hlsBase) return "";
    return `${hlsBase}/${key}.m3u8`;
  }, [hlsBase]);

  // Connect/disconnect realtime when stream goes live/offline
  useEffect(() => {
    // cleanup existing
    if (!isStreaming || !streamId) {
      rtRef.current?.close();
      rtRef.current = null;
      setViewerCount(0);
      setWsStatus("idle");
      return;
    }

    const displayUser = user?.name || user?.email || user?.id || "me";
    const client = createRealtimeClient({ streamId, user: displayUser });
    rtRef.current = client;
    client.on("status", setWsStatus);
    client.on("message", (m: RealtimeMessage) => {
      if (m.type === "viewer_update" && m.streamId === streamId) setViewerCount(m.viewers);
      if (m.type === "system" && m.text?.toLowerCase?.().includes("ended")) {
        setIsStreaming(false);
      }
    });
    client.connect();
    return () => {
      client.off("status", setWsStatus);
      client.close();
      if (rtRef.current === client) rtRef.current = null;
    };
  }, [isStreaming, streamId, user?.name, user?.email, user?.id]);

  const startStream = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let sid: string | null = streamId;
      let rtmp = "";
      let key = streamKey || computeStreamKey();
      let playback = "";

      if (apiBase) {
        try {
          const res = await fetch(`${apiBase}/api/stream/start`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: title || undefined }),
          });
          if (!res.ok) throw new Error(`Start failed: ${res.status}`);
          const data: any = await res.json().catch(() => ({}));
          // Server currently returns the stream object directly; also support wrapped shape
          const s: any = data?.stream ?? (data && typeof data === "object" && "id" in data ? data : undefined);
          if (s) {
            sid = s.id ?? sid ?? null;
            rtmp = s.rtmpUrl ?? rtmp;
            key = s.streamKey ?? key;
            playback = s.playbackUrl ?? playback;
          } else {
            // Fallback to flat fields
            sid = data?.streamId ?? sid ?? null;
            rtmp = data?.rtmpUrl ?? rtmp;
            key = data?.streamKey ?? key;
            playback = data?.playbackUrl ?? playback;
          }
        } catch (e) {
          // API may not be wired yet; fall back
          console.warn("/api/stream/start failed, using local defaults", e);
        }
      }

      if (!rtmp) rtmp = computeDefaultRtmp();
      if (!key) key = computeStreamKey();
      const hls = playback || computeHlsFromKey(key);

      setStreamId(sid);
      setStreamKey(key);
      setRtmpUrl(rtmp);
      setHlsUrl(hls);
      setIsStreaming(true);
      toast.success("Stream started. Configure OBS and start streaming.");
    } catch (err: any) {
      setError(err?.message || "Failed to start stream");
      toast.error("Failed to start stream");
    } finally {
      setLoading(false);
    }
  }, [apiBase, computeDefaultRtmp, computeHlsFromKey, computeStreamKey, streamId, streamKey, title]);

  const stopStream = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (apiBase) {
        try {
          const res = await fetch(`${apiBase}/api/stream/stop`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: streamId || undefined }),
          });
          if (!res.ok) throw new Error(`Stop failed: ${res.status}`);
          await res.json().catch(() => ({}));
        } catch (e) {
          console.warn("/api/stream/stop failed", e);
        }
      }
      setIsStreaming(false);
      toast.message("Stream ended");
    } catch (err: any) {
      setError(err?.message || "Failed to stop stream");
      toast.error("Failed to stop stream");
    } finally {
      setLoading(false);
    }
  }, [apiBase, streamId]);

  const ffmpegCmd = useMemo(() => {
    if (!rtmpUrl || !streamKey) return "";
    return `ffmpeg -re -f lavfi -i testsrc=size=1280x720:rate=30 -f lavfi -i sine=frequency=1000:sample_rate=48000 -c:v libx264 -preset veryfast -tune zerolatency -pix_fmt yuv420p -c:a aac -b:a 128k -f flv \"${rtmpUrl}/${streamKey}\"`;
  }, [rtmpUrl, streamKey]);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Copy failed");
    }
  }, []);

  return (
    <div className="mx-auto max-w-5xl">
      <Seo title="Go Live" description="Broadcast your live stream" />

      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Broadcasting Studio</h1>
        <p className="text-sm text-muted-foreground">Configure your encoder and start streaming.</p>
      </div>

      {error ? (
        <div className="mb-4">
          <Alert variant="destructive">
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Left: Settings */}
        <div className="rounded-lg border bg-card p-3">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-2">Stream Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My Live Stream" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">RTMP URL</label>
              <div className="flex gap-2">
                <Input readOnly value={rtmpUrl || computeDefaultRtmp()} />
                <Button variant="secondary" onClick={() => copy(rtmpUrl || computeDefaultRtmp())}>Copy</Button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Stream Key</label>
              <div className="flex gap-2">
                <Input readOnly value={streamKey || "Generate to get key"} />
                <Button variant="secondary" onClick={() => streamKey && copy(streamKey)} disabled={!streamKey}>Copy</Button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">HLS Playback URL</label>
              <div className="flex gap-2">
                <Input readOnly value={hlsUrl || (streamKey && hlsBase ? `${hlsBase}/${streamKey}.m3u8` : "—")} />
                <Button variant="secondary" onClick={() => hlsUrl && copy(hlsUrl)} disabled={!hlsUrl}>Copy</Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Requires your HLS server to be configured (VITE_HLS_BASE_URL).</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">FFmpeg Test Command</label>
              <Textarea readOnly value={ffmpegCmd} rows={3} className="font-mono text-xs" />
              <div className="mt-2 flex justify-end">
                <Button variant="secondary" onClick={() => ffmpegCmd && copy(ffmpegCmd)} disabled={!ffmpegCmd}>Copy Command</Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button onClick={startStream} disabled={loading || isStreaming} className="bg-indigo-600">
                {loading ? "Starting…" : "Go Live"}
              </Button>
              <Button onClick={stopStream} variant="destructive" disabled={loading || !isStreaming}>
                End Stream
              </Button>
            </div>

            <div className="mt-4 p-3 rounded-md border">
              <h3 className="text-sm font-semibold mb-1">OBS Studio Setup</h3>
              <ol className="text-xs space-y-1 list-decimal list-inside text-muted-foreground">
                <li>Open OBS and go to Settings → Stream.</li>
                <li>Set Service to "Custom...".</li>
                <li>Server: the RTMP URL above.</li>
                <li>Stream Key: your Stream Key above.</li>
                <li>Click Start Streaming.</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">Stream Preview</div>
            <div className="flex items-center gap-2 text-xs">
              <span className={`inline-block h-2 w-2 rounded-full ${isStreaming ? "bg-red-500" : "bg-muted"}`} />
              {isStreaming ? <span className="text-red-500 font-medium">LIVE</span> : <span className="text-muted-foreground">Offline</span>}
              {isStreaming ? (
                <span className="text-muted-foreground">{viewerCount} watching</span>
              ) : null}
              {isStreaming ? (
                <span className="ml-1 rounded px-1.5 py-0.5 bg-muted text-muted-foreground">{wsStatus}</span>
              ) : null}
            </div>
          </div>
          <div className="bg-black aspect-video rounded-md overflow-hidden">
            <video ref={videoRef} className="h-full w-full object-contain" playsInline muted />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {hlsUrl ? `HLS: ${hlsUrl}` : "Preview will start when HLS segments are available."}
          </p>
        </div>
      </div>
    </div>
  );
}
