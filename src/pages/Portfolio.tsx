import Seo from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";

const Portfolio = () => {
  return (
    <>
      <Seo
        title="Portfolio — CoreFans"
        description="View your CoreFans tickets and token positions."
        canonical="/portfolio"
      />
      <main className="container py-14">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">Your Portfolio</h1>
          <p className="mt-2 text-muted-foreground">
            Connect Supabase to persist wallets, trades, and ticket access.
          </p>
        </header>

        <Card>
          <CardContent className="p-8 text-center">
            <div className="mx-auto max-w-xl">
              <h2 className="text-xl font-semibold">No holdings yet</h2>
              <p className="mt-2 text-muted-foreground">
                Explore creators, buy tickets, and they’ll appear here.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Link to="/">
                  <Button variant="hero">Explore Creators</Button>
                </Link>
                <a href="https://docs.lovable.dev/integrations/supabase/" target="_blank" rel="noreferrer">
                  <Button variant="outline">Connect Supabase</Button>
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
};

export default Portfolio;
