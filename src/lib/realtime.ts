/*
  Lightweight WebSocket client with auto-reconnect & typed helpers
*/

export type RealtimeStatus = "idle" | "connecting" | "open" | "closing" | "closed" | "error";

export type RealtimeMessage =
  | { type: "chat"; streamId: string; user: string; text: string; ts?: number }
  | { type: "tip"; streamId: string; user: string; amount: number; message?: string; ts?: number }
  | { type: "viewer_update"; streamId: string; viewers: number; ts?: number }
  | { type: "system"; streamId: string; text: string; ts?: number }
  | { type: "typing"; streamId: string; user: string; isTyping?: boolean; ts?: number }
  | { type: "presence"; streamId: string; users: string[]; ts?: number };

export type RealtimeClientOptions = {
  url?: string; // ws or wss url. If not provided, fallback to demo echo server.
  streamId: string;
  user: string;
  // reconnect
  maxRetries?: number;
  baseDelayMs?: number; // backoff base delay
};

type StatusHandler = (s: RealtimeStatus) => void;
type MessageHandler = (m: RealtimeMessage) => void;

export type RealtimeClient = {
  status: () => RealtimeStatus;
  connect: () => void;
  close: () => void;
  on: ((event: "status", handler: StatusHandler) => void) & ((event: "message", handler: MessageHandler) => void);
  off: ((event: "status", handler: StatusHandler) => void) & ((event: "message", handler: MessageHandler) => void);
  send: (msg: RealtimeMessage) => void;
  sendChat: (text: string) => void;
  sendTip: (amount: number, message?: string) => void;
  sendTyping: (isTyping: boolean) => void;
};

