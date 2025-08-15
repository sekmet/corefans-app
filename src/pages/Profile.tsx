import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import RightRail from "@/components/core/RightRail";
import FeedItem, { FeedItemData } from "@/components/core/FeedItem";

function useUserDisplay() {
  const { data: session } = authClient.useSession();
  const user = session?.user ?? ({} as any);
  return useMemo(() => {
    const name: string | undefined = user.name ?? user.email?.split("@")[0];
    const username: string | undefined =
      user.username ||
      (name ? name.toString().trim().toLowerCase().replace(/\s+/g, "") : undefined) ||
      user.id;
    const handle = username ? `@${username}` : "@user";
    const avatarUrl: string | undefined = user.image || user.avatarUrl;
    return { name: name || "User", handle, avatarUrl };
  }, [user]);
}

export default function Profile() {
  const { data: session, isPending } = authClient.useSession();
  const navigate = useNavigate();
  const { name, handle, avatarUrl } = useUserDisplay();

  if (isPending) {
    return <div className="p-4 md:p-6">Loading…</div>;
  }
  if (!session) {
    return <div className="p-4 md:p-6">No session</div>;
  }

  const user = session.user;

  const onSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => navigate("/login"),
      },
    });
  };

  // Mock profile data (replace with API integration later)
  const POSTS: FeedItemData[] = [
    {
      id: "p1",
      user: { name, handle, avatarUrl },
      timestamp: "2h",
      content: "Excited to join CoreFans! Rolling out some BTS soon.",
      stats: { likes: 12, comments: 3, tips: 0 },
    },
    {
      id: "p2",
      user: { name, handle, avatarUrl },
      timestamp: "1d",
      imageUrl:
        "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1600&auto=format&fit=crop",
      content: "Testing a new lighting setup. Thoughts?",
      stats: { likes: 67, comments: 9, tips: 2 },
    },
  ];

  const REPLIES: FeedItemData[] = [
    {
      id: "r1",
      user: { name, handle, avatarUrl },
      timestamp: "5h",
      content: "@ava Love this set — the tones are perfect!",
      stats: { likes: 4, comments: 1, tips: 0 },
    },
    {
      id: "r2",
      user: { name, handle, avatarUrl },
      timestamp: "2d",
      content: "@noah_vt I'd go with the cooler grade 🌊",
      stats: { likes: 7, comments: 0, tips: 0 },
    },
  ];

  const MEDIA: FeedItemData[] = [
    {
      id: "m1",
      user: { name, handle, avatarUrl },
      timestamp: "3d",
      imageUrl:
        "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=1600&auto=format&fit=crop",
      content: "Color test from the latest shoot.",
      stats: { likes: 88, comments: 6, tips: 3 },
    },
    {
      id: "m2",
      user: { name, handle, avatarUrl },
      timestamp: "1w",
      imageUrl:
        "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1600&auto=format&fit=crop",
      content: "Studio mood board ✨",
      stats: { likes: 132, comments: 14, tips: 5 },
    },
  ];

  const LIKES: FeedItemData[] = [
    {
      id: "l1",
      user: {
        name: "Ava Streams",
        handle: "@ava",
        avatarUrl: "https://i.pravatar.cc/100?img=1",
      },
      timestamp: "4h",
      imageUrl:
        "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=1600&auto=format&fit=crop",
      content: "New set going live tonight — BTS & presets!",
      stats: { likes: 1243, comments: 189, tips: 37 },
    },
    {
      id: "l2",
      user: {
        name: "Noah VT",
        handle: "@noah_vt",
        avatarUrl: "https://i.pravatar.cc/100?img=13",
      },
      timestamp: "1d",
      content: "Sunset render drop — which color grade do you prefer?",
      stats: { likes: 842, comments: 102, tips: 12 },
    },
  ];

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
              {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
              <AvatarFallback className="bg-gradient-to-br from-pink-500 to-orange-400" />
            </Avatar>
          </div>
        </div>
      </div>

      {/* Header: name + actions */}
      <div className="px-4 sm:px-6 mt-3 sm:mt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold leading-tight lowercase truncate">{name}</h1>
            <div className="text-sm text-muted-foreground truncate">{handle}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline">Edit profile</Button>
            <Button size="sm" variant="destructive" onClick={onSignOut}>Sign out</Button>
          </div>
        </div>

        {/* Details */}
        <div className="mt-3 grid gap-1 text-sm">
          <div className="text-muted-foreground">Email: <span className="text-foreground">{user.email ?? "(none)"}</span></div>
          <div className="text-muted-foreground">Wallet: <span className="text-foreground">{user.walletAddress ?? "(none)"}</span></div>
          <div className="text-muted-foreground">ID: <span className="text-foreground">{user.id}</span></div>
        </div>

        <Separator className="my-4" />

        {/* Tabs like Twitter: Tweets, Replies, Media, Likes */}
        <Tabs defaultValue="tweets" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="tweets">Posts</TabsTrigger>
            <TabsTrigger value="replies">Replies</TabsTrigger>
            <TabsTrigger value="media">Media</TabsTrigger>
            <TabsTrigger value="likes">Likes</TabsTrigger>
          </TabsList>
          <TabsContent value="tweets">
            <div className="space-y-4 sm:space-y-6 py-4">
              {POSTS.map((it) => (
                <FeedItem key={it.id} item={it} />
              ))}
            </div>
          </TabsContent>
          <TabsContent value="replies">
            <div className="space-y-4 sm:space-y-6 py-4">
              {REPLIES.map((it) => (
                <FeedItem key={it.id} item={it} />
              ))}
            </div>
          </TabsContent>
          <TabsContent value="media">
            <div className="space-y-4 sm:space-y-6 py-4">
              {MEDIA.map((it) => (
                <FeedItem key={it.id} item={it} />
              ))}
            </div>
          </TabsContent>
          <TabsContent value="likes">
            <div className="space-y-4 sm:space-y-6 py-4">
              {LIKES.map((it) => (
                <FeedItem key={it.id} item={it} />
              ))}
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
