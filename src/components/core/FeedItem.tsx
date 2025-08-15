import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listComments } from "@/lib/feed";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Heart,
  MessageCircle,
  Send,
  MoreHorizontal,
  Bookmark,
  Flag,
  Link as LinkIcon,
  ShieldX,
} from "lucide-react";
import { PlayCircle, Volume2, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import Poll from "@/components/core/Poll";

export type FeedItemData = {
  id: string;
  user: {
    name: string;
    handle: string; // with leading @
    avatarUrl?: string;
  };
  timestamp: string; // e.g., "2h"
  ppv?: boolean;
  imageUrl?: string;
  content?: string;
  hasPoll?: boolean;
  stats: {
    likes: number;
    comments: number;
    tips: number;
  };
};

export type FeedItemProps = {
  item: FeedItemData;
  className?: string;
  video?: {
    src: string;
    poster?: string;
    duration?: number; // seconds
  };
  liked?: boolean;
  onLike?: () => void;
  onAddComment?: (text: string) => void;
};

export default function FeedItem({ item, className, video, liked: likedProp, onLike, onAddComment }: FeedItemProps) {
  const [liked, setLiked] = useState(!!likedProp);
  const [likes, setLikes] = useState(item.stats.likes);
  const [openComments, setOpenComments] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);
  const [likeBurst, setLikeBurst] = useState(false);
  const initials = useMemo(() => item.user.name.slice(0, 1).toUpperCase(), [item.user.name]);
  const [commentText, setCommentText] = useState("");

  // Load comments when comments are opened
  const { data: comments, isLoading: commentsLoading, error: commentsError } = useQuery({
    queryKey: ["postComments", item.id],
    queryFn: () => listComments(item.id).then((r) => r.items),
    enabled: openComments,
  });

  useEffect(() => {
    setLiked(!!likedProp);
  }, [likedProp]);

  useEffect(() => {
    setLikes(item.stats.likes);
  }, [item.stats.likes]);

  const onToggleLike = () => {
    setLiked((prev) => !prev);
    setLikes((prev) => (liked ? Math.max(0, prev - 1) : prev + 1));
    setLikeBurst(true);
    setTimeout(() => setLikeBurst(false), 180);
    try {
      onLike?.();
    } catch {}
  };

  // Video controls (optional)
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);

  const togglePlay = () => {
    if (!video) return;
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play();
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
    }
  };
  const toggleMute = () => {
    if (!video) return;
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  };
  const onTime = () => {
    if (!video) return;
    const el = videoRef.current;
    if (!el) return;
    setProgress((el.currentTime / el.duration) * 100 || 0);
  };
  const enterFs = () => {
    if (!video) return;
    const el = videoRef.current;
    if (!el) return;
    if (el.requestFullscreen) el.requestFullscreen();
  };
  const fmt = (s?: number) =>
    typeof s === "number" ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "";

  return (
    <Card className={cn("border border-gray-200 shadow-sm", className)}>
      {/* Header */}
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <Avatar className="h-10 w-10 rounded-full">
          {item.user.avatarUrl ? (
            <AvatarImage src={item.user.avatarUrl} alt={item.user.name} />
          ) : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-semibold">{item.user.name}</div>
            <div className="truncate text-sm text-gray-500">{item.user.handle}</div>
            <div className="ml-auto flex items-center gap-2">
              {item.ppv ? (
                <Badge className="bg-pink-500 text-white">PPV</Badge>
              ) : null}
              <span className="text-xs text-gray-500" aria-label="post time">
                {item.timestamp}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger className="rounded p-1 hover:bg-gray-100" aria-label="More">
                  <MoreHorizontal className="h-5 w-5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem>
                    <LinkIcon className="mr-2 h-4 w-4" /> Copy link
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Bookmark className="mr-2 h-4 w-4" /> Remove bookmark
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <ShieldX className="mr-2 h-4 w-4" /> Block
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Flag className="mr-2 h-4 w-4" /> Report
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Unfollow</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {item.content ? (
            <p className="mt-1 text-sm leading-relaxed text-foreground/90">{item.content}</p>
          ) : null}
        </div>
      </div>

      {/* Image */}
      {/* Video (optional) */}
      {video ? (
        <div className="relative">
          <video
            ref={videoRef}
            src={video.src}
            poster={video.poster}
            className="h-auto w-full"
            muted={muted}
            onTimeUpdate={onTime}
            playsInline
          />
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/60 via-black/20 to-transparent p-3">
            <div className="mb-2 flex items-center gap-2 text-white">
              <button
                className="rounded-full bg-white/20 p-2 backdrop-blur hover:bg-white/30"
                onClick={togglePlay}
                aria-label={playing ? "Pause" : "Play"}
              >
                <PlayCircle className={cn("h-6 w-6", playing && "opacity-70")} />
              </button>
              <button
                className="rounded-full bg-white/20 p-2 backdrop-blur hover:bg-white/30"
                onClick={toggleMute}
                aria-label={muted ? "Unmute" : "Mute"}
              >
                <Volume2 className="h-6 w-6" />
              </button>
              <div className="ml-auto flex items-center gap-2 text-xs">
                <span>{fmt(video.duration)}</span>
                <button
                  className="rounded-full bg-white/20 p-2 backdrop-blur hover:bg-white/30"
                  onClick={enterFs}
                  aria-label="Fullscreen"
                >
                  <Maximize2 className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="h-1 w-full overflow-hidden rounded bg-white/30">
              <div className="h-full bg-indigo-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      ) : null}

      {/* Image (if no video) */}
      {!video && item.imageUrl ? (
        <div className="group relative">
          <img
            src={item.imageUrl}
            alt={`${item.user.name}'s post image`}
            loading="lazy"
            className="h-auto w-full select-none object-cover transition-opacity hover:opacity-95 sm:aspect-video"
          />
        </div>
      ) : null}

      {/* Poll (renders only if post has a poll) */}
      {item.hasPoll ? <Poll postId={item.id} /> : null}

      {/* Interaction bar */}
      <div className="flex items-center justify-between p-3 sm:p-4">
        <div className="flex items-center gap-5">
          <button
            className={cn(
              "flex min-h-[44px] items-center gap-1 text-gray-600 transition-colors hover:text-red-500",
              liked && "text-red-500"
            )}
            onClick={onToggleLike}
            aria-pressed={liked}
            aria-label="Like"
          >
            <Heart className={cn("h-6 w-6 transition-transform duration-150", liked ? "fill-red-500" : undefined, likeBurst && "scale-110")} />
          </button>

          <button
            className="flex min-h-[44px] items-center gap-1 text-gray-600 transition-colors hover:text-blue-500"
            onClick={() => setOpenComments((v) => !v)}
            aria-expanded={openComments}
            aria-controls={`comments-${item.id}`}
            aria-label="Comments"
          >
            <MessageCircle className="h-6 w-6" />
          </button>

          <Dialog open={tipOpen} onOpenChange={setTipOpen}>
            <DialogTrigger asChild>
              <button className="flex min-h-[44px] items-center gap-2 text-gray-600 transition-colors hover:text-green-600" aria-label="Send tip">
                <Send className="h-6 w-6" />
                <span className="hidden text-sm sm:inline">Tip</span>
              </button>
            </DialogTrigger>
            <TipDialog item={item} onClose={() => setTipOpen(false)} />
          </Dialog>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>{likes.toLocaleString()} likes</span>
          <span>{item.stats.comments.toLocaleString()} comments</span>
          <span>{item.stats.tips.toLocaleString()} tips</span>
        </div>
      </div>

      {/* Comments */}
      <Collapsible open={openComments} onOpenChange={setOpenComments}>
        <CollapsibleTrigger className="sr-only">Toggle comments</CollapsibleTrigger>
        <CollapsibleContent>
        <div id={`comments-${item.id}`} className="space-y-3 border-t p-3 sm:p-4">
          {commentsLoading ? (
            <div className="text-sm text-muted-foreground">Loading comments…</div>
          ) : commentsError ? (
            <div className="text-sm text-red-600">Failed to load comments</div>
          ) : !comments || comments.length === 0 ? (
            <div className="text-sm text-muted-foreground">No comments yet</div>
          ) : (
            <>
              {comments.map((c) => (
                <CommentItem
                  key={c.id}
                  avatarUrl={c.user.avatarUrl}
                  name={c.user.name}
                  handle={c.user.handle}
                  time={new Date(c.createdAt).toLocaleTimeString()}
                  text={c.content}
                />
              ))}
            </>
          )}

            <div className="flex items-start gap-2 pt-1">
              <Avatar className="h-8 w-8">
                {item.user.avatarUrl ? <AvatarImage src={item.user.avatarUrl} alt={item.user.name} /> : null}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <label htmlFor={`comment-input-${item.id}`} className="sr-only">
                  Add a comment
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    id={`comment-input-${item.id}`}
                    placeholder="Add a comment"
                    className="h-10"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-10"
                    disabled={!commentText.trim()}
                    onClick={() => {
                      const text = commentText.trim();
                      if (!text) return;
                      onAddComment?.(text);
                      setCommentText("");
                    }}
                  >
                    Post
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function CommentItem({
  avatarUrl,
  name,
  handle,
  time,
  text,
}: {
  avatarUrl?: string;
  name: string;
  handle: string;
  time: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Avatar className="h-8 w-8">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
        <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-xs font-medium">{name}</span>
          <span className="truncate text-xs text-gray-500">{handle}</span>
          <span className="text-[11px] text-gray-500">{time}</span>
        </div>
        <p className="mt-0.5 text-sm text-foreground/90">{text}</p>
      </div>
    </div>
  );
}

function TipDialog({ item, onClose }: { item: FeedItemData; onClose: () => void }) {
  const [amount, setAmount] = useState<string>("");
  const parsed = Number(amount);
  const valid = !isNaN(parsed) && parsed >= 1 && parsed <= 500;

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Send a tip</DialogTitle>
        <DialogDescription>
          Support {item.user.name} {item.user.handle}. Min $1, max $500.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            {item.user.avatarUrl ? (
              <AvatarImage src={item.user.avatarUrl} alt={item.user.name} />
            ) : null}
            <AvatarFallback>{item.user.name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{item.user.name}</div>
            <div className="truncate text-xs text-muted-foreground">{item.user.handle}</div>
          </div>
        </div>

        <div>
          <label htmlFor={`tip-amount-${item.id}`} className="mb-1 block text-sm font-medium">
            Amount (USDT/USDC)
          </label>
          <Input
            id={`tip-amount-${item.id}`}
            inputMode="decimal"
            placeholder="10"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <p className={cn("mt-1 text-xs", valid ? "text-muted-foreground" : "text-red-600")}
          >
            {valid ? "You can tip between $1 and $500" : "Enter an amount between $1 and $500"}
          </p>
        </div>

        <div>
          <div className="text-sm font-medium">Payment method</div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Button variant="outline" className="w-full">Wallet</Button>
            <Button variant="outline" className="w-full">Credit Card</Button>
            <Button variant="outline" className="w-full">Crypto</Button>
          </div>
        </div>
      </div>

      <DialogFooter className="mt-2">
        <DialogClose asChild>
          <Button type="button" variant="ghost">Cancel</Button>
        </DialogClose>
        <Button type="button" disabled={!valid} onClick={onClose}>
          Confirm tip
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
