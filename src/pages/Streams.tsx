import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Seo from "@/components/Seo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import FeedItem, { FeedItemData } from "@/components/core/FeedItem";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { followUser, unfollowUser, getFollowStatus } from "@/lib/follows";
import {
  ArrowLeft,
  Search,
  SlidersHorizontal,
  Eye,
  Clock,
  CheckCircle2,
} from "lucide-react";

// Demo data
const LIVE_STREAMS = Array.from({ length: 8 }).map((_, i) => ({
  id: `live-${i + 1}`,
  title: i % 2 === 0 ? "Daily Sketch Session" : "Music Production Live",
  creator: i % 2 === 0 ? "Ava Streams" : "Noah VT",
  handle: i % 2 === 0 ? "@ava" : "@noah_vt",
  viewers: 1200 + i * 17,
  free: i % 3 !== 0,
  thumb: `https://images.unsplash.com/photo-${
    i % 2 === 0 ? "1517245386807-bb43f82c33c4" : "1500530855697-b586d89ba3ee"
  }?q=80&w=1200&auto=format&fit=crop`,
  startedAt: Date.now() - (i + 1) * 1000 * 60 * 23,
}));

const PEOPLE = Array.from({ length: 10 }).map((_, i) => ({
  id: `user-${i + 1}`,
  name: ["Ava Streams", "Noah VT", "Mia", "Liam", "Zoe"][i % 5],
  handle: ["@ava", "@noah_vt", "@miacreates", "@liam", "@zoe"][i % 5],
  avatar: `https://i.pravatar.cc/100?img=${(i % 70) + 1}`,
  verified: i % 4 === 0,
  description: i % 3 === 0 ? "" : "Creator · Designer · Streamer",
}));

const PHOTOS = Array.from({ length: 6 }).map((_, i) => ({
  id: `photo-${i + 1}`,
  user: PEOPLE[i % PEOPLE.length],
  timestamp: ["2h", "4h", "1d", "3d"][i % 4],
  content:
    i % 2 === 0
      ? "New set going live tonight. PPV for supporters — behind-the-scenes and presets!"
      : "Sunset render drop — which color grade do you prefer?",
  image:
    i % 2 === 0
      ? "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=1600&auto=format&fit=crop"
      : "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1600&auto=format&fit=crop",
  stats: { likes: 1243 + i * 3, comments: 189 + i, tips: 37 + (i % 5) },
  ppv: i % 3 === 0,
}));

const VIDEOS = Array.from({ length: 4 }).map((_, i) => ({
  id: `video-${i + 1}`,
  user: PEOPLE[(i + 2) % PEOPLE.length],
  title: i % 2 === 0 ? "Behind the scenes" : "Making of — short",
  description: "Short clip from today's session.",
  duration: 45 + i * 30, // seconds
  thumb:
    i % 2 === 0
      ? "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1600&auto=format&fit=crop"
      : "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=1600&auto=format&fit=crop",
  src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
}));

// Hooks
function useDebounced<T>(value: T, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function useInfiniteList<T>(items: T[], pageSize = 6) {
  const [page, setPage] = useState(1);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const visible = items.slice(0, page * pageSize);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      const [e] = entries;
      if (e.isIntersecting) {
        setPage((p) => p + 1);
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [items.length]);

  const reset = useCallback(() => setPage(1), []);

  return { visible, sentinelRef, reset } as const;
}

// Components
function SearchHeader({ value, onChange, onFilter }: { value: string; onChange: (v: string) => void; onFilter: () => void }) {
  return (
    <div className="sticky top-0 z-10 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-2 py-2">
        <Button asChild variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]">
          <Link to="/feed" aria-label="Back to feed">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Search streams, people, posts"
            className="h-11 pl-9"
            aria-label="Search"
          />
        </div>
        <Button variant="outline" size="icon" onClick={onFilter} aria-label="Filters" className="min-h-[44px] min-w-[44px]">
          <SlidersHorizontal className="size-5" />
        </Button>
      </div>
    </div>
  );
}


