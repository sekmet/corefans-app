import { auth } from "./auth";
import { presignPut, presignGet, MINIO_BUCKET_VIDEOS, MINIO_BUCKET_THUMBS } from "./minio";
import { publicClient, getWalletClient } from "./viem";
import { SubscriptionManagerAbi } from "../src/services/abis/SubscriptionManager";
import { erc20Abi } from "../src/services/abis/erc20";
import { pool, ensureFollowSchema, ensureProfileSchema, ensureFeedSchema } from "./db";

const PORT = Number(process.env.PORT || 3000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const TRUSTED_ORIGINS = (process.env.TRUSTED_ORIGINS ?? CLIENT_ORIGIN)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Optional streaming bases for encoder/playback hints
const RTMP_BASE_URL = (process.env.RTMP_BASE_URL || process.env.VITE_RTMP_BASE_URL || "rtmp://localhost:1935/live").replace(/\/$/, "");
const HLS_BASE_URL = (process.env.HLS_BASE_URL || process.env.VITE_HLS_BASE_URL || "").replace(/\/$/, "");

// Ensure DB schema for follows and profiles exists (fire-and-forget)
ensureFollowSchema().catch((e) => console.error("[DB] ensureFollowSchema failed", e));
ensureProfileSchema().catch((e) => console.error("[DB] ensureProfileSchema failed", e));
ensureFeedSchema().catch((e) => console.error("[DB] ensureFeedSchema failed", e));

// --- Live Streams (in-memory) ---
type LiveStream = {
  id: string;
  userId: string;
  username: string;
  title: string;
  description?: string;
  isLive: boolean;
  viewers: number;
  startTime: string; // ISO
  endTime?: string; // ISO
  streamKey: string;
  // Optional convenience fields for clients
  rtmpUrl?: string;
  playbackUrl?: string;
};

// Live streams registry and viewer sets
const liveStreams = new Map<string, LiveStream>();
const streamViewers = new Map<string, Set<ServerWebSocket<any>>>();

function withCors(resp: Response, req?: Request) {
  const headers = new Headers(resp.headers);
  const origin = req?.headers.get("origin");
  const allowed = origin && TRUSTED_ORIGINS.includes(origin) ? origin : CLIENT_ORIGIN;
  headers.set("Access-Control-Allow-Origin", allowed);
  headers.set("Vary", "Origin");
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );
  headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
  return new Response(resp.body, { status: resp.status, headers });
}

