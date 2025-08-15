import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import RightRail from "@/components/core/RightRail";
import FeedItem, { FeedItemData } from "@/components/core/FeedItem";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { getPublicProfileByUsername } from "@/lib/profile";
import { followUser, unfollowUser, getFollowStatus } from "@/lib/follows";

function usePublicUserDisplay(usernameParam?: string) {
  return useMemo(() => {
    const username = (usernameParam || "user").trim();
    const clean = username.replace(/^@+/, "");
    const handle = `@${clean}`;
    const name = clean
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()) || "User";
    const avatarUrl = undefined as string | undefined;
    return { name, handle, avatarUrl, username: clean };
  }, [usernameParam]);
}

export default function PublicProfile() {
  const { username } = useParams<{ username: string }>();
  const { name, handle, avatarUrl, username: cleanUsername } = usePublicUserDisplay(username);
  const { data: session } = authClient.useSession();
  const me = (session?.user as any) || undefined;

  // Resolved profile for display and follow target
  const [displayName, setDisplayName] = useState(name);
  const [displayHandle, setDisplayHandle] = useState(handle);
  const [displayAvatarUrl, setDisplayAvatarUrl] = useState<string | undefined>(avatarUrl);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [following, setFollowing] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);

  // Load public profile by username
  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!cleanUsername) return;
      try {
        const p = await getPublicProfileByUsername(cleanUsername);
        if (!mounted) return;
        setTargetId(p.userId);
        setDisplayName(p.displayName || name);
        setDisplayHandle(p.username ? `@${p.username}` : handle);
        setDisplayAvatarUrl(p.avatarUrl || avatarUrl);
      } catch (e) {
        // keep defaults; show a subtle message only if not found
        // @ts-ignore
        if (e && typeof e === "object" && (e as any).message?.includes("404")) {
          toast.error("Profile not found");
        }
      }
    }
    load();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanUsername]);

  // Load follow status when targetId and session available
  useEffect(() => {
    let mounted = true;
    async function loadStatus() {
      if (!targetId || !me?.id) return;
      try {
        const s = await getFollowStatus(targetId, me.id);
        if (mounted) setFollowing(Boolean(s.following));
      } catch {
        // ignore
      }
    }
    loadStatus();
    return () => {
      mounted = false;
    };
  }, [targetId, me?.id]);

  const onToggleFollow = useCallback(async () => {
    if (!targetId) return;
    if (!me?.id) {
      toast.message("Please sign in to follow creators.");
      return;
    }
    if (me.id === targetId) {
      toast.error("You cannot follow yourself");
      return;
    }
    setPending(true);
    try {
      if (following) {
        await unfollowUser(targetId);
        setFollowing(false);
        toast.success(`Unfollowed ${displayHandle}`);
      } else {
        await followUser(targetId);
        setFollowing(true);
        toast.success(`Following ${displayHandle}`);
      }
    } catch {
      toast.error("Action failed");
    } finally {
      setPending(false);
    }
  }, [displayHandle, following, me?.id, targetId]);

  // Mock public data for now. Replace with real API integration when available.
  const POSTS: FeedItemData[] = [
    {
      id: "pub-p1",
      user: { name, handle, avatarUrl },
      timestamp: "2h",
      content: "Welcome to my page on CoreFans!",
      stats: { likes: 10, comments: 1, tips: 0 },
    },
  ];
  const MEDIA: FeedItemData[] = [
    {
      id: "pub-m1",
      user: { name, handle, avatarUrl },
      timestamp: "1d",
      imageUrl:
        "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1600&auto=format&fit=crop",
      content: "Recent shoot — more dropping soon.",
      stats: { likes: 54, comments: 7, tips: 2 },
    },
  ];
  const LIKES: FeedItemData[] = [];

  return (
    <div className="mx-auto max-w-6xl h-full min-h-0 grid grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[minmax(0,800px)_320px] lg:items-start">
      <div className="mx-auto w-full max-w-4xl h-full min-h-0 overflow-y-auto pr-1">
        {/* Cover */}
        <div className="relative w-full">
          <div className="h-32 sm:h-40 w-full rounded-md bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-700" />
          {/* Avatar overlaps cover */}
          <div className="px-4 sm:px-6">
            <div className="-mt-12 sm:-mt-14 inline-block rounded-full border-4 border-background">
              <Avatar className="size-24 sm:size-28">
                {displayAvatarUrl ? <AvatarImage src={displayAvatarUrl} alt={displayName} /> : null}
                <AvatarFallback className="bg-gradient-to-br from-pink-500 to-orange-400" />
              </Avatar>
            </div>
          </div>
        </div>

        {/* Header: name + actions */}
        <div className="px-4 sm:px-6 mt-3 sm:mt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold leading-tight lowercase truncate">{displayName}</h1>
              <div className="text-sm text-muted-foreground truncate">{displayHandle}</div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className={`min-h-[44px] min-w-[44px] ${following ? "bg-muted text-foreground" : ""}`}
                variant={following ? "secondary" : "default"}
                aria-label={following ? `Unfollow ${displayHandle}` : `Follow ${displayHandle}`}
                disabled={pending || !targetId}
                onClick={onToggleFollow}
              >
                {pending ? "..." : following ? "Following" : "Follow"}
              </Button>
            </div>
          </div>

          {/* Details */}
          <div className="mt-3 grid gap-1 text-sm">
            <div className="text-muted-foreground">
              Bio: <span className="text-foreground">This creator hasn't added a bio yet.</span>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Tabs: Posts, Media, Likes */}
          <Tabs defaultValue="posts" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="posts">Posts</TabsTrigger>
              <TabsTrigger value="media">Media</TabsTrigger>
              <TabsTrigger value="likes">Likes</TabsTrigger>
            </TabsList>
            <TabsContent value="posts">
              <div className="space-y-4 sm:space-y-6 py-4">
                {POSTS.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No posts yet.</div>
                ) : (
                  POSTS.map((it) => <FeedItem key={it.id} item={it} />)
                )}
              </div>
            </TabsContent>
            <TabsContent value="media">
              <div className="space-y-4 sm:space-y-6 py-4">
                {MEDIA.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No media yet.</div>
                ) : (
                  MEDIA.map((it) => <FeedItem key={it.id} item={it} />)
                )}
              </div>
            </TabsContent>
            <TabsContent value="likes">
              <div className="space-y-4 sm:space-y-6 py-4">
                {LIKES.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No likes to show.</div>
                ) : (
                  LIKES.map((it) => <FeedItem key={it.id} item={it} />)
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <aside className="hidden lg:block lg:fixed lg:top-6 lg:right-6 lg:w-[320px]">
        <RightRail />
      </aside>
    </div>
  );
}
