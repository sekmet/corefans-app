// Lightweight client for follow/unfollow APIs
// Uses VITE_AUTH_BASE_URL for cross-origin server, falls back to same-origin

export type FollowStatus = {
  followerId: string;
  targetId: string;
  following: boolean;
};

const apiBase = (() => {
  const base = (import.meta as any).env?.VITE_AUTH_BASE_URL as string | undefined;
  return base ? base.replace(/\/$/, "") : "";
})();

function url(path: string) {
  return `${apiBase}${path}`;
}

export async function followUser(targetId: string): Promise<{ ok: boolean; following: boolean }> {
  const res = await fetch(url(`/api/follow`), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetId }),
  });
  if (!res.ok) throw new Error(`Follow failed: ${res.status}`);
  return res.json();
}

export async function unfollowUser(targetId: string): Promise<{ ok: boolean; following: boolean }> {
  const res = await fetch(url(`/api/unfollow`), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetId }),
  });
  if (!res.ok) throw new Error(`Unfollow failed: ${res.status}`);
  return res.json();
}

export async function getFollowStatus(targetId: string, followerId?: string): Promise<FollowStatus> {
  const sp = new URLSearchParams({ targetId });
  if (followerId) sp.set("followerId", followerId);
  const res = await fetch(url(`/api/follow/status?${sp.toString()}`), {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Status failed: ${res.status}`);
  return res.json();
}

export async function listFollowers(userId: string, limit = 50, offset = 0) {
  const sp = new URLSearchParams({ userId, limit: String(limit), offset: String(offset) });
  const res = await fetch(url(`/api/followers?${sp.toString()}`), { credentials: "include" });
  if (!res.ok) throw new Error(`Followers failed: ${res.status}`);
  return res.json() as Promise<{ userId: string; followers: { userId: string; followedAt: string }[] }>;
}

export async function listFollowing(userId: string, limit = 50, offset = 0) {
  const sp = new URLSearchParams({ userId, limit: String(limit), offset: String(offset) });
  const res = await fetch(url(`/api/following?${sp.toString()}`), { credentials: "include" });
  if (!res.ok) throw new Error(`Following failed: ${res.status}`);
  return res.json() as Promise<{ userId: string; following: { userId: string; followedAt: string }[] }>;
}

export async function getFollowCounts(userId: string) {
  const sp = new URLSearchParams({ userId });
  const res = await fetch(url(`/api/follow/counts?${sp.toString()}`), { credentials: "include" });
  if (!res.ok) throw new Error(`Counts failed: ${res.status}`);
  return res.json() as Promise<{ userId: string; followers: number; following: number }>;
}
