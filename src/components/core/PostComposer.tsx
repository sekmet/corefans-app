import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createPost } from "@/lib/feed";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Paperclip, DollarSign, BarChart3, Bell, Calendar, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";

/**
 * PostComposer
 * - Sticky header with avatar + title
 * - Textarea with auto-resize, min-h 120px
 * - Action bar with icon buttons (files, price, poll, notifications, scheduling)
 * - Controls: Clear draft + Post
 * - Drag & drop files with previews (client-side only for now)
 * - Draft autosave to localStorage
 */
export default function PostComposer() {
  const qc = useQueryClient();
  const { data: session } = authClient.useSession();
  const me = (session?.user as any) || undefined;

  const [text, setText] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [isDragging, setDragging] = React.useState(false);
  const taRef = React.useRef<HTMLTextAreaElement | null>(null);

  // Autosize textarea
  const resize = React.useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  React.useEffect(() => {
    resize();
  }, [text, resize]);

  // Draft autosave/load
  React.useEffect(() => {
    const saved = localStorage.getItem("postDraft:text");
    if (saved) setText(saved);
    // simple files draft is not restored to avoid blob URL leaks
  }, []);
  React.useEffect(() => {
    localStorage.setItem("postDraft:text", text);
  }, [text]);

  const { mutate: doCreate, isPending } = useMutation({
    mutationFn: (body: { content?: string }) => createPost({ content: body.content }),
    onSuccess: () => {
      setText("");
      setFiles([]);
      localStorage.removeItem("postDraft:text");
      qc.invalidateQueries({ queryKey: ["feed", { limit: 20 }] });
    },
  });

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files || []);
    if (dropped.length) setFiles((prev) => [...prev, ...dropped].slice(0, 4));
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }

  function clearDraft() {
    setText("");
    setFiles([]);
    localStorage.removeItem("postDraft:text");
  }

  return (
    <Card className="border border-gray-200 shadow-sm">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur p-4 flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={me?.image ?? me?.avatarUrl ?? undefined} alt={me?.name || "You"} />
          <AvatarFallback>{(me?.name || "You").slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="text-sm font-medium leading-none">New post</div>
          <div className="text-xs text-muted-foreground truncate">Share an update with your fans</div>
        </div>
      </div>

      {/* Composer body with drag-drop */}
      <div
        className={`p-4 pt-3 ${isDragging ? "ring-2 ring-primary/40" : ""}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        aria-label="Post composer"
        role="region"
      >
        <label htmlFor="composer-textarea" className="sr-only">
          What's happening?
        </label>
        <Textarea
          id="composer-textarea"
          ref={taRef}
          placeholder="What's happening?"
          className="min-h-[120px] resize-none focus-visible:ring-1"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onInput={resize}
        />

        {/* Previews */}
        {files.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {files.map((f, i) => {
              const url = URL.createObjectURL(f);
              const isImg = f.type.startsWith("image/");
              return (
                <div key={i} className="relative aspect-video rounded-md overflow-hidden border bg-muted">
                  {isImg ? (
                    <img src={url} alt={f.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full grid place-items-center text-xs p-2 text-center">{f.name}</div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Action bar */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <IconButton label="Attach files" Icon={Paperclip} onClick={() => {}} />
          <IconButton label="Set price" Icon={DollarSign} onClick={() => {}} />
          <IconButton label="Create poll" Icon={BarChart3} onClick={() => {}} />
          <IconButton label="Notifications" Icon={Bell} onClick={() => {}} />
          <IconButton label="Schedule" Icon={Calendar} onClick={() => {}} />
        </div>

        <Separator className="my-3" />

        {/* Controls */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            onClick={clearDraft}
          >
            Clear draft
          </button>
          <Button
            size="sm"
            className="min-h-[44px] min-w-[88px]"
            disabled={!text || isPending}
            onClick={() => doCreate({ content: text })}
          >
            {isPending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Posting
              </span>
            ) : (
              "Post"
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function IconButton({ label, Icon, onClick }: { label: string; Icon: React.ComponentType<{ className?: string }>; onClick?: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="h-10 w-10 grid place-items-center rounded-md border bg-background hover:bg-accent transition-transform duration-200 active:scale-95"
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