const server = Bun.serve({
  port: PORT,
  fetch: async (req: Request) => {
    const url = new URL(req.url);

    // CORS preflight
    if (req.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }), req);
    }

    // Posts: create rich post with attachments/scheduling/pricing/poll (auth required)
    if (url.pathname === "/api/post" && req.method === "POST") {
      try {
        const session = await auth.api.getSession({ headers: req.headers });
        if (!session) {
          return withCors(
            new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } }),
            req,
          );
        }
        const userId = session.user.id;
        const body: any = await req.json().catch(() => ({}));

        // Extract and validate payload
        const contentRaw = (body.content as string | undefined) ?? "";
        const content = contentRaw ? String(contentRaw).slice(0, 10000) : null;
        const attachments = Array.isArray(body.attachments) ? body.attachments.slice(0, 4) : [];
        const visibility = (body.visibility as string | undefined) ?? "public";
        const priceUsdCents = body.priceUsdCents as number | undefined;
        const scheduledAtStr = body.scheduledAt as string | undefined;
        const poll = body.poll as
          | { question: string; options: string[]; multipleChoice?: boolean; expiresAt?: string }
          | undefined;

        if (!content && attachments.length === 0) {
          return withCors(
            new Response(JSON.stringify({ error: "content or attachments required" }), { status: 400, headers: { "Content-Type": "application/json" } }),
            req,
          );
        }
        if (!["public", "subscribers", "ppv"].includes(visibility)) {
          return withCors(
            new Response(JSON.stringify({ error: "invalid visibility" }), { status: 400, headers: { "Content-Type": "application/json" } }),
            req,
          );
        }
        if (visibility === "ppv") {
          const cents = Number(priceUsdCents ?? NaN);
          if (!Number.isInteger(cents) || cents < 100 || cents > 1000000) {
            return withCors(
              new Response(JSON.stringify({ error: "invalid priceUsdCents" }), { status: 400, headers: { "Content-Type": "application/json" } }),
              req,
            );
          }
        }

        let scheduledAt: Date | null = null;
        if (scheduledAtStr) {
          const d = new Date(scheduledAtStr);
          if (isNaN(d.getTime())) {
            return withCors(
              new Response(JSON.stringify({ error: "invalid scheduledAt" }), { status: 400, headers: { "Content-Type": "application/json" } }),
              req,
            );
          }
          const now = Date.now();
          const max = now + 365 * 24 * 60 * 60 * 1000;
          if (d.getTime() <= now || d.getTime() > max) {
            return withCors(
              new Response(JSON.stringify({ error: "scheduledAt must be in the future (<=365d)" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
              }),
              req,
            );
          }
          scheduledAt = d;
        }

        // Validate attachments minimal shape and keys
        for (const a of attachments) {
          const key = String(a?.key ?? "");
          const bucket = String(a?.bucket ?? "");
          if (!key || !bucket) {
            return withCors(
              new Response(JSON.stringify({ error: "attachment bucket and key required" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
              }),
              req,
            );
          }
          if (key.includes("..")) {
            return withCors(
              new Response(JSON.stringify({ error: "invalid attachment key" }), { status: 400, headers: { "Content-Type": "application/json" } }),
              req,
            );
          }
        }

        // Poll validation
        if (poll) {
          const q = String(poll.question ?? "").trim();
          const opts = Array.isArray(poll.options) ? poll.options : [];
          if (!q || q.length > 200) {
            return withCors(new Response(JSON.stringify({ error: "invalid poll.question" }), { status: 400, headers: { "Content-Type": "application/json" } }), req);
          }
          if (opts.length < 2 || opts.length > 6) {
            return withCors(new Response(JSON.stringify({ error: "poll.options must be 2..6" }), { status: 400, headers: { "Content-Type": "application/json" } }), req);
          }
          for (const o of opts) {
            if (!o || String(o).trim().length === 0 || String(o).length > 120) {
              return withCors(
                new Response(JSON.stringify({ error: "invalid poll option" }), { status: 400, headers: { "Content-Type": "application/json" } }),
                req,
              );
            }
          }
          if (poll.expiresAt) {
            const d = new Date(poll.expiresAt);
            if (isNaN(d.getTime())) {
              return withCors(new Response(JSON.stringify({ error: "invalid poll.expiresAt" }), { status: 400, headers: { "Content-Type": "application/json" } }), req);
            }
          }
        }

        // Best-effort author profile for display
        let displayName: string | null = (session.user as any)?.name || (session.user as any)?.email || null;
        let username: string | null = null;
        try {
          const r = await pool.query("SELECT display_name, username FROM public.user_profiles WHERE user_id=$1 LIMIT 1", [userId]);
          if (r.rowCount && r.rows[0]) {
            displayName = r.rows[0].display_name ?? displayName;
            username = r.rows[0].username ?? null;
          }
        } catch {}
        const handle = username ? `@${username}` : `@user-${String(userId).slice(0, 6)}`;

        // Transactional insert
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const id = crypto.randomUUID();
          const status = scheduledAt ? "scheduled" : "published";
          const isPpv = visibility === "ppv";

          await client.query(
            `INSERT INTO public.posts (id, author_id, author_name, author_handle, author_avatar_url, content, image_url, is_ppv, visibility, status, scheduled_at, price_usd_cents, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now(), now())`,
            [
              id,
              userId,
              displayName ?? "",
              handle,
              null,
              content,
              null,
              isPpv,
              visibility,
              status,
              scheduledAt ? scheduledAt.toISOString() : null,
              visibility === "ppv" ? priceUsdCents ?? null : null,
            ],
          );

          // media
          for (let i = 0; i < attachments.length; i++) {
            const a = attachments[i];
            await client.query(
              `INSERT INTO public.post_media (post_id, position, bucket, key, content_type, size_bytes, width, height, duration_sec)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
              [
                id,
                i,
                a.bucket,
                a.key,
                a.contentType ?? null,
                a.size ?? null,
                a.width ?? null,
                a.height ?? null,
                a.durationSec ?? null,
              ],
            );
          }

          // poll
          if (poll) {
            await client.query(
              `INSERT INTO public.post_polls (post_id, question, multiple_choice, expires_at)
               VALUES ($1,$2,$3,$4)`,
              [id, String(poll.question).trim(), Boolean(poll.multipleChoice), poll.expiresAt ? new Date(poll.expiresAt).toISOString() : null],
            );
            for (let i = 0; i < poll.options.length; i++) {
              await client.query(
                `INSERT INTO public.post_poll_options (post_id, position, text) VALUES ($1,$2,$3)`,
                [id, i, String(poll.options[i]).trim()],
              );
            }
          }

          await client.query("COMMIT");
          return withCors(new Response(JSON.stringify({ ok: true, id }), { headers: { "Content-Type": "application/json" } }), req);
        } catch (e) {
          // Roll back the same transaction client on error
          try {
            await client.query("ROLLBACK");
          } catch {}
          return withCors(
            new Response(JSON.stringify({ error: "failed to create post" }), { status: 500, headers: { "Content-Type": "application/json" } }),
            req,
          );
        } finally {
          try {
            client.release();
          } catch {}
        }
      } catch (e) {
        return withCors(new Response(JSON.stringify({ error: "failed to create post" }), { status: 500, headers: { "Content-Type": "application/json" } }), req);
      }
    }

    // Polls: get poll details and results
    if (url.pathname.startsWith("/api/polls/") && !url.pathname.endsWith("/vote") && req.method === "GET") {
      try {
        // session optional (to include user's selection if logged in)
        const session = await auth.api.getSession({ headers: req.headers }).catch(() => null);
        const userId = session?.user?.id ?? null;
        const parts = url.pathname.split("/");
        const postId = parts[3]; // /api/polls/:postId
        if (!postId) {
          return withCors(new Response(JSON.stringify({ error: "postId required" }), { status: 400, headers: { "Content-Type": "application/json" } }), req);
        }

        const pollRes = await pool.query(
          `SELECT post_id, question, multiple_choice, expires_at FROM public.post_polls WHERE post_id=$1`,
          [postId],
        );
        if (pollRes.rowCount === 0) {
          return withCors(new Response(JSON.stringify({ error: "poll not found" }), { status: 404, headers: { "Content-Type": "application/json" } }), req);
        }
        const poll = pollRes.rows[0];

        const optionsRes = await pool.query(
          `SELECT o.id as option_id, o.text, o.position, COALESCE(COUNT(v.user_id),0) AS votes
           FROM public.post_poll_options o
           LEFT JOIN public.post_poll_votes v ON v.option_id = o.id
           WHERE o.post_id=$1
           GROUP BY o.id, o.text, o.position
           ORDER BY o.position ASC`,
          [postId],
        );
        const totalRes = await pool.query(`SELECT COUNT(*)::int AS total FROM public.post_poll_votes WHERE post_id=$1`, [postId]);
        let mySelected: number | null = null;
        if (userId) {
          const myRes = await pool.query(
            `SELECT option_id FROM public.post_poll_votes WHERE post_id=$1 AND user_id=$2`,
            [postId, userId],
          );
          mySelected = myRes.rows[0]?.option_id ?? null;
        }

        const expiresAt: string | null = poll.expires_at ? new Date(poll.expires_at).toISOString() : null;
        const expired = poll.expires_at ? Date.now() >= new Date(poll.expires_at).getTime() : false;
        const payload = {
          ok: true,
          postId,
          question: poll.question as string,
          multipleChoice: Boolean(poll.multiple_choice),
          expiresAt,
          expired,
          selectedOptionId: mySelected,
          totalVotes: totalRes.rows[0]?.total ?? 0,
          options: optionsRes.rows.map((r) => ({ optionId: Number(r.option_id), text: r.text as string, votes: Number(r.votes) })),
        };
        return withCors(new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json" } }), req);
      } catch (e) {
        return withCors(new Response(JSON.stringify({ error: "failed to load poll" }), { status: 500, headers: { "Content-Type": "application/json" } }), req);
      }
    }

    // Polls: cast or change vote (one-vote-per-user)
    if (url.pathname.startsWith("/api/polls/") && url.pathname.endsWith("/vote") && req.method === "POST") {
      try {
        const session = await auth.api.getSession({ headers: req.headers });
        if (!session) {
          return withCors(
            new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } }),
            req,
          );
        }
        const userId = session.user.id;
        const parts = url.pathname.split("/");
        const postId = parts[3]; // /api/polls/:postId/vote
        if (!postId) {
          return withCors(new Response(JSON.stringify({ error: "postId required" }), { status: 400, headers: { "Content-Type": "application/json" } }), req);
        }
        const body: any = await req.json().catch(() => ({}));
        const optionIdRaw = body.optionId;
        const optionId = Number(optionIdRaw);
        if (!Number.isInteger(optionId)) {
          return withCors(new Response(JSON.stringify({ error: "valid optionId required" }), { status: 400, headers: { "Content-Type": "application/json" } }), req);
        }

        // Ensure poll exists and option belongs to post
        const pollRes = await pool.query("SELECT post_id FROM public.post_polls WHERE post_id=$1", [postId]);
        if (pollRes.rowCount === 0) {
          return withCors(new Response(JSON.stringify({ error: "poll not found" }), { status: 404, headers: { "Content-Type": "application/json" } }), req);
        }
        const optRes = await pool.query("SELECT id FROM public.post_poll_options WHERE id=$1 AND post_id=$2", [optionId, postId]);
        if (optRes.rowCount === 0) {
          return withCors(new Response(JSON.stringify({ error: "option not found for post" }), { status: 400, headers: { "Content-Type": "application/json" } }), req);
        }

        // Upsert vote
        await pool.query(
          `INSERT INTO public.post_poll_votes (post_id, option_id, user_id, created_at)
           VALUES ($1,$2,$3, now())
           ON CONFLICT (post_id, user_id)
           DO UPDATE SET option_id=EXCLUDED.option_id, created_at=now()`,
          [postId, optionId, userId],
        );

        // Return tallies and user's choice
        const resultsRes = await pool.query(
          `SELECT o.id as option_id, o.text, COALESCE(COUNT(v.user_id),0) AS votes
           FROM public.post_poll_options o
           LEFT JOIN public.post_poll_votes v ON v.option_id = o.id
           WHERE o.post_id=$1
           GROUP BY o.id, o.text
           ORDER BY o.position ASC`,
          [postId],
        );
        const totalRes = await pool.query(
          `SELECT COUNT(*)::int as total FROM public.post_poll_votes WHERE post_id=$1`,
          [postId],
        );
        const myRes = await pool.query(
          `SELECT option_id FROM public.post_poll_votes WHERE post_id=$1 AND user_id=$2`,
          [postId, userId],
        );
        const payload = {
          ok: true,
          postId,
          selectedOptionId: myRes.rows[0]?.option_id ?? null,
          totalVotes: totalRes.rows[0]?.total ?? 0,
          results: resultsRes.rows.map((r) => ({ optionId: Number(r.option_id), text: r.text as string, votes: Number(r.votes) })),
        };
        return withCors(new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json" } }), req);
      } catch (e) {
        return withCors(new Response(JSON.stringify({ error: "failed to vote" }), { status: 500, headers: { "Content-Type": "application/json" } }), req);
      }
    }

    // WebSocket upgrade for real-time stream features
    if (url.pathname === "/ws") {
      const session = await auth.api.getSession({ headers: req.headers });
      const user = session?.user;
      const ok = server.upgrade(req, {
        data: {
          userId: user?.id ?? null,
          username: (user as any)?.name || (user as any)?.email || null,
          joined: new Set<string>(),
        },
      });
      if (ok) return; // WebSocket handshake handled
      return withCors(new Response(JSON.stringify({ error: "upgrade failed" }), { status: 500, headers: { "Content-Type": "application/json" } }), req);
    }

    if (url.pathname.startsWith("/api/auth")) {
      const res = await auth.handler(req);
      return withCors(res, req);
    }

    // Profiles: get current user's profile
    if (url.pathname === "/api/profile/me" && req.method === "GET") {
      try {
        const session = await auth.api.getSession({ headers: req.headers });
        if (!session) {
          return withCors(
            new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } }),
            req,
          );
        }
        const userId = session.user.id;
        const r = await pool.query(
          `SELECT user_id, display_name, username, website, country, location, birthday, avatar_bucket, avatar_key, cover_bucket, cover_key, created_at, updated_at
           FROM public.user_profiles WHERE user_id=$1`,
          [userId],
        );
        const row = r.rows[0];
        let avatarUrl: string | undefined;
        let coverUrl: string | undefined;
        if (row?.avatar_bucket && row?.avatar_key) {
          const signed = await presignGet({ bucket: row.avatar_bucket, key: row.avatar_key, expirySec: 600 });
          avatarUrl = signed.url;
        }
        if (row?.cover_bucket && row?.cover_key) {
          const signed = await presignGet({ bucket: row.cover_bucket, key: row.cover_key, expirySec: 600 });
          coverUrl = signed.url;
        }
        const fallbackName = (session.user as any).name || (session.user as any).email?.split("@")[0] || "User";
        const payload = row
          ? {
              userId: row.user_id,
              displayName: row.display_name ?? fallbackName,
              username: row.username ?? undefined,
              website: row.website ?? "",
              country: row.country ?? "",
              location: row.location ?? "",
              birthday: row.birthday ?? null,
              avatarBucket: row.avatar_bucket ?? null,
              avatarKey: row.avatar_key ?? null,
              coverBucket: row.cover_bucket ?? null,
              coverKey: row.cover_key ?? null,
              avatarUrl,
              coverUrl,
            }
          : {
              userId,
              displayName: fallbackName,
              username: (session.user as any).username ?? undefined,
              website: "",
              country: "",
              location: "",
              birthday: null,
              avatarBucket: null,
              avatarKey: null,
              coverBucket: null,
              coverKey: null,
              avatarUrl: (session.user as any).image || (session.user as any).avatarUrl || undefined,
              coverUrl: undefined,
            };
        return withCors(new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json" } }), req);
      } catch (e) {
        return withCors(
          new Response(JSON.stringify({ error: "failed to get profile" }), { status: 500, headers: { "Content-Type": "application/json" } }),
          req,
        );
      }
    }

    // Profiles: update current user's profile
    if (url.pathname === "/api/profile" && req.method === "PUT") {
      try {
        const session = await auth.api.getSession({ headers: req.headers });
        if (!session) {
          return withCors(
            new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } }),
            req,
          );
        }
        const body = await req.json().catch(() => ({}));
        const displayName = (body.displayName as string | undefined)?.toString().slice(0, 120) ?? null;
        const usernameRaw = (body.username as string | undefined)?.toString().slice(0, 60) ?? null;
        const username = usernameRaw ? usernameRaw.replace(/[^a-zA-Z0-9_]/g, "") : null;
        const website = (body.website as string | undefined)?.toString().slice(0, 300) ?? null;
        const country = (body.country as string | undefined)?.toString().slice(0, 120) ?? null;
        const location = (body.location as string | undefined)?.toString().slice(0, 180) ?? null;
        const birthdayStr = body.birthday as string | undefined; // expect YYYY-MM-DD
        const birthday = birthdayStr ? new Date(birthdayStr) : null;
        const avatarBucket = (body.avatarBucket as string | undefined) ?? null;
        const avatarKey = (body.avatarKey as string | undefined) ?? null;
        const coverBucket = (body.coverBucket as string | undefined) ?? null;
        const coverKey = (body.coverKey as string | undefined) ?? null;

        // username validation
        if (username && !/^[a-zA-Z0-9_]{3,}$/.test(username)) {
          return withCors(
            new Response(JSON.stringify({ error: "invalid username" }), { status: 400, headers: { "Content-Type": "application/json" } }),
            req,
          );
        }

        // upsert profile
        try {
          await pool.query(
            `INSERT INTO public.user_profiles (user_id, display_name, username, website, country, location, birthday, avatar_bucket, avatar_key, cover_bucket, cover_key, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now(), now())
             ON CONFLICT (user_id) DO UPDATE SET
               display_name=EXCLUDED.display_name,
               username=EXCLUDED.username,
               website=EXCLUDED.website,
               country=EXCLUDED.country,
               location=EXCLUDED.location,
               birthday=EXCLUDED.birthday,
               avatar_bucket=EXCLUDED.avatar_bucket,
               avatar_key=EXCLUDED.avatar_key,
               cover_bucket=EXCLUDED.cover_bucket,
               cover_key=EXCLUDED.cover_key,
               updated_at=now()`,
            [
              session.user.id,
              displayName,
              username,
              website,
              country,
              location,
              birthday ? new Date(birthday.toDateString()) : null,
              avatarBucket,
              avatarKey,
              coverBucket,
              coverKey,
            ],
          );
        } catch (err: any) {
          // handle unique violation on username
          if (err && err.code === "23505") {
            return withCors(
              new Response(JSON.stringify({ error: "username already taken" }), { status: 409, headers: { "Content-Type": "application/json" } }),
              req,
            );
          }
          throw err;
        }

        return withCors(new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } }), req);
      } catch (e) {
        return withCors(
          new Response(JSON.stringify({ error: "failed to update profile" }), { status: 500, headers: { "Content-Type": "application/json" } }),
          req,
        );
      }
    }

    // Profiles: public lookup by username
    // GET /api/profile/by-username?username=USERNAME (public)
    if (url.pathname === "/api/profile/by-username" && req.method === "GET") {
      try {
        let username = url.searchParams.get("username");
        if (!username) {
          return withCors(
            new Response(JSON.stringify({ error: "username required" }), { status: 400, headers: { "Content-Type": "application/json" } }),
            req,
          );
        }
        // normalize like a handle, strip leading @ and keep [a-zA-Z0-9_]
        username = username.replace(/^@+/, "").replace(/[^a-zA-Z0-9_]/g, "");
        if (username.length < 3) {
          return withCors(
            new Response(JSON.stringify({ error: "invalid username" }), { status: 400, headers: { "Content-Type": "application/json" } }),
            req,
          );
        }
        const r = await pool.query(
          `SELECT user_id, display_name, username, website, country, location, birthday, avatar_bucket, avatar_key, cover_bucket, cover_key
           FROM public.user_profiles WHERE lower(username) = lower($1) LIMIT 1`,
          [username],
        );
        if (!r.rowCount || !r.rows[0]) {
          return withCors(
            new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { "Content-Type": "application/json" } }),
            req,
          );
        }
        const row = r.rows[0];
        let avatarUrl: string | undefined;
        let coverUrl: string | undefined;
        try {
          if (row?.avatar_bucket && row?.avatar_key) {
            const signed = await presignGet({ bucket: row.avatar_bucket, key: row.avatar_key, expirySec: 600 });
            avatarUrl = signed.url;
          }
          if (row?.cover_bucket && row?.cover_key) {
            const signed = await presignGet({ bucket: row.cover_bucket, key: row.cover_key, expirySec: 600 });
            coverUrl = signed.url;
          }
        } catch {}
        const payload = {
          userId: row.user_id as string,
          displayName: (row.display_name as string | null) ?? (row.username as string),
          username: (row.username as string | null) ?? undefined,
          website: (row.website as string | null) ?? "",
          country: (row.country as string | null) ?? "",
          location: (row.location as string | null) ?? "",
          birthday: row.birthday ?? null,
          avatarBucket: (row.avatar_bucket as string | null) ?? null,
          avatarKey: (row.avatar_key as string | null) ?? null,
          coverBucket: (row.cover_bucket as string | null) ?? null,
          coverKey: (row.cover_key as string | null) ?? null,
          avatarUrl,
          coverUrl,
        };
        return withCors(new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json" } }), req);
      } catch (e) {
        return withCors(
          new Response(JSON.stringify({ error: "failed to get profile" }), { status: 500, headers: { "Content-Type": "application/json" } }),
          req,
        );
      }
    }

    // CMS: presign PUT for uploads
    if (url.pathname === "/api/cms/upload-request" && req.method === "POST") {
      try {
        const body = await req.json().catch(() => ({}));
        const key = body.key as string | undefined;
        const contentType = (body.contentType as string | undefined) ?? "application/octet-stream";
        const bucket = (body.bucket as string | undefined) ?? MINIO_BUCKET_VIDEOS;
        if (!key) {
          return withCors(
            new Response(JSON.stringify({ error: "key required" }), { status: 400, headers: { "Content-Type": "application/json" } }),
            req,
          );
        }
        const presigned = await presignPut({ bucket, key, contentType, expirySec: 900 });
        return withCors(
          new Response(JSON.stringify(presigned), { headers: { "Content-Type": "application/json" } }),
          req,
        );
      } catch (e) {
        return withCors(
          new Response(JSON.stringify({ error: "failed to presign" }), { status: 500, headers: { "Content-Type": "application/json" } }),
          req,
        );
      }
    }

    // CMS: presign GET for playback/thumbnail
    if (url.pathname === "/api/cms/signed-get" && req.method === "GET") {
      const bucket = url.searchParams.get("bucket") ?? MINIO_BUCKET_VIDEOS;
      const key = url.searchParams.get("key");
      const thumb = url.searchParams.get("thumb");
      const useBucket = thumb ? MINIO_BUCKET_THUMBS : bucket;
      if (!key) {
        return withCors(
          new Response(JSON.stringify({ error: "key required" }), { status: 400, headers: { "Content-Type": "application/json" } }),
          req,
        );
      }
      try {
        const presigned = await presignGet({ bucket: useBucket, key, expirySec: 600 });
        return withCors(
          new Response(JSON.stringify(presigned), { headers: { "Content-Type": "application/json" } }),
          req,
        );
      } catch {
        return withCors(
          new Response(JSON.stringify({ error: "failed to sign" }), { status: 500, headers: { "Content-Type": "application/json" } }),
          req,
        );
      }
    }

    // POST /api/creator/register
    // Registers the provided creator address using the registry owner's private key.
    // Requires an authenticated session. Intended for simplifying creator onboarding.
    if (url.pathname === "/api/creator/register" && req.method === "POST") {
      try {
        const session = await auth.api.getSession({ headers: req.headers });
        if (!session) {
          return withCors(
            new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } }),
            req,
          );
        }

        const body = await req.json().catch(() => ({}));
        const creator = body.creator as `0x${string}` | undefined;
        const payout = (body.payout as `0x${string}` | undefined) ?? creator;
        const REGISTRY = (process.env.CREATOR_REGISTRY_ADDRESS || process.env.VITE_CREATOR_REGISTRY_ADDRESS) as `0x${string}` | undefined;
        const ownerPrivateKey = process.env.REGISTRY_OWNER_PRIVATE_KEY || process.env.DEV_WALLET_PRIVATE_KEY;

        if (!REGISTRY || !ownerPrivateKey) {
          return withCors(
            new Response(
              JSON.stringify({ error: "server not configured (missing CREATOR_REGISTRY_ADDRESS or owner private key)" }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            ),
            req,
          );
        }
        if (!creator || !payout) {
          return withCors(
            new Response(JSON.stringify({ error: "creator and payout required" }), { status: 400, headers: { "Content-Type": "application/json" } }),
            req,
          );
        }

        // Minimal CreatorRegistry ABI for registration and status
        const CreatorRegistryAbi = [
          {
            type: "function",
            stateMutability: "nonpayable",
            name: "registerCreator",
            inputs: [
              { name: "creator", type: "address" },
              { name: "payout", type: "address" },
            ],
            outputs: [],
          },
          {
            type: "function",
            stateMutability: "view",
            name: "isCreator",
            inputs: [{ name: "creator", type: "address" }],
            outputs: [{ name: "", type: "bool" }],
          },
        ] as const;

        // Prevent duplicate registration
        const already = (await publicClient.readContract({
          address: REGISTRY,
          abi: CreatorRegistryAbi as any,
          functionName: "isCreator",
          args: [creator],
        })) as boolean;
        if (already) {
          return withCors(
            new Response(JSON.stringify({ ok: true, already: true }), { headers: { "Content-Type": "application/json" } }),
            req,
          );
        }

        const wallet = getWalletClient(ownerPrivateKey);
        const hash = await wallet.writeContract({
          address: REGISTRY,
          abi: CreatorRegistryAbi as any,
          functionName: "registerCreator",
          args: [creator, payout],
          account: wallet.account!,
        });
        return withCors(
          new Response(JSON.stringify({ ok: true, txHash: hash }), { headers: { "Content-Type": "application/json" } }),
          req,
        );
      } catch (e) {
        return withCors(
          new Response(JSON.stringify({ error: "failed to register creator" }), { status: 500, headers: { "Content-Type": "application/json" } }),
          req,
        );
      }
    }

    // Dev-only seeding endpoints (gated by env flag and optional key)
    if (url.pathname.startsWith("/api/dev/seed")) {
      const enabled = String(process.env.DEV_SEED_ENABLE || "false").toLowerCase() === "true";
      const requiredKey = process.env.DEV_SEED_KEY;
      const providedKey = req.headers.get("x-dev-seed-key") || "";
      if (!enabled || (requiredKey && providedKey !== requiredKey)) {
        return withCors(new Response(JSON.stringify({ error: "dev seeding disabled" }), { status: 403, headers: { "Content-Type": "application/json" } }), req);
      }

      // Minimal CreatorRegistry ABI for registration
      const CreatorRegistryAbi = [
        {
          type: "function",
          stateMutability: "nonpayable",
          name: "registerCreator",
          inputs: [
            { name: "creator", type: "address" },
            { name: "payout", type: "address" },
          ],
          outputs: [],
        },
        {
          type: "function",
          stateMutability: "view",
          name: "isCreator",
          inputs: [{ name: "creator", type: "address" }],
          outputs: [{ name: "", type: "bool" }],
        },
      ] as const;

      // POST /api/dev/seed/register-creator
      if (url.pathname === "/api/dev/seed/register-creator" && req.method === "POST") {
        try {
          const body = await req.json().catch(() => ({}));
          const ownerPrivateKey = (body.ownerPrivateKey as string | undefined) || process.env.DEV_WALLET_PRIVATE_KEY;
          const creator = body.creator as `0x${string}` | undefined;
          const payout = (body.payout as `0x${string}` | undefined) ?? creator;
          const REGISTRY = (process.env.CREATOR_REGISTRY_ADDRESS || process.env.VITE_CREATOR_REGISTRY_ADDRESS) as `0x${string}` | undefined;
          if (!ownerPrivateKey || !creator || !REGISTRY || !payout) {
            return withCors(new Response(JSON.stringify({ error: "ownerPrivateKey, creator, payout, and CREATOR_REGISTRY_ADDRESS required" }), { status: 400, headers: { "Content-Type": "application/json" } }), req);
          }
          const wallet = getWalletClient(ownerPrivateKey);
          const hash = await wallet.writeContract({
            address: REGISTRY,
            abi: CreatorRegistryAbi as any,
            functionName: "registerCreator",
            args: [creator, payout],
            account: wallet.account!,
          });
          return withCors(new Response(JSON.stringify({ ok: true, txHash: hash }), { headers: { "Content-Type": "application/json" } }), req);
        } catch (e) {
          return withCors(new Response(JSON.stringify({ error: "failed to register creator" }), { status: 500, headers: { "Content-Type": "application/json" } }), req);
        }
      }

      // POST /api/dev/seed/create-tier
      if (url.pathname === "/api/dev/seed/create-tier" && req.method === "POST") {
        try {
          const body = await req.json().catch(() => ({}));
          const privateKey = (body.privateKey as string | undefined) || process.env.DEV_WALLET_PRIVATE_KEY;
          const priceStr = body.price as string | number | undefined; // wei string recommended
          const usdPriceStr = body.usdPrice as string | number | undefined; // 1e8 USD units for oracle tiers
          const duration = Number(body.duration ?? 0);
          const metadataURI = (body.metadataURI as string | undefined) ?? "";
          const paymentToken = (body.paymentToken as `0x${string}` | undefined) ?? ("0x0000000000000000000000000000000000000000" as const);
          const oracle = body.oracle as `0x${string}` | undefined;
          const tokenDecimals = body.tokenDecimals as number | undefined;
          const SUB_MGR = (process.env.SUBSCRIPTION_MANAGER_ADDRESS || process.env.VITE_SUBSCRIPTION_MANAGER_ADDRESS) as `0x${string}` | undefined;
          if (!privateKey || !duration || !SUB_MGR) {
            return withCors(new Response(JSON.stringify({ error: "privateKey, duration, and SUBSCRIPTION_MANAGER_ADDRESS required" }), { status: 400, headers: { "Content-Type": "application/json" } }), req);
          }
          const wallet = getWalletClient(privateKey);
          // Decide createTier vs createTierOracle
          if (usdPriceStr) {
            const usdPrice = BigInt(usdPriceStr);
            const dec = Number(tokenDecimals ?? 18);
            const hash = await wallet.writeContract({
              address: SUB_MGR,
              abi: SubscriptionManagerAbi as any,
              functionName: "createTierOracle",
              args: [usdPrice, BigInt(duration), metadataURI, paymentToken!, oracle ?? ("0x0000000000000000000000000000000000000000" as const), dec],
              account: wallet.account!,
            });
            return withCors(new Response(JSON.stringify({ ok: true, txHash: hash, oracle: true }), { headers: { "Content-Type": "application/json" } }), req);
          } else {
            const price = BigInt(priceStr ?? 0);
            const hash = await wallet.writeContract({
              address: SUB_MGR,
              abi: SubscriptionManagerAbi as any,
              functionName: "createTier",
              args: [price, BigInt(duration), metadataURI, paymentToken!],
              account: wallet.account!,
            });
            return withCors(new Response(JSON.stringify({ ok: true, txHash: hash, oracle: false }), { headers: { "Content-Type": "application/json" } }), req);
          }
        } catch (e) {
          return withCors(new Response(JSON.stringify({ error: "failed to create tier" }), { status: 500, headers: { "Content-Type": "application/json" } }), req);
        }
      }

      // POST /api/dev/seed/subscribe-eth
      if (url.pathname === "/api/dev/seed/subscribe-eth" && req.method === "POST") {
        try {
          const body = await req.json().catch(() => ({}));
          const privateKey = body.privateKey as string | undefined;
          const creator = body.creator as `0x${string}` | undefined;
          const tierId = BigInt(body.tierId ?? 0);
          const valueStr = body.valueWei as string | number | undefined;
          const SUB_MGR = (process.env.SUBSCRIPTION_MANAGER_ADDRESS || process.env.VITE_SUBSCRIPTION_MANAGER_ADDRESS) as `0x${string}` | undefined;
          if (!privateKey || !creator || !SUB_MGR) {
            return withCors(new Response(JSON.stringify({ error: "privateKey, creator, and SUBSCRIPTION_MANAGER_ADDRESS required" }), { status: 400, headers: { "Content-Type": "application/json" } }), req);
          }
          // If no value provided, try to read fixed price
          let value = valueStr !== undefined ? BigInt(valueStr) : undefined;
          if (value === undefined) {
            const t = (await publicClient.readContract({ address: SUB_MGR, abi: SubscriptionManagerAbi as any, functionName: "tiers", args: [creator, tierId] })) as any;
            const usesOracle = (await publicClient.readContract({ address: SUB_MGR, abi: SubscriptionManagerAbi as any, functionName: "tierUsesOracle", args: [creator, tierId] })) as boolean;
            const paymentToken = t.paymentToken as `0x${string}`;
            const isEth = paymentToken === ("0x0000000000000000000000000000000000000000" as const);
            if (!isEth) {
              return withCors(new Response(JSON.stringify({ error: "tier is not ETH tier" }), { status: 400, headers: { "Content-Type": "application/json" } }), req);
            }
            if (usesOracle) {
              return withCors(new Response(JSON.stringify({ error: "oracle-based ETH tier requires explicit valueWei" }), { status: 400, headers: { "Content-Type": "application/json" } }), req);
            }
            value = BigInt(t.price);
          }
          const wallet = getWalletClient(privateKey);
          const hash = await wallet.writeContract({
            address: SUB_MGR,
            abi: SubscriptionManagerAbi as any,
            functionName: "subscribe",
            args: [creator, tierId],
            value: value!,
            account: wallet.account!,
          });
          return withCors(new Response(JSON.stringify({ ok: true, txHash: hash }), { headers: { "Content-Type": "application/json" } }), req);
        } catch (e) {
          return withCors(new Response(JSON.stringify({ error: "failed to subscribe (ETH)" }), { status: 500, headers: { "Content-Type": "application/json" } }), req);
        }
      }

      // POST /api/dev/seed/subscribe-erc20-approve
      if (url.pathname === "/api/dev/seed/subscribe-erc20-approve" && req.method === "POST") {
        try {
          const body = await req.json().catch(() => ({}));
          const privateKey = (body.privateKey as string | undefined) || process.env.DEV_WALLET_PRIVATE_KEY; // user wallet fallback
          const token = body.token as `0x${string}` | undefined;
          const approveValue = BigInt(body.approveValue ?? 0);
          const creator = body.creator as `0x${string}` | undefined;
          const tierId = BigInt(body.tierId ?? 0);
          const SUB_MGR = (process.env.SUBSCRIPTION_MANAGER_ADDRESS || process.env.VITE_SUBSCRIPTION_MANAGER_ADDRESS) as `0x${string}` | undefined;
          if (!privateKey || !token || !creator || !SUB_MGR) {
            return withCors(new Response(JSON.stringify({ error: "privateKey, token, creator, and SUBSCRIPTION_MANAGER_ADDRESS required" }), { status: 400, headers: { "Content-Type": "application/json" } }), req);
          }
          const wallet = getWalletClient(privateKey);
          // Approve
          const approveHash = await wallet.writeContract({
            address: token,
            abi: erc20Abi as any,
            functionName: "approve",
            args: [SUB_MGR, approveValue],
            account: wallet.account!,
          });
          // Subscribe (transferFrom will use allowance)
          const subHash = await wallet.writeContract({
            address: SUB_MGR,
            abi: SubscriptionManagerAbi as any,
            functionName: "subscribe",
            args: [creator, tierId],
            account: wallet.account!,
          });
          return withCors(new Response(JSON.stringify({ ok: true, approveTxHash: approveHash, subscribeTxHash: subHash }), { headers: { "Content-Type": "application/json" } }), req);
        } catch (e) {
          return withCors(new Response(JSON.stringify({ error: "failed to subscribe (ERC20 approve)" }), { status: 500, headers: { "Content-Type": "application/json" } }), req);
        }
      }

      // POST /api/dev/seed/subscribe-erc20-permit
      // Body: { privateKey, token, creator, tierId, value, deadline }
      if (url.pathname === "/api/dev/seed/subscribe-erc20-permit" && req.method === "POST") {
        try {
          const body = await req.json().catch(() => ({}));
          const privateKey = (body.privateKey as string | undefined) || process.env.DEV_WALLET_PRIVATE_KEY; // owner wallet to sign permit
          const token = body.token as `0x${string}` | undefined;
          const creator = body.creator as `0x${string}` | undefined;
          const tierId = BigInt(body.tierId ?? 0);
          const value = BigInt(body.value ?? 0);
          const deadline = BigInt(body.deadline ?? Math.floor(Date.now() / 1000) + 3600);
          const SUB_MGR = (process.env.SUBSCRIPTION_MANAGER_ADDRESS || process.env.VITE_SUBSCRIPTION_MANAGER_ADDRESS) as `0x${string}` | undefined;
          if (!privateKey || !token || !creator || !SUB_MGR) {
            return withCors(new Response(JSON.stringify({ error: "privateKey, token, creator, and SUBSCRIPTION_MANAGER_ADDRESS required" }), { status: 400, headers: { "Content-Type": "application/json" } }), req);
          }
          const wallet = getWalletClient(privateKey);
          const owner = wallet.account!.address as `0x${string}`;

          // Read token name and nonce for EIP-2612 domain/message
          const [name, nonce] = await Promise.all([
            publicClient.readContract({ address: token, abi: erc20Abi as any, functionName: "name" }) as Promise<string>,
            publicClient.readContract({ address: token, abi: erc20Abi as any, functionName: "nonces", args: [owner] }) as Promise<bigint>,
          ]);

          const chainId = Number(process.env.CHAIN_ID || process.env.VITE_CHAIN_ID || 1114);
          const domain = { name, version: "1", chainId, verifyingContract: token } as const;
          const types = {
            Permit: [
              { name: "owner", type: "address" },
              { name: "spender", type: "address" },
              { name: "value", type: "uint256" },
              { name: "nonce", type: "uint256" },
              { name: "deadline", type: "uint256" },
            ],
          } as const;
          const message = {
            owner,
            spender: SUB_MGR,
            value,
            nonce,
            deadline,
          } as const;

          const signature = await wallet.signTypedData({ domain, types, primaryType: "Permit", message } as any);
          const r = ("0x" + signature.slice(2, 66)) as `0x${string}`;
          const s = ("0x" + signature.slice(66, 130)) as `0x${string}`;
          const v = Number("0x" + signature.slice(130, 132));

          const subHash = await wallet.writeContract({
            address: SUB_MGR,
            abi: SubscriptionManagerAbi as any,
            functionName: "subscribeWithPermit",
            args: [creator, tierId, value, deadline, v, r, s],
            account: wallet.account!,
          });

          return withCors(new Response(JSON.stringify({ ok: true, subscribeTxHash: subHash, v, r, s, nonce: nonce.toString() }), { headers: { "Content-Type": "application/json" } }), req);
        } catch (e) {
          return withCors(new Response(JSON.stringify({ error: "failed to subscribe (ERC20 permit)" }), { status: 500, headers: { "Content-Type": "application/json" } }), req);
        }
      }

      return withCors(new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { "Content-Type": "application/json" } }), req);
    }

    // Streams: list live streams
    if (url.pathname === "/api/streams" && req.method === "GET") {
      const list = Array.from(liveStreams.values()).filter((s) => s.isLive);
      return withCors(new Response(JSON.stringify(list), { headers: { "Content-Type": "application/json" } }), req);
    }

    // Streams: start
    if (url.pathname === "/api/stream/start" && req.method === "POST") {
      try {
        const session = await auth.api.getSession({ headers: req.headers });
        if (!session) {
          return withCors(new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } }), req);
        }
        const body = await req.json().catch(() => ({} as any));
        const title = (body.title as string | undefined) ?? `${(session.user as any)?.name || (session.user as any)?.email || "user"}'s Stream`;
        const description = body.description as string | undefined;
        const now = Date.now();
        const id = String(now);
        const streamKey = `stream_${session.user.id}_${now}`;
        const stream: LiveStream = {
          id,
          userId: session.user.id,
          username: (session.user as any)?.name || (session.user as any)?.email || session.user.id,
          title,
          description,
          isLive: true,
          viewers: 0,
          startTime: new Date(now).toISOString(),
          streamKey,
          rtmpUrl: RTMP_BASE_URL,
          playbackUrl: HLS_BASE_URL ? `${HLS_BASE_URL}/${streamKey}.m3u8` : undefined,
        };
        liveStreams.set(stream.id, stream);
        if (!streamViewers.has(stream.id)) streamViewers.set(stream.id, new Set());
        // notify all connected clients (opt-in to receive global updates)
        server.publish("global:streams", JSON.stringify({ type: "streamStarted", stream }));
        return withCors(new Response(JSON.stringify(stream), { headers: { "Content-Type": "application/json" } }), req);
      } catch (e) {
        return withCors(new Response(JSON.stringify({ error: "failed to start stream" }), { status: 500, headers: { "Content-Type": "application/json" } }), req);
      }
    }

    // Streams: stop (stop all live streams owned by current user)
    if (url.pathname === "/api/stream/stop" && req.method === "POST") {
      try {
        const session = await auth.api.getSession({ headers: req.headers });
        if (!session) {
          return withCors(new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } }), req);
        }
        const nowIso = new Date().toISOString();
        const owned = Array.from(liveStreams.values()).filter((s) => s.userId === session.user.id && s.isLive);
        for (const s of owned) {
          s.isLive = false;
          s.endTime = nowIso;
          // broadcast
          server.publish("global:streams", JSON.stringify({ type: "streamEnded", stream: s }));
          // also notify room viewers
          const viewers = streamViewers.get(s.id);
          if (viewers) {
            for (const ws of viewers) {
              ws.send(JSON.stringify({ type: "streamEnded", streamId: s.id }));
            }
          }
        }
        return withCors(new Response(JSON.stringify({ success: true, stopped: owned.map((s) => s.id) }), { headers: { "Content-Type": "application/json" } }), req);
      } catch (e) {
        return withCors(new Response(JSON.stringify({ error: "failed to stop stream" }), { status: 500, headers: { "Content-Type": "application/json" } }), req);
      }
    }

    // Subscriptions: list tiers (cached)
    if (url.pathname === "/api/subscriptions/tiers" && req.method === "GET") {
      try {
        const creator = url.searchParams.get("creator");
        if (!creator) {
          return withCors(
            new Response(JSON.stringify({ error: "creator required" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }),
            req,
          );
        }

        const cacheSec = Number(url.searchParams.get("cacheSec") || 120);
        const cacheKey = `tiers:${creator}`;
        const now = Date.now();
        (globalThis as any)._cache = (globalThis as any)._cache || new Map<string, { value: any; exp: number }>();
        const cache: Map<string, { value: any; exp: number }> = (globalThis as any)._cache;
        const hit = cache.get(cacheKey);
        if (hit && hit.exp > now) {
          return withCors(
            new Response(JSON.stringify(hit.value), { headers: { "Content-Type": "application/json" } }),
            req,
          );
        }

        const SUBSCRIPTION_MANAGER_ADDRESS =
          (process.env.SUBSCRIPTION_MANAGER_ADDRESS || process.env.VITE_SUBSCRIPTION_MANAGER_ADDRESS) as `0x${string}` | undefined;
        if (!SUBSCRIPTION_MANAGER_ADDRESS) {
          return withCors(
            new Response(JSON.stringify({ error: "SUBSCRIPTION_MANAGER_ADDRESS not configured" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }),
            req,
          );
        }

        // read tiers
        const tiersLength = (await publicClient.readContract({
          address: SUBSCRIPTION_MANAGER_ADDRESS,
          abi: SubscriptionManagerAbi as any,
          functionName: "tiersLength",
          args: [creator as `0x${string}`],
        })) as bigint;

        const items: any[] = [];
        for (let i = 0n; i < tiersLength; i++) {
          const t = (await publicClient.readContract({
            address: SUBSCRIPTION_MANAGER_ADDRESS,
            abi: SubscriptionManagerAbi as any,
            functionName: "tiers",
            args: [creator as `0x${string}`, i],
          })) as any;
          const usesOracle = (await publicClient.readContract({
            address: SUBSCRIPTION_MANAGER_ADDRESS,
            abi: SubscriptionManagerAbi as any,
            functionName: "tierUsesOracle",
            args: [creator as `0x${string}`, i],
          })) as boolean;
          const [price, duration, metadataURI, active, paymentToken, deleted] = [
            BigInt(t.price),
            Number(t.duration),
            String(t.metadataURI),
            Boolean(t.active),
            (t.paymentToken as `0x${string}`),
            Boolean(t.deleted),
          ];
          if (active && !deleted) {
            items.push({
              tierId: Number(i),
              price: price.toString(),
              duration,
              metadataURI,
              paymentToken,
              usesOracle,
            });
          }
        }

        const result = { creator, tiers: items };
        cache.set(cacheKey, { value: result, exp: now + cacheSec * 1000 });
        return withCors(new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } }), req);
      } catch (e) {
        return withCors(
          new Response(JSON.stringify({ error: "failed to read tiers" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }),
          req,
        );
      }
    }

    // Subscriptions: USD estimate (lightweight)
    if (url.pathname === "/api/subscriptions/usd-estimate" && req.method === "GET") {
      try {
        const creator = url.searchParams.get("creator");
        const tierIdStr = url.searchParams.get("tierId");
        if (!creator || !tierIdStr) {
          return withCors(
            new Response(JSON.stringify({ error: "creator and tierId required" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }),
            req,
          );
        }
        const tierId = BigInt(tierIdStr);
        const SUBSCRIPTION_MANAGER_ADDRESS =
          (process.env.SUBSCRIPTION_MANAGER_ADDRESS || process.env.VITE_SUBSCRIPTION_MANAGER_ADDRESS) as `0x${string}` | undefined;
        if (!SUBSCRIPTION_MANAGER_ADDRESS) {
          return withCors(
            new Response(JSON.stringify({ error: "SUBSCRIPTION_MANAGER_ADDRESS not configured" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }),
            req,
          );
        }

        const t = (await publicClient.readContract({
          address: SUBSCRIPTION_MANAGER_ADDRESS,
          abi: SubscriptionManagerAbi as any,
          functionName: "tiers",
          args: [creator as `0x${string}`, tierId],
        })) as any;
        const usesOracle = (await publicClient.readContract({
          address: SUBSCRIPTION_MANAGER_ADDRESS,
          abi: SubscriptionManagerAbi as any,
          functionName: "tierUsesOracle",
          args: [creator as `0x${string}`, tierId],
        })) as boolean;

        const price = BigInt(t.price);
        const paymentToken = t.paymentToken as `0x${string}`;

        const nativeZero = "0x0000000000000000000000000000000000000000" as const;
        const rateEnv = (process.env.PRICING_TOKEN_USD_RATES || "USDT:1,USDC:1").split(",");
        const rateMap: Record<string, number> = {};
        for (const entry of rateEnv) {
          const [sym, val] = entry.split(":");
          if (sym && val && !Number.isNaN(Number(val))) rateMap[sym.toUpperCase()] = Number(val);
        }
        const nativeRate = Number(process.env.PRICING_NATIVE_USD_RATE || 0);

        let symbol = "ETH";
        let decimals = 18;
        if (paymentToken !== nativeZero) {
          try {
            symbol = (await publicClient.readContract({
              address: paymentToken,
              abi: erc20Abi as any,
              functionName: "symbol",
              args: [],
            })) as string;
            decimals = Number(
              (await publicClient.readContract({
                address: paymentToken,
                abi: erc20Abi as any,
                functionName: "decimals",
                args: [],
              })) as number,
            );
          } catch {}
        }

        // If oracle-based and we don't have a configured rate, return 501 (not implemented)
        const rate = paymentToken === nativeZero ? nativeRate : rateMap[symbol?.toUpperCase?.() || ""] ?? 0;
        if (usesOracle && rate === 0) {
          return withCors(
            new Response(
              JSON.stringify({
                creator,
                tierId: Number(tierId),
                usesOracle: true,
                message: "USD estimate not configured (set PRICING_* env rates)",
              }),
              { status: 501, headers: { "Content-Type": "application/json" } },
            ),
            req,
          );
        }

        // Compute USD estimate using configured static rate (best-effort)
        const amount = Number(price) / 10 ** decimals;
        const usd = amount * rate;
        return withCors(
          new Response(
            JSON.stringify({
              creator,
              tierId: Number(tierId),
              paymentToken,
              symbol,
              decimals,
              price: price.toString(),
              usdEstimate: usd,
              usesOracle,
              rateUsed: rate,
            }),
            { headers: { "Content-Type": "application/json" } },
          ),
          req,
        );
      } catch (e) {
        return withCors(
          new Response(JSON.stringify({ error: "failed to compute estimate" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }),
          req,
        );
      }
    }

    // Feed: create a new post (auth required)
    if (url.pathname === "/api/feed/posts" && req.method === "POST") {
      try {
        const session = await auth.api.getSession({ headers: req.headers });
        if (!session) {
          return withCors(new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } }), req);
        }
        const body = await req.json().catch(() => ({}));
        const content = (body.content as string | undefined)?.trim() || "";
        const imageUrl = (body.imageUrl as string | undefined) || null;
        const isPpv = Boolean(body.isPpv);
        if (!content && !imageUrl) {
          return withCors(new Response(JSON.stringify({ error: "content or imageUrl required" }), { status: 400, headers: { "Content-Type": "application/json" } }), req);
        }
        const id = crypto.randomUUID();
        const userId = session.user.id;
        // Best-effort profile lookup
        let displayName: string | null = (session.user as any)?.name || (session.user as any)?.email || null;
        let username: string | null = null;
        try {
          const r = await pool.query("SELECT display_name, username FROM public.user_profiles WHERE user_id=$1 LIMIT 1", [userId]);
          if (r.rowCount && r.rows[0]) {
            displayName = r.rows[0].display_name ?? displayName;
            username = r.rows[0].username ?? null;
          }
        } catch {}
        const handle = username ? `@${username}` : `@user-${String(userId).slice(0, 6)}`;
        await pool.query(
          `INSERT INTO public.posts (id, author_id, author_name, author_handle, author_avatar_url, content, image_url, is_ppv)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [id, userId, displayName ?? "", handle, null, content || null, imageUrl, isPpv],
        );
        const created = {
          id,
          user: { name: displayName ?? "", handle, avatarUrl: null },
          timestamp: new Date().toISOString(),
          ppv: isPpv,
          imageUrl: imageUrl ?? undefined,
          content: content || undefined,
          stats: { likes: 0, comments: 0, tips: 0 },
        };
        return withCors(new Response(JSON.stringify({ ok: true, post: created }), { headers: { "Content-Type": "application/json" } }), req);
      } catch (e) {
        return withCors(new Response(JSON.stringify({ error: "failed to create post" }), { status: 500, headers: { "Content-Type": "application/json" } }), req);
      }
    }

    // Feed: list posts (public)
    // GET /api/feed/posts?limit=20&before=ISO&authorId=... (optional)
    if (url.pathname === "/api/feed/posts" && req.method === "GET") {
      try {
        const session = await auth.api.getSession({ headers: req.headers });
        const viewerId = session?.user.id || null;
        const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit") ?? 20)));
        const before = url.searchParams.get("before");
        const authorId = url.searchParams.get("authorId");

        const where: string[] = [];
        const params: any[] = [];
        if (before) {
          params.push(new Date(before).toISOString());
          where.push(`p.created_at < $${params.length}`);
        }
        if (authorId) {
          params.push(authorId);
          where.push(`p.author_id = $${params.length}`);
        }
        const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
        params.push(limit);
        const likedUserParamIndex = params.length + 1; // used in EXISTS subquery

        const q = `
          SELECT p.*,
            (SELECT COUNT(*)::int FROM public.post_likes pl WHERE pl.post_id = p.id) AS likes,
            (SELECT COUNT(*)::int FROM public.post_comments pc WHERE pc.post_id = p.id) AS comments,
            (SELECT COUNT(*)::int FROM public.post_tips pt WHERE pt.post_id = p.id) AS tips,
            EXISTS (SELECT 1 FROM public.post_polls pp WHERE pp.post_id = p.id) AS has_poll,
            CASE WHEN $${likedUserParamIndex}::text IS NULL THEN false ELSE EXISTS (
              SELECT 1 FROM public.post_likes pl2 WHERE pl2.post_id = p.id AND pl2.user_id = $${likedUserParamIndex}
            ) END AS liked
          FROM public.posts p
          ${whereSql}
          ORDER BY p.created_at DESC
          LIMIT $${params.length}
        `;
        const rs = await pool.query(q, [...params, viewerId]);
        const items = rs.rows.map((r) => ({
          id: r.id,
          user: { name: r.author_name, handle: r.author_handle, avatarUrl: r.author_avatar_url || undefined },
          timestamp: (r.created_at as Date).toISOString(),
          ppv: r.is_ppv,
          imageUrl: r.image_url || undefined,
          content: r.content || undefined,
          hasPoll: Boolean((r as any).has_poll),
          liked: Boolean(r.liked),
          stats: { likes: Number(r.likes || 0), comments: Number(r.comments || 0), tips: Number(r.tips || 0) },
        }));
        return withCors(new Response(JSON.stringify({ items }), { headers: { "Content-Type": "application/json" } }), req);
      } catch (e) {
        return withCors(new Response(JSON.stringify({ error: "failed to list posts" }), { status: 500, headers: { "Content-Type": "application/json" } }), req);
      }
    }

    // Feed: like/unlike a post (auth required, toggle)
    if (url.pathname.startsWith("/api/feed/posts/") && url.pathname.endsWith("/like") && req.method === "POST") {
      try {
        const session = await auth.api.getSession({ headers: req.headers });
        if (!session) return withCors(new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } }), req);
        const parts = url.pathname.split("/");
        const postId = parts[4];
        if (!postId) return withCors(new Response(JSON.stringify({ error: "postId required" }), { status: 400, headers: { "Content-Type": "application/json" } }), req);

        const exists = await pool.query("SELECT 1 FROM public.post_likes WHERE post_id=$1 AND user_id=$2", [postId, session.user.id]);
        let liked = false;
        if (exists.rowCount && exists.rowCount > 0) {
          await pool.query("DELETE FROM public.post_likes WHERE post_id=$1 AND user_id=$2", [postId, session.user.id]);
          liked = false;
        } else {
          await pool.query("INSERT INTO public.post_likes (post_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [postId, session.user.id]);
          liked = true;
        }
        const count = await pool.query("SELECT COUNT(*)::int AS c FROM public.post_likes WHERE post_id=$1", [postId]);
        return withCors(new Response(JSON.stringify({ ok: true, liked, likes: count.rows[0]?.c ?? 0 }), { headers: { "Content-Type": "application/json" } }), req);
      } catch (e) {
        return withCors(new Response(JSON.stringify({ error: "failed to like" }), { status: 500, headers: { "Content-Type": "application/json" } }), req);
      }
    }

    // Feed: add a comment to a post (auth required)
    if (url.pathname.startsWith("/api/feed/posts/") && url.pathname.endsWith("/comments") && req.method === "POST") {
      try {
        const session = await auth.api.getSession({ headers: req.headers });
        if (!session) return withCors(new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } }), req);
        const parts = url.pathname.split("/");
        const postId = parts[4];
        if (!postId) return withCors(new Response(JSON.stringify({ error: "postId required" }), { status: 400, headers: { "Content-Type": "application/json" } }), req);
        const body = await req.json().catch(() => ({}));
        const content = (body.content as string | undefined)?.trim() || "";
        if (!content) return withCors(new Response(JSON.stringify({ error: "content required" }), { status: 400, headers: { "Content-Type": "application/json" } }), req);

        const userId = session.user.id;
        let displayName: string | null = (session.user as any)?.name || (session.user as any)?.email || null;
        let username: string | null = null;
        try {
          const r = await pool.query("SELECT display_name, username FROM public.user_profiles WHERE user_id=$1 LIMIT 1", [userId]);
          if (r.rowCount && r.rows[0]) {
            displayName = r.rows[0].display_name ?? displayName;
            username = r.rows[0].username ?? null;
          }
        } catch {}
        const handle = username ? `@${username}` : `@user-${String(userId).slice(0, 6)}`;
        const inserted = await pool.query(
          `INSERT INTO public.post_comments (post_id, user_id, user_name, user_handle, user_avatar_url, content)
           VALUES ($1,$2,$3,$4,$5,$6)
           RETURNING id, created_at`,
          [postId, userId, displayName ?? "", handle, null, content],
        );
        const row = inserted.rows[0];
        return withCors(
          new Response(
            JSON.stringify({ ok: true, comment: { id: row.id, postId, user: { name: displayName ?? "", handle }, content, createdAt: row.created_at } }),
            { headers: { "Content-Type": "application/json" } },
          ),
          req,
        );
      } catch (e) {
        return withCors(new Response(JSON.stringify({ error: "failed to comment" }), { status: 500, headers: { "Content-Type": "application/json" } }), req);
      }
    }

    // Feed: list comments for a post (public)
    if (url.pathname.startsWith("/api/feed/posts/") && url.pathname.endsWith("/comments") && req.method === "GET") {
      try {
        const parts = url.pathname.split("/");
        const postId = parts[4];
        if (!postId) return withCors(new Response(JSON.stringify({ error: "postId required" }), { status: 400, headers: { "Content-Type": "application/json" } }), req);
        const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") ?? 20)));
        const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
        const rs = await pool.query(
          `SELECT id, user_id, user_name, user_handle, user_avatar_url, content, created_at
           FROM public.post_comments WHERE post_id=$1 ORDER BY created_at ASC LIMIT $2 OFFSET $3`,
          [postId, limit, offset],
        );
        const items = rs.rows.map((r) => ({
          id: r.id,
          user: { name: r.user_name, handle: r.user_handle, avatarUrl: r.user_avatar_url || undefined },
          content: r.content,
          createdAt: (r.created_at as Date).toISOString(),
        }));
        return withCors(new Response(JSON.stringify({ items }), { headers: { "Content-Type": "application/json" } }), req);
      } catch (e) {
        return withCors(new Response(JSON.stringify({ error: "failed to list comments" }), { status: 500, headers: { "Content-Type": "application/json" } }), req);
      }
    }

    // Follows: follow a user
    if (url.pathname === "/api/follow" && req.method === "POST") {
      try {
        const session = await auth.api.getSession({ headers: req.headers });
        if (!session) {
          return withCors(
            new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } }),
            req,
          );
        }
        const body = await req.json().catch(() => ({}));
        const targetId = body.targetId as string | undefined;
        if (!targetId) {
          return withCors(
            new Response(JSON.stringify({ error: "targetId required" }), { status: 400, headers: { "Content-Type": "application/json" } }),
            req,
          );
        }
        if (targetId === session.user.id) {
          return withCors(
            new Response(JSON.stringify({ error: "cannot follow self" }), { status: 400, headers: { "Content-Type": "application/json" } }),
            req,
          );
        }
        await pool.query(
          "INSERT INTO public.user_follows (follower_id, followee_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
          [session.user.id, targetId],
        );
        return withCors(new Response(JSON.stringify({ ok: true, following: true }), { headers: { "Content-Type": "application/json" } }), req);
      } catch (e) {
        return withCors(
          new Response(JSON.stringify({ error: "failed to follow" }), { status: 500, headers: { "Content-Type": "application/json" } }),
          req,
        );
      }
    }

    // Follows: unfollow a user
    if (url.pathname === "/api/unfollow" && req.method === "POST") {
      try {
        const session = await auth.api.getSession({ headers: req.headers });
        if (!session) {
          return withCors(
            new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } }),
            req,
          );
        }
        const body = await req.json().catch(() => ({}));
        const targetId = body.targetId as string | undefined;
        if (!targetId) {
          return withCors(
            new Response(JSON.stringify({ error: "targetId required" }), { status: 400, headers: { "Content-Type": "application/json" } }),
            req,
          );
        }
        await pool.query(
          "DELETE FROM public.user_follows WHERE follower_id=$1 AND followee_id=$2",
          [session.user.id, targetId],
        );
        return withCors(new Response(JSON.stringify({ ok: true, following: false }), { headers: { "Content-Type": "application/json" } }), req);
      } catch (e) {
        return withCors(
          new Response(JSON.stringify({ error: "failed to unfollow" }), { status: 500, headers: { "Content-Type": "application/json" } }),
          req,
        );
      }
    }

    // Follows: relationship status
    // GET /api/follow/status?targetId=USER_ID[&followerId=USER_ID]
    if (url.pathname === "/api/follow/status" && req.method === "GET") {
      try {
        const targetId = url.searchParams.get("targetId");
        const followerIdParam = url.searchParams.get("followerId");
        let followerId = followerIdParam || undefined;
        if (!followerId) {
          const session = await auth.api.getSession({ headers: req.headers });
          followerId = session?.user.id;
        }
        if (!targetId || !followerId) {
          return withCors(
            new Response(JSON.stringify({ error: "targetId and followerId (or session) required" }), { status: 400, headers: { "Content-Type": "application/json" } }),
            req,
          );
        }
        const r = await pool.query(
          "SELECT 1 FROM public.user_follows WHERE follower_id=$1 AND followee_id=$2 LIMIT 1",
          [followerId, targetId],
        );
        const following = r.rowCount > 0;
        return withCors(
          new Response(JSON.stringify({ followerId, targetId, following }), { headers: { "Content-Type": "application/json" } }),
          req,
        );
      } catch (e) {
        return withCors(new Response(JSON.stringify({ error: "failed to query status" }), { status: 500, headers: { "Content-Type": "application/json" } }), req);
      }
    }

    // Followers list (public)
    // GET /api/followers?userId=USER_ID[&limit=50&offset=0]
    if (url.pathname === "/api/followers" && req.method === "GET") {
      try {
        const userId = url.searchParams.get("userId");
        if (!userId) {
          return withCors(new Response(JSON.stringify({ error: "userId required" }), { status: 400, headers: { "Content-Type": "application/json" } }), req);
        }
        const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") ?? 50)));
        const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
        const rs = await pool.query(
          "SELECT follower_id, created_at FROM public.user_follows WHERE followee_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
          [userId, limit, offset],
        );
        return withCors(
          new Response(
            JSON.stringify({ userId, followers: rs.rows.map((r) => ({ userId: r.follower_id, followedAt: r.created_at })) }),
            { headers: { "Content-Type": "application/json" } },
          ),
          req,
        );
      } catch (e) {
        return withCors(new Response(JSON.stringify({ error: "failed to list followers" }), { status: 500, headers: { "Content-Type": "application/json" } }), req);
      }
    }

    // Following list (public)
    // GET /api/following?userId=USER_ID[&limit=50&offset=0]
    if (url.pathname === "/api/following" && req.method === "GET") {
      try {
        const userId = url.searchParams.get("userId");
        if (!userId) {
          return withCors(new Response(JSON.stringify({ error: "userId required" }), { status: 400, headers: { "Content-Type": "application/json" } }), req);
        }
        const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") ?? 50)));
        const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
        const rs = await pool.query(
          "SELECT followee_id, created_at FROM public.user_follows WHERE follower_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
          [userId, limit, offset],
        );
        return withCors(
          new Response(
            JSON.stringify({ userId, following: rs.rows.map((r) => ({ userId: r.followee_id, followedAt: r.created_at })) }),
            { headers: { "Content-Type": "application/json" } },
          ),
          req,
        );
      } catch (e) {
        return withCors(new Response(JSON.stringify({ error: "failed to list following" }), { status: 500, headers: { "Content-Type": "application/json" } }), req);
      }
    }

    // Follow counts (public)
    // GET /api/follow/counts?userId=USER_ID
    if (url.pathname === "/api/follow/counts" && req.method === "GET") {
      try {
        const userId = url.searchParams.get("userId");
        if (!userId) {
          return withCors(new Response(JSON.stringify({ error: "userId required" }), { status: 400, headers: { "Content-Type": "application/json" } }), req);
        }
        const [followers, following] = await Promise.all([
          pool.query("SELECT COUNT(*)::int AS c FROM public.user_follows WHERE followee_id=$1", [userId]),
          pool.query("SELECT COUNT(*)::int AS c FROM public.user_follows WHERE follower_id=$1", [userId]),
        ]);
        return withCors(
          new Response(
            JSON.stringify({ userId, followers: followers.rows[0]?.c ?? 0, following: following.rows[0]?.c ?? 0 }),
            { headers: { "Content-Type": "application/json" } },
          ),
          req,
        );
      } catch (e) {
        return withCors(new Response(JSON.stringify({ error: "failed to get counts" }), { status: 500, headers: { "Content-Type": "application/json" } }), req);
      }
    }

    if (url.pathname === "/health") {
      return withCors(new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      }), req);
    }

    return withCors(new Response("CoreFans API Server", { status: 200 }), req);
  },
  websocket: {
    open(ws) {
      // auto-subscribe to global stream updates if client wants to listen
      ws.subscribe?.("global:streams");
    },
    message(ws, message) {
      try {
        const data = typeof message === "string" ? JSON.parse(message) : JSON.parse(new TextDecoder().decode(message as ArrayBuffer));
        if (!data || typeof data !== "object") return;

        const sendViewerCount = (streamId: string) => {
          const viewers = streamViewers.get(streamId);
          const count = viewers ? viewers.size : 0;
          if (viewers) {
            for (const client of viewers) {
              client.send(JSON.stringify({ type: "viewerCount", streamId, count }));
            }
          }
        };

        if (data.type === "joinStream" && typeof data.streamId === "string") {
          const streamId = data.streamId as string;
          const stream = liveStreams.get(streamId);
          if (!stream || !stream.isLive) {
            ws.send(JSON.stringify({ type: "error", message: "stream not live" }));
            return;
          }
          let set = streamViewers.get(streamId);
          if (!set) {
            set = new Set();
            streamViewers.set(streamId, set);
          }
          if (!set.has(ws)) {
            set.add(ws);
            (ws.data?.joined as Set<string> | undefined)?.add?.(streamId);
          }
          // update server-side count and notify
          stream.viewers = set.size;
          sendViewerCount(streamId);
          return;
        }

        if (data.type === "leaveStream" && typeof data.streamId === "string") {
          const streamId = data.streamId as string;
          const set = streamViewers.get(streamId);
          if (set && set.has(ws)) {
            set.delete(ws);
            (ws.data?.joined as Set<string> | undefined)?.delete?.(streamId);
            const s = liveStreams.get(streamId);
            if (s) s.viewers = set.size;
            sendViewerCount(streamId);
          }
          return;
        }

        if (data.type === "chatMessage" && typeof data.streamId === "string" && typeof data.message === "string") {
          const streamId = data.streamId as string;
          const set = streamViewers.get(streamId);
          if (!set) return;
          const payload = {
            type: "chatMessage",
            streamId,
            username: ws.data?.username ?? data.username ?? "anon",
            message: data.message,
            timestamp: new Date().toISOString(),
          };
          for (const client of set) client.send(JSON.stringify(payload));
          return;
        }
      } catch {
        // ignore malformed messages
      }
    },
    close(ws) {
      // clean up viewer membership
      const joined: Set<string> | undefined = ws.data?.joined;
      if (joined && joined.size > 0) {
        for (const streamId of joined) {
          const set = streamViewers.get(streamId);
          if (set) {
            set.delete(ws);
            const s = liveStreams.get(streamId);
            if (s) s.viewers = set.size;
            for (const client of set) client.send(JSON.stringify({ type: "viewerCount", streamId, count: set.size }));
          }
        }
      }
    },
  },
});

console.log(`[API] server running on http://localhost:${PORT}`);
