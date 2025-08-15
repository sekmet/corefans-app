import Seo from "@/components/Seo";
import AmbientGlow from "@/components/AmbientGlow";
import { Button } from "@/components/ui/button";
import { creators } from "@/data/creators";
import CreatorCard from "@/components/core/CreatorCard";
import { Link } from "react-router-dom";
import { authClient } from "@/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Index = () => {
  const { data: session } = authClient.useSession();

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
    } catch (_) {
      // no-op
    }
  };
  return (
    <>
      <Seo
        title="CoreFans SocialFi — Creator Tokens & Tickets"
        description="Trade personalized creator tickets, unlock exclusive access, and engage with real and AI avatars on CoreFans."
        canonical="/"
      />

      {/* Top Navigation */}
      <div className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container h-14 flex items-center justify-between">
          <Link to="/" className="font-semibold tracking-tight">CoreFans</Link>
          <div className="flex items-center gap-2">
            {!session ? (
              <Link to="/login">
                <Button size="sm" className="tap-highlight">Login</Button>
              </Link>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger className="rounded-full focus:outline-none" aria-label="User menu">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={(session as any)?.user?.image || ""} alt={(session as any)?.user?.name || "User"} />
                    <AvatarFallback>
                      {((session as any)?.user?.email || "U").slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link to="/profile">Profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/portfolio">Portfolio</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>Sign out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      <header className="relative overflow-hidden">
        <div className="container py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-5xl font-bold leading-tight sm:text-6xl">
              CoreFans: <span className="text-gradient-primary">SocialFi</span> for Creators
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Mint and trade personalized tickets for access to exclusive content, livestreams, and meetups — for real creators and AI VTubers.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Link to="#explore">
                <Button variant="hero" size="xl" className="tap-highlight">Explore Creators</Button>
              </Link>
              <Link to="/portfolio">
                <Button variant="outline" size="xl" className="tap-highlight">Your Portfolio</Button>
              </Link>
            </div>
          </div>
        </div>
        <AmbientGlow />
      </header>

      <main id="explore" className="container pb-16">
        <section aria-labelledby="trending">
          <h2 id="trending" className="mb-6 text-2xl font-semibold">Trending creators</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {creators.map((c) => (
              <CreatorCard key={c.id} creator={c} />
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Trading is simulated. Connect Supabase to enable on-chain/account features.
          </p>
        </section>
      </main>

      <footer className="border-t py-10">
        <div className="container flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} CoreFans</p>
          <nav className="flex items-center gap-4 text-sm">
            <Link className="hover:underline" to="/">Home</Link>
            <Link className="hover:underline" to="/portfolio">Portfolio</Link>
          </nav>
        </div>
      </footer>
    </>
  );
};

export default Index;