function StreamCard({ item }: { item: (typeof LIVE_STREAMS)[number] }) {
  const [viewers, setViewers] = useState(item.viewers);
  useEffect(() => {
    const id = setInterval(() => setViewers((v) => v + Math.floor(Math.random() * 5)), 3000);
    return () => clearInterval(id);
  }, []);

  const elapsed = useMemo(() => {
    const secs = Math.floor((Date.now() - item.startedAt) / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }, [item.startedAt]);

  return (
    <Link to={`/streams/live/${item.id}`} className="block" aria-label={`Open stream ${item.title}`}>
      <article className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
      <div className="relative aspect-video w-full bg-muted">
        {/* thumbnail */}
        <img src={item.thumb} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
        <div className="absolute left-2 top-2 flex items-center gap-2">
          <Badge className="bg-red-600">LIVE</Badge>
          {item.free ? <Badge className="bg-green-500">Free</Badge> : null}
        </div>
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-white text-xs">
          <Eye className="size-3" /> <span>{Intl.NumberFormat().format(viewers)}</span>
        </div>
        <div className="absolute right-2 bottom-2 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-white text-xs">
          <Clock className="size-3" /> <span>{elapsed}</span>
        </div>
      </div>
      <div className="p-3">
        <h3 className="text-sm font-medium line-clamp-1">{item.title}</h3>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{item.creator}</span>
          <span className="text-muted-foreground/60">{item.handle}</span>
          <CheckCircle2 className="size-3 text-indigo-500" aria-label="Verified" />
        </div>
      </div>
      </article>
    </Link>
  );
}

function UserCard({ user }: { user: (typeof PEOPLE)[number] }) {
  const { data: session } = authClient.useSession();
  const me = (session?.user as any) || undefined;
  const [following, setFollowing] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        if (!me?.id) return;
        const res = await getFollowStatus(user.id, me.id);
        if (mounted) setFollowing(Boolean(res.following));
      } catch {
        // ignore; likely demo IDs or unauthenticated
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [me?.id, user.id]);

  const onToggleFollow = useCallback(async () => {
    if (!me?.id) {
      toast.message("Please sign in to follow creators.");
      return;
    }
    if (me.id === user.id) {
      toast.error("You cannot follow yourself");
      return;
    }
    setPending(true);
    try {
      if (following) {
        await unfollowUser(user.id);
        setFollowing(false);
        toast.success(`Unfollowed ${user.handle}`);
      } else {
        await followUser(user.id);
        setFollowing(true);
        toast.success(`Following ${user.handle}`);
      }
    } catch (e) {
      toast.error("Action failed");
    } finally {
      setPending(false);
    }
  }, [following, me?.id, user.handle, user.id]);

  return (
    <article className="rounded-lg border bg-card p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12">
          <AvatarImage src={user.avatar} alt={user.name} />
          <AvatarFallback>{user.name[0]}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-sm font-medium">
            <span className="truncate">{user.name}</span>
            {user.verified ? (
              <CheckCircle2 className="size-4 shrink-0 text-indigo-500" aria-label="Verified" />
            ) : null}
          </div>
          <div className="truncate text-xs text-muted-foreground">{user.handle}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant={following ? "secondary" : "default"}
            size="sm"
            className={`${following ? "bg-muted text-foreground" : "bg-indigo-600"} min-h-[44px] min-w-[44px]`}
            aria-label={following ? `Unfollow ${user.name}` : `Follow ${user.name}`}
            disabled={pending}
            onClick={onToggleFollow}
          >
            {pending ? "..." : following ? "Following" : "Follow"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-indigo-500 text-indigo-600 min-h-[44px] min-w-[44px]"
            aria-label={`View ${user.name}`}
            onClick={() => toast.success(`Viewing ${user.handle}`)}
          >
            VIEW
          </Button>
        </div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {user.description || <span className="italic">No description available</span>}
      </p>
    </article>
  );
}






export default function Streams() {
  // Search
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 350);

  // Filters demo sheet trigger
  const onFilter = () => toast.message("Open filters (coming soon)");

  // Filtering
  const live = useMemo(
    () => LIVE_STREAMS.filter((s) => s.title.toLowerCase().includes(debounced.toLowerCase()) || s.creator.toLowerCase().includes(debounced.toLowerCase())),
    [debounced]
  );
  const people = useMemo(
    () => PEOPLE.filter((p) => p.name.toLowerCase().includes(debounced.toLowerCase()) || p.handle.toLowerCase().includes(debounced.toLowerCase())),
    [debounced]
  );
  const photos = useMemo(
    () => PHOTOS.filter((p) => p.content.toLowerCase().includes(debounced.toLowerCase())),
    [debounced]
  );

  // Infinite lists
  const liveList = useInfiniteList(live, 6);
  const peopleList = useInfiniteList(people, 8);
  const photoList = useInfiniteList(photos, 4);

  // Pull-to-refresh (simple)
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let startY = 0;
    let pulling = false;
    const onStart = (e: TouchEvent) => {
      if (el.scrollTop <= 0) {
        startY = e.touches[0].clientY;
        pulling = true;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 70) {
        pulling = false;
        toast.message("Refreshing…");
        liveList.reset();
        peopleList.reset();
        photoList.reset();
      }
    };
    const onEnd = () => {
      pulling = false;
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, [liveList, peopleList, photoList]);

  return (
    <div className="mx-auto max-w-6xl h-full min-h-0 grid grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[minmax(0,800px)_320px] lg:items-start">
      <Seo title="Streams" description="Discover live streams, people, photos, and videos" />
      <div ref={scrollRef} className="mx-auto w-full max-w-4xl h-full min-h-0 overflow-y-auto overscroll-contain pr-1">
        <SearchHeader value={query} onChange={setQuery} onFilter={onFilter} />
        <Tabs defaultValue="live" className="mt-2">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="live" className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-500">Live</TabsTrigger>
            <TabsTrigger value="people" className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-500">People</TabsTrigger>
            <TabsTrigger value="photos" className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-500">Photos</TabsTrigger>
            <TabsTrigger value="videos" className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-500">Videos</TabsTrigger>
          </TabsList>

          {/* Live */}
          <TabsContent value="live" className="mt-3">
            {liveList.visible.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">No live streams found</div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {liveList.visible.map((s) => (
                  <StreamCard key={s.id} item={s} />
                ))}
              </div>
            )}
            <div ref={liveList.sentinelRef} className="py-3">
              <Skeleton className="h-20 w-full" />
            </div>
          </TabsContent>

          {/* People */}
          <TabsContent value="people" className="mt-3">
            {peopleList.visible.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">No people found</div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {peopleList.visible.map((p) => (
                  <UserCard key={p.id} user={p} />
                ))}
              </div>
            )}
            <div ref={peopleList.sentinelRef} className="py-3">
              <Skeleton className="h-16 w-full" />
            </div>
          </TabsContent>

          {/* Photos */}
          <TabsContent value="photos" className="mt-3 space-y-3">
            {photoList.visible.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">No photos found</div>
            ) : (
              photoList.visible.map((p) => {
                const item: FeedItemData = {
                  id: p.id,
                  user: { name: p.user.name, handle: p.user.handle, avatarUrl: p.user.avatar },
                  timestamp: p.timestamp,
                  ppv: p.ppv,
                  imageUrl: p.image,
                  content: p.content,
                  stats: p.stats,
                };
                return <FeedItem key={p.id} item={item} />;
              })
            )}
            <div ref={photoList.sentinelRef} className="py-3">
              <Skeleton className="h-24 w-full" />
            </div>
          </TabsContent>

          {/* Videos */}
          <TabsContent value="videos" className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2">
            {VIDEOS.map((v) => {
              const item: FeedItemData = {
                id: v.id,
                user: { name: v.user.name, handle: v.user.handle, avatarUrl: v.user.avatar },
                timestamp: "today",
                content: v.description,
                stats: { likes: 0, comments: 0, tips: 0 },
              };
              return (
                <FeedItem
                  key={v.id}
                  item={item}
                  video={{ src: v.src, poster: v.thumb, duration: v.duration }}
                />
              );
            })}
          </TabsContent>
        </Tabs>
      </div>

      {/* Right rail placeholder to mirror feed layout (hidden on mobile) */}
      <aside className="hidden lg:block lg:fixed lg:top-4 lg:right-6 lg:w-[320px]">
        <div className="rounded-lg border bg-card p-3 text-sm text-muted-foreground">
          Tips: Use the search and filters to discover new live creators.
        </div>
      </aside>
    </div>
  );
}