export function createRealtimeClient(opts: RealtimeClientOptions): RealtimeClient {
  let ws: WebSocket | null = null;
  let _status: RealtimeStatus = "idle";
  let retries = 0;
  const maxRetries = opts.maxRetries ?? 10;
  const baseDelay = opts.baseDelayMs ?? 600;
  let manualClose = false;
  const listeners = {
    status: new Set<StatusHandler>(),
    message: new Set<MessageHandler>(),
  } as const;

  function emitStatus(s: RealtimeStatus) {
    _status = s;
    listeners.status.forEach((cb) => cb(s));
  }
  function emitMessage(m: RealtimeMessage) {
    listeners.message.forEach((cb) => cb(m));
  }

  const url = (() => {
    const envUrl = (import.meta as any).env?.VITE_WS_URL as string | undefined;
    const base = opts.url ?? envUrl;
    if (base) return withQuery(base, { streamId: opts.streamId, user: opts.user });
    // Fallback to public echo server for local dev/demo
    return withQuery("wss://echo.websocket.events", { streamId: opts.streamId, user: opts.user });
  })();

  function connect() {
    manualClose = false;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    emitStatus("connecting");
    try {
      ws = new WebSocket(url);
    } catch (e) {
      emitStatus("error");
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      retries = 0;
      emitStatus("open");
      // Detect if we're connected to our server WS (vs echo demo)
      const isServer = /\/ws(\?|$)/.test(url) || /localhost:3000/.test(url) || /127\.0\.0\.1:3000/.test(url);
      // On server, join the stream room for viewer updates; otherwise, send a hello for demo presence
      if (isServer) {
        rawSend({ type: "joinStream", streamId: opts.streamId });
      } else {
        const hello: RealtimeMessage = { type: "system", streamId: opts.streamId, text: `${opts.user} joined`, ts: Date.now() };
        safeSend(hello);
      }
    };

    ws.onmessage = (ev) => {
      try {
        const data = typeof ev.data === "string" ? ev.data : String(ev.data);
        const raw = JSON.parse(data) as any;
        // Server compatibility mapping -> normalize to RealtimeMessage
        if (raw && typeof raw === "object" && typeof raw.type === "string") {
          switch (raw.type) {
            case "viewerCount": {
              const m: RealtimeMessage = {
                type: "viewer_update",
                streamId: raw.streamId ?? opts.streamId,
                viewers: typeof raw.count === "number" ? raw.count : Number(raw.count ?? 0),
                ts: raw.ts ?? raw.timestamp ?? Date.now(),
              };
              emitMessage(m);
              return;
            }
            case "chatMessage": {
              const m: RealtimeMessage = {
                type: "chat",
                streamId: raw.streamId ?? opts.streamId,
                user: raw.username || raw.user || "anon",
                text: raw.message ?? "",
                ts: raw.ts ?? raw.timestamp ?? Date.now(),
              } as const;
              emitMessage(m);
              return;
            }
            case "streamStarted": {
              const streamId = raw.stream?.id ?? raw.streamId ?? opts.streamId;
              emitMessage({ type: "system", streamId, text: "Stream started", ts: Date.now() });
              return;
            }
            case "streamEnded": {
              const sid = raw.streamId ?? raw.stream?.id ?? opts.streamId;
              emitMessage({ type: "system", streamId: sid, text: "Stream ended", ts: Date.now() });
              return;
            }
            default:
              break;
          }
        }
        // Fallback: assume payload already matches our client shape
        const msg = raw as RealtimeMessage;
        emitMessage(msg);
      } catch {
        // Non-JSON or unknown payloads from echo server can be ignored
      }
    };

    ws.onerror = () => {
      emitStatus("error");
    };

    ws.onclose = () => {
      emitStatus("closed");
      if (!manualClose) scheduleReconnect();
    };
  }

  function scheduleReconnect() {
    if (manualClose) return;
    if (retries >= maxRetries) return;
    retries += 1;
    const delay = Math.min(10000, baseDelay * Math.pow(1.8, retries));
    setTimeout(() => connect(), delay);
  }

  function withQuery(base: string, params: Record<string, string>) {
    try {
      const u = new URL(base);
      for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
      return u.toString();
    } catch {
      // if relative or malformed, just append query
      const q = new URLSearchParams(params).toString();
      return `${base}${base.includes("?") ? "&" : "?"}${q}`;
    }
  }

  function safeSend(m: RealtimeMessage) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(m));
  }
  function rawSend(payload: any) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(payload));
  }

  function close() {
    manualClose = true;
    emitStatus("closing");
    // best-effort leave notification when connected to server
    try {
      if (ws && ws.readyState === WebSocket.OPEN) {
        const isServer = /\/ws(\?|$)/.test(url) || /localhost:3000/.test(url) || /127\.0\.0\.1:3000/.test(url);
        if (isServer) rawSend({ type: "leaveStream", streamId: opts.streamId });
      }
    } catch {}
    ws?.close();
  }

  function on(event: "status", handler: StatusHandler): void;
  function on(event: "message", handler: MessageHandler): void;
  function on(event: "status" | "message", handler: StatusHandler | MessageHandler) {
    (listeners as any)[event].add(handler as any);
  }
  function off(event: "status", handler: StatusHandler): void;
  function off(event: "message", handler: MessageHandler): void;
  function off(event: "status" | "message", handler: StatusHandler | MessageHandler) {
    (listeners as any)[event].delete(handler as any);
  }

  return {
    status: () => _status,
    connect,
    close,
    on,
    off,
    send: (msg: RealtimeMessage) => safeSend({ ...msg, ts: msg.ts ?? Date.now() }),
    sendChat: (text: string) => {
      const isServer = /\/ws(\?|$)/.test(url) || /localhost:3000/.test(url) || /127\.0\.0\.1:3000/.test(url);
      if (isServer) {
        rawSend({ type: "chatMessage", streamId: opts.streamId, message: text, username: opts.user, timestamp: Date.now() });
      } else {
        safeSend({ type: "chat", streamId: opts.streamId, user: opts.user, text, ts: Date.now() });
      }
    },
    sendTip: (amount: number, message?: string) => {
      const isServer = /\/ws(\?|$)/.test(url) || /localhost:3000/.test(url) || /127\.0\.0\.1:3000/.test(url);
      if (isServer) {
        // Server tip broadcast not implemented; send a chat fallback and emit local tip for UX responsiveness
        rawSend({ type: "chatMessage", streamId: opts.streamId, message: message ? `tipped $${amount.toFixed(2)} — ${message}` : `tipped $${amount.toFixed(2)}`, username: opts.user, timestamp: Date.now() });
        emitMessage({ type: "tip", streamId: opts.streamId, user: opts.user, amount, message, ts: Date.now() } as RealtimeMessage);
      } else {
        safeSend({ type: "tip", streamId: opts.streamId, user: opts.user, amount, message, ts: Date.now() });
      }
    },
    sendTyping: (isTyping: boolean) => {
      const isServer = /\/ws(\?|$)/.test(url) || /localhost:3000/.test(url) || /127\.0\.0\.1:3000/.test(url);
      if (!isServer) {
        safeSend({ type: "typing", streamId: opts.streamId, user: opts.user, isTyping, ts: Date.now() });
      }
      // No-op on server: typing is not currently supported
    },
  };
}
