import React from "react";

import FeedItem, { FeedItemData } from "@/components/core/FeedItem";
import { Card } from "@/components/ui/card";
import RightRail from "@/components/core/RightRail";
import PostComposer from "@/components/core/PostComposer";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { addComment, getFeed, toggleLike } from "@/lib/feed";

type FeedItemServer = {
  id: string;
  user: { name: string; handle: string; avatarUrl?: string | null };
  timestamp: string; // ISO
  ppv?: boolean;
  imageUrl?: string | null;
  content?: string | null;
  liked?: boolean;
  hasPoll?: boolean;
  stats: { likes: number; comments: number; tips: number };
};

function toUI(item: FeedItemServer): FeedItemData {
  // Convert ISO -> relative simple (hours/days). For now, show ISO; can replace with date-fns later.
  return {
    id: item.id,
    user: { name: item.user.name, handle: item.user.handle, avatarUrl: item.user.avatarUrl ?? undefined },
    timestamp: new Date(item.timestamp).toLocaleString(),
    ppv: item.ppv,
    imageUrl: item.imageUrl ?? undefined,
    content: item.content ?? undefined,
    hasPoll: item.hasPoll ?? false,
    stats: item.stats,
  };
}

// Inline Composer replaced by reusable <PostComposer /> component

export default function Feed() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["feed", { limit: 20 }],
    queryFn: () => getFeed({ limit: 20 }).then((r) => r.items),
  });

  const { mutate: like } = useMutation({
    mutationFn: (postId: string) => toggleLike(postId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feed", { limit: 20 }] }),
  });

  const { mutate: comment } = useMutation({
    mutationFn: (vars: { postId: string; text: string }) => addComment(vars.postId, vars.text),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["feed", { limit: 20 }] });
      qc.invalidateQueries({ queryKey: ["postComments", vars.postId] });
    },
  });

  return (
    <div className="mx-auto max-w-6xl h-full min-h-0 grid grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[minmax(0,800px)_320px] lg:items-start">
      <div className="mx-auto w-full max-w-4xl h-full min-h-0 overflow-y-auto overscroll-contain pr-1 space-y-4 sm:space-y-6">
        <PostComposer />
        {isLoading ? <Card className="p-4">Loading feed...</Card> : null}
        {error ? <Card className="p-4 text-red-600">Failed to load feed</Card> : null}
        {data?.map((srv) => {
          const item = toUI(srv as FeedItemServer);
          const liked = (srv as FeedItemServer).liked ?? false;
          return (
            <FeedItem
              key={item.id}
              item={item}
              liked={liked}
              onLike={() => like(item.id)}
              onAddComment={(text) => comment({ postId: item.id, text })}
            />
          );
        })}
      </div>
      <aside className="hidden lg:block lg:fixed lg:top-4 lg:right-6 lg:w-[320px]">
        <RightRail />
      </aside>
    </div>
  );
}
