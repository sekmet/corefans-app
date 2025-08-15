import React from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Search, Repeat2, Pencil } from "lucide-react";
import { Link } from "react-router-dom";

const suggestions = [
  {
    id: "fiona-mary",
    name: "Fiona Mary",
    handle: "@fionamary",
    bg: "https://images.unsplash.com/photo-1519624782644-8a1cd8892727?q=80&w=1600&auto=format&fit=crop",
    avatar: "https://i.pravatar.cc/100?img=20",
  },
  {
    id: "christina",
    name: "Christina",
    handle: "@qu33nChrissy",
    bg: "https://images.unsplash.com/photo-1519750783826-e2420f4d687f?q=80&w=1600&auto=format&fit=crop",
    avatar: "https://i.pravatar.cc/100?img=32",
  },
  {
    id: "galexa",
    name: "GALEXA",
    handle: "@gerifens",
    bg: "https://images.unsplash.com/photo-1504711331083-9c895941bf81?q=80&w=1600&auto=format&fit=crop",
    avatar: "https://i.pravatar.cc/100?img=54",
  },
] as const;

export default function RightRail() {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Search */}
      <div className="relative">
        <label htmlFor="rr-search" className="sr-only">
          Search
        </label>
        <Input id="rr-search" placeholder="Search" className="pr-10" />
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>

      {/* Suggestions */}
      <Card className="border border-gray-200 shadow-sm p-3 sm:p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground">SUGGESTIONS</h3>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" className="size-7" aria-label="Edit suggestions">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7" aria-label="Refresh suggestions">
              <Repeat2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="space-y-3">
          {suggestions.map((s) => (
            <Link key={s.id} to={`/creator/${s.id}`} className="block focus:outline-none">
              <div className="group relative overflow-hidden rounded-md">
                <img
                  src={s.bg}
                  alt={`${s.name} cover`}
                  className="h-24 w-full object-cover transition-opacity group-hover:opacity-95 sm:h-28"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                <div className="absolute left-3 bottom-3 flex items-center gap-2">
                  <Avatar className="h-8 w-8 ring-2 ring-white">
                    <AvatarImage src={s.avatar} alt={s.name} />
                    <AvatarFallback>{s.name.slice(0,1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white drop-shadow">{s.name}</div>
                    <div className="truncate text-xs text-white/90">{s.handle}</div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
          <div className="flex items-center justify-center gap-1 pt-1 text-xs text-muted-foreground" aria-label="carousel position">
            <span>●</span>
            <span>●</span>
            <span className="text-foreground">●</span>
          </div>
        </div>
      </Card>

      {/* Ad */}
      <Card aria-label="Sponsored" className="overflow-hidden border border-gray-200 shadow-sm">
        <div className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-orange-400 p-6 text-center text-white">
          <div className="text-lg font-bold tracking-wide">Your AD</div>
          <div className="text-xs uppercase opacity-90">HERE</div>
        </div>
        <Separator />
        <div className="p-3 text-center text-xs text-muted-foreground">Sponsored</div>
      </Card>
    </div>
  );
}
