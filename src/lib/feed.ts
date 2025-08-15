// Lightweight client for feed endpoints
// Mirrors server routes under /api/feed/posts and helpers for mutations

export type ApiFeedPost = {
  id: string;
  user: { name: string; handle: string; avatarUrl?: string | null };
  timestamp: string; // ISO string
  ppv?: boolean;
  imageUrl?: string | null;
  content?: string | null;
  liked?: boolean;
  hasPoll?: boolean;
  stats: { likes: number; comments: number; tips: number };
};

export type GetFeedParams = {
  limit?: number;
  before?: string; // ISO
  authorId?: string;
};

export type GetFeedResponse = {
  items: ApiFeedPost[];
};

export type CreatePostInput = {
  content?: string;
  imageUrl?: string;
  isPpv?: boolean;
};

export type CreatePostResponse = {
  ok: boolean;
  post: ApiFeedPost & { stats: { likes: number; comments: number; tips: number } };
};

export type ToggleLikeResponse = { ok: true; liked: boolean; likes: number };

export type AddCommentResponse = {
  ok: boolean;
  comment: {
    id: string;
    postId: string;
    user: { name: string; handle: string };
    content: string;
    createdAt: string;
  };
};

export type ListCommentsResponse = {
  items: Array<{
    id: string;
    user: { name: string; handle: string; avatarUrl?: string };
    content: string;
    createdAt: string;
  }>;
};

const apiBase = (() => {
  // Prefer a test/runtime override, then process.env; default to relative paths
  const fromGlobal = (globalThis as any).__VITE_AUTH_BASE_URL__ as string | undefined;
  const fromProcess =
    typeof process !== "undefined" ? ((process as any).env?.VITE_AUTH_BASE_URL as string | undefined) : undefined;
  const base = fromGlobal || fromProcess || "";
  return base ? base.replace(/\/$/, "") : "";
})();

function url(path: string) {
  return `${apiBase}${path}`;
}

export async function getFeed(params: GetFeedParams = {}): Promise<GetFeedResponse> {
  const qs = new URLSearchParams();
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.before) qs.set("before", params.before);
  if (params.authorId) qs.set("authorId", params.authorId);
  const res = await fetch(url(`/api/feed/posts?${qs.toString()}`), {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`getFeed failed: ${res.status}`);
  return res.json();
}

export async function createPost(input: CreatePostInput): Promise<CreatePostResponse> {
  const res = await fetch(url(`/api/feed/posts`), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input ?? {}),
  });
  if (!res.ok) {
    let msg = `createPost failed: ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export async function toggleLike(postId: string): Promise<ToggleLikeResponse> {
  const res = await fetch(url(`/api/feed/posts/${encodeURIComponent(postId)}/like`), {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`toggleLike failed: ${res.status}`);
  return res.json();
}

export async function addComment(postId: string, content: string): Promise<AddCommentResponse> {
  const res = await fetch(url(`/api/feed/posts/${encodeURIComponent(postId)}/comments`), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`addComment failed: ${res.status}`);
  return res.json();
}

export async function listComments(postId: string, opts?: { limit?: number; offset?: number }): Promise<ListCommentsResponse> {
  const qs = new URLSearchParams();
  if (opts?.limit) qs.set("limit", String(opts.limit));
  if (opts?.offset) qs.set("offset", String(opts.offset));
  const res = await fetch(url(`/api/feed/posts/${encodeURIComponent(postId)}/comments?${qs.toString()}`), {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`listComments failed: ${res.status}`);
  return res.json();
}

export type VotePollResponse = {
  ok: boolean;
  postId: string;
  selectedOptionId: number | null;
  totalVotes: number;
  results: Array<{ optionId: number; text: string; votes: number }>;
};

export async function votePoll(postId: string, optionId: number): Promise<VotePollResponse> {
  const res = await fetch(url(`/api/polls/${encodeURIComponent(postId)}/vote`), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ optionId }),
  });
  if (!res.ok) {
    let msg = `votePoll failed: ${res.status}`;
    try {
      const j = await res.json();
      if ((j as any)?.error) msg = (j as any).error;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export type GetPollResponse = {
  ok: boolean;
  postId: string;
  question: string;
  multipleChoice: boolean;
  expiresAt: string | null;
  expired: boolean;
  selectedOptionId: number | null;
  totalVotes: number;
  options: Array<{ optionId: number; text: string; votes: number }>;
};

export async function getPoll(postId: string): Promise<GetPollResponse> {
  const res = await fetch(url(`/api/polls/${encodeURIComponent(postId)}`), {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) {
    let msg = `getPoll failed: ${res.status}`;
    try {
      const j = await res.json();
      if ((j as any)?.error) msg = (j as any).error;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}
