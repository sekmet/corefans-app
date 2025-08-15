import { Pool } from "pg";

// Singleton Pool for the server
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Ensures the follow schema exists (idempotent)
export async function ensureFollowSchema() {
  const client = await pool.connect();
  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS public.user_follows (
        follower_id text NOT NULL,
        followee_id text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT user_follows_pk PRIMARY KEY (follower_id, followee_id),
        CONSTRAINT user_follows_self CHECK (follower_id <> followee_id)
      );`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_user_follows_followee ON public.user_follows (followee_id);`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON public.user_follows (follower_id);`
    );
  } finally {
    client.release();
  }
}

// Ensures the feed schema exists (idempotent)
export async function ensureFeedSchema() {
  const client = await pool.connect();
  try {
    // Posts
    await client.query(
      `CREATE TABLE IF NOT EXISTS public.posts (
        id text PRIMARY KEY,
        author_id text NOT NULL,
        author_name text NOT NULL,
        author_handle text NOT NULL,
        author_avatar_url text,
        content text,
        image_url text,
        is_ppv boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );`
    );
    await client.query(`CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts (created_at DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_posts_author ON public.posts (author_id);`);

    // Likes
    await client.query(
      `CREATE TABLE IF NOT EXISTS public.post_likes (
        post_id text NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
        user_id text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT post_likes_pk PRIMARY KEY (post_id, user_id)
      );`
    );
    await client.query(`CREATE INDEX IF NOT EXISTS idx_post_likes_user ON public.post_likes (user_id);`);

    // Comments
    await client.query(
      `CREATE TABLE IF NOT EXISTS public.post_comments (
        id bigserial PRIMARY KEY,
        post_id text NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
        user_id text NOT NULL,
        user_name text NOT NULL,
        user_handle text NOT NULL,
        user_avatar_url text,
        content text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );`
    );
    await client.query(`CREATE INDEX IF NOT EXISTS idx_post_comments_post ON public.post_comments (post_id);`);
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_post_comments_post_created ON public.post_comments (post_id, created_at DESC);`
    );

    // Tips (optional aggregation for UI)
    await client.query(
      `CREATE TABLE IF NOT EXISTS public.post_tips (
        id bigserial PRIMARY KEY,
        post_id text NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
        from_user_id text NOT NULL,
        amount_usd numeric(20,2) NOT NULL,
        currency text DEFAULT 'USD',
        created_at timestamptz NOT NULL DEFAULT now()
      );`
    );
    await client.query(`CREATE INDEX IF NOT EXISTS idx_post_tips_post ON public.post_tips (post_id);`);

    // --- Enhancements for Composer: visibility, scheduling, media, drafts, polls ---
    // Extend posts with visibility, price and scheduling fields
    await client.query(
      `ALTER TABLE public.posts
        ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public',
        ADD COLUMN IF NOT EXISTS price_usd_cents integer,
        ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published',
        ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;`
    );
    await client.query(`CREATE INDEX IF NOT EXISTS idx_posts_status ON public.posts (status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_posts_scheduled ON public.posts (scheduled_at);`);

    // Media attachments per post (supports up to 4, arbitrary types)
    await client.query(
      `CREATE TABLE IF NOT EXISTS public.post_media (
        id bigserial PRIMARY KEY,
        post_id text NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
        position smallint NOT NULL DEFAULT 0,
        bucket text NOT NULL,
        key text NOT NULL,
        content_type text,
        size_bytes bigint,
        width int,
        height int,
        duration_sec int,
        created_at timestamptz NOT NULL DEFAULT now()
      );`
    );
    await client.query(`CREATE INDEX IF NOT EXISTS idx_post_media_post ON public.post_media (post_id, position);`);

    // Server-side user drafts (latest draft per user)
    await client.query(
      `CREATE TABLE IF NOT EXISTS public.user_post_drafts (
        user_id text PRIMARY KEY,
        content text,
        attachments jsonb,
        updated_at timestamptz NOT NULL DEFAULT now()
      );`
    );

    // Polls
    await client.query(
      `CREATE TABLE IF NOT EXISTS public.post_polls (
        post_id text PRIMARY KEY REFERENCES public.posts(id) ON DELETE CASCADE,
        question text NOT NULL,
        multiple_choice boolean NOT NULL DEFAULT false,
        expires_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );`
    );
    await client.query(
      `CREATE TABLE IF NOT EXISTS public.post_poll_options (
        id bigserial PRIMARY KEY,
        post_id text NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
        position smallint NOT NULL DEFAULT 0,
        text text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );`
    );
    await client.query(`CREATE INDEX IF NOT EXISTS idx_poll_options_post ON public.post_poll_options (post_id, position);`);
    await client.query(
      `CREATE TABLE IF NOT EXISTS public.post_poll_votes (
        post_id text NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
        option_id bigint NOT NULL REFERENCES public.post_poll_options(id) ON DELETE CASCADE,
        user_id text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT post_poll_votes_pk PRIMARY KEY (post_id, user_id)
      );`
    );
    await client.query(`CREATE INDEX IF NOT EXISTS idx_poll_votes_option ON public.post_poll_votes (option_id);`);
  } finally {
    client.release();
  }
}

// Ensures the user profiles schema exists (idempotent)
export async function ensureProfileSchema() {
  const client = await pool.connect();
  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS public.user_profiles (
        user_id text PRIMARY KEY,
        display_name text,
        username text UNIQUE,
        website text,
        country text,
        location text,
        birthday date,
        avatar_bucket text,
        avatar_key text,
        cover_bucket text,
        cover_key text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );`
    );
    // Case-insensitive uniqueness for username
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_username_ci ON public.user_profiles (lower(username));`
    );
  } finally {
    client.release();
  }
}
