// Lightweight client for profile APIs and MinIO presigned uploads
// Uses VITE_AUTH_BASE_URL for cross-origin server, falls back to same-origin

export type MyProfile = {
  userId: string;
  displayName: string;
  username?: string;
  website: string;
  country: string;
  location: string;
  birthday: string | null;
  avatarBucket: string | null;
  avatarKey: string | null;
  coverBucket: string | null;
  coverKey: string | null;
  avatarUrl?: string;
  coverUrl?: string;
};

export type UpdateProfileInput = {
  displayName?: string | null;
  username?: string | null;
  website?: string | null;
  country?: string | null;
  location?: string | null;
  birthday?: string | null; // YYYY-MM-DD
  avatarBucket?: string | null;
  avatarKey?: string | null;
  coverBucket?: string | null;
  coverKey?: string | null;
};

const apiBase = (() => {
  const base = (import.meta as any).env?.VITE_AUTH_BASE_URL as string | undefined;
  return base ? base.replace(/\/$/, "") : "";
})();

function url(path: string) {
  return `${apiBase}${path}`;
}

export async function getMyProfile(): Promise<MyProfile> {
  const res = await fetch(url(`/api/profile/me`), {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`getMyProfile failed: ${res.status}`);
  return res.json();
}

export async function updateMyProfile(input: UpdateProfileInput): Promise<{ ok: boolean }> {
  const res = await fetch(url(`/api/profile`), {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    let msg = `updateMyProfile failed: ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export async function getPublicProfileByUsername(username: string): Promise<MyProfile> {
  const sp = new URLSearchParams({ username });
  const res = await fetch(url(`/api/profile/by-username?${sp.toString()}`), {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) {
    let msg = `getPublicProfileByUsername failed: ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export async function presignUpload(params: { bucket: string; key: string; contentType?: string }) {
  const res = await fetch(url(`/api/cms/upload-request`), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`presignUpload failed: ${res.status}`);
  return (await res.json()) as { url: string; bucket: string; key: string; expirySec: number };
}

export async function uploadFileToSignedUrl(signedUrl: string, file: File | Blob, contentType?: string) {
  const res = await fetch(signedUrl, {
    method: "PUT",
    headers: contentType ? { "Content-Type": contentType } : undefined,
    body: file,
  });
  if (!res.ok) throw new Error(`upload failed: ${res.status}`);
}
