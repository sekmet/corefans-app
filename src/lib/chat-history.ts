export type ChatRecord = {
  id: string;
  user: string;
  text: string;
  type: "chat" | "tip" | "system";
  ts: number;
  amount?: number;
};

const CHAT_KEY = (streamId: string) => `cf:chat:${streamId}`;
const TIPS_KEY = (streamId: string) => `cf:tips:${streamId}`;

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadChatHistory(streamId: string, limit = 200): ChatRecord[] {
  if (typeof window === "undefined") return [];
  const list = safeParse<ChatRecord[]>(localStorage.getItem(CHAT_KEY(streamId)), []);
  return list.slice(-limit);
}

export function appendChatHistory(streamId: string, rec: ChatRecord, limit = 200) {
  if (typeof window === "undefined") return;
  const list = loadChatHistory(streamId, limit + 1);
  list.push(rec);
  const trimmed = list.slice(-limit);
  localStorage.setItem(CHAT_KEY(streamId), JSON.stringify(trimmed));
}

export function clearChatHistory(streamId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CHAT_KEY(streamId));
}

export function loadTipsHistory(streamId: string, limit = 50): ChatRecord[] {
  if (typeof window === "undefined") return [];
  const list = safeParse<ChatRecord[]>(localStorage.getItem(TIPS_KEY(streamId)), []);
  return list.slice(-limit);
}

export function appendTipHistory(streamId: string, rec: ChatRecord, limit = 50) {
  if (typeof window === "undefined") return;
  const list = loadTipsHistory(streamId, limit + 1);
  list.unshift(rec); // tips are shown newest-first in UI
  const trimmed = list.slice(0, limit);
  localStorage.setItem(TIPS_KEY(streamId), JSON.stringify(trimmed));
}
