import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getPoll, votePoll, GetPollResponse, VotePollResponse } from "@/lib/feed";
import { cn } from "@/lib/utils";

/**
 * Poll component for a post
 * - Fetches poll metadata and current results
 * - Allows user to cast/change a single vote
 * - Renders results after voting or expiration
 */
export default function Poll({ postId, className }: { postId: string; className?: string }) {
  const qc = useQueryClient();
  const { data, isLoading, isError, error } = useQuery<GetPollResponse, Error>({
    queryKey: ["poll", postId],
    queryFn: () => getPoll(postId),
  });
  // Declare mutation hook unconditionally to keep hooks order stable
  const { mutate: doVote, isPending } = useMutation<VotePollResponse, Error, { optionId: number }>({
    mutationFn: ({ optionId }) => votePoll(postId, optionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["poll", postId] }),
  });

  // If any error occurred fetching the poll, render nothing
  if (isError) {
    return null;
  }

  if (isLoading) {
    return (
      <Card className={cn("mt-2 p-3 sm:p-4 border border-gray-200", className)}>
        <div className="h-4 w-40 rounded bg-muted" />
        <div className="mt-3 grid gap-2">
          <div className="h-9 rounded bg-muted" />
          <div className="h-9 rounded bg-muted" />
        </div>
      </Card>
    );
  }

  if (!data?.ok) return null;

  const hasVoted = data.selectedOptionId != null;
  const showResults = hasVoted || data.expired;

  return (
    <Card className={cn("mt-2 p-3 sm:p-4 border border-gray-200", className)}>
      <div className="text-sm font-medium">{data.question}</div>
      {!showResults ? (
        <div className="mt-3 grid gap-2">
          {data.options.map((opt) => (
            <Button
              key={opt.optionId}
              type="button"
              variant="outline"
              className="justify-start min-h-[44px]"
              onClick={() => doVote({ optionId: opt.optionId })}
              disabled={isPending}
              aria-label={`Vote for ${opt.text}`}
            >
              {opt.text}
            </Button>
          ))}
        </div>
      ) : (
        <div className="mt-3 grid gap-3">
          {data.options.map((opt) => {
            const percent = data.totalVotes > 0 ? Math.round((opt.votes / data.totalVotes) * 100) : 0;
            const isMine = data.selectedOptionId === opt.optionId;
            return (
              <div key={opt.optionId} className={cn("rounded border p-2", isMine && "border-primary")}
                   aria-label={`${opt.text} has ${opt.votes} votes, ${percent}%`}>
                <div className="flex items-center justify-between text-sm">
                  <span className={cn(isMine && "font-semibold")}>{opt.text}</span>
                  <span className="text-xs text-muted-foreground">{percent}%</span>
                </div>
                <Progress value={percent} className="mt-2 h-2" />
              </div>
            );
          })}
          <div className="text-xs text-muted-foreground">{data.totalVotes} votes{data.expired ? " · Poll ended" : ""}</div>
        </div>
      )}
    </Card>
  );
}
