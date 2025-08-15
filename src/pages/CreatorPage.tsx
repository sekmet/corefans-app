import { useParams, Link } from "react-router-dom";
import Seo from "@/components/Seo";
import AmbientGlow from "@/components/AmbientGlow";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import TicketGate from "@/components/core/TicketGate";
import TradeDialog from "@/components/core/TradeDialog";
import { creators } from "@/data/creators";
import { useCreatorEthTiers, useSubscribe, useSubscriptionStatus, type FrontendTier } from "@/hooks/use-subscriptions";
import { useToast } from "@/hooks/use-toast";
import { formatEther, type Address } from "viem";
import { useEffect, useMemo, useState } from "react";
import { PaymentMethodSelect } from "@/components/core/subscriptions/PaymentMethodSelect";
import { TierGrid } from "@/components/core/subscriptions/TierGrid";
import { ReviewDialog } from "@/components/core/subscriptions/ReviewDialog";
import { SuccessSheet } from "@/components/core/subscriptions/SuccessSheet";
import { TierCompareTable } from "@/components/core/subscriptions/TierCompareTable";
import { getSupportedPaymentTokens, ZERO_ADDRESS } from "@/config/tokens";
import { activeChain } from "@/lib/wagmi";

const CreatorPage = () => {
  const { slug } = useParams();
  const creator = creators.find((c) => c.slug === slug);

  const demoCreatorAddress = (import.meta.env.VITE_DEMO_CREATOR_ADDRESS || "") as Address;
  const { data: tiers = [], isLoading: tiersLoading } = useCreatorEthTiers(
    demoCreatorAddress
  );
  const {
    address: walletAddress,
    connectors,
    connect,
    isConnectPending,
    subscribe,
    isWriting,
    isWaiting,
    receipt,
    writeError,
  } = useSubscribe();
  const { toast } = useToast();
  const { data: subStatus } = useSubscriptionStatus(walletAddress, demoCreatorAddress);

  const [selectedTier, setSelectedTier] = useState<FrontendTier | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [tokenAddr, setTokenAddr] = useState<Address>(ZERO_ADDRESS);
  const [showCompare, setShowCompare] = useState(false);
  const ethTokens = useMemo(() => getSupportedPaymentTokens(activeChain.id).filter((t) => t.isNative), []);

  useEffect(() => {
    if (receipt) {
      toast({ title: "Subscribed", description: "Your subscription is processing." });
      setReviewOpen(false);
      setSuccessOpen(true);
    }
    if (writeError) {
      toast({ title: "Transaction failed", description: writeError.message, variant: "destructive" });
    }
  }, [receipt, writeError, toast]);

  if (!creator) {
    return (
      <main className="container py-16">
        <h1 className="text-3xl font-bold">Creator not found</h1>
        <p className="mt-2 text-muted-foreground">Please return to explore.</p>
        <Link to="/">
          <Button className="mt-6" variant="soft">Back Home</Button>
        </Link>
      </main>
    );
  }

  return (
    <>
      <Seo
        title={`${creator.name} — CoreFans`}
        description={`Trade ${creator.name} tickets and unlock exclusive content.`}
        canonical={`/creator/${creator.slug}`}
      />
      <header className="relative">
        <div className="bg-gradient-primary">
          <div className="container py-12">
            <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
              <img
                src={creator.avatar}
                alt={`${creator.name} avatar large`}
                className="size-24 rounded-2xl object-cover ring-2 ring-accent/30"
              />
              <div>
                <h1 className="text-3xl font-bold">{creator.name}</h1>
                <p className="mt-1 text-muted-foreground">{creator.type} • {creator.team}</p>
                <div className="mt-3 flex gap-2">
                  <TradeDialog creator={creator}>
                    <Button variant="hero">Trade Tickets</Button>
                  </TradeDialog>
                  <Link to="/">
                    <Button variant="outline">Explore more</Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
        <AmbientGlow />
      </header>

      <main className="container grid gap-8 py-10 md:grid-cols-3">
        <section className="md:col-span-2">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold">About {creator.name}</h2>
              <p className="mt-2 text-muted-foreground">{creator.description}</p>

              <div className="mt-6">
                <TicketGate onBuy={() => {}}>
                  <div className="rounded-lg border p-6">
                    <h3 className="text-lg font-semibold">Unlocked: VIP Content</h3>
                    <p className="mt-2 text-muted-foreground">
                      Behind-the-scenes clips, exclusive livestream VODs, and monthly meetups appear here when you hold a ticket.
                    </p>
                  </div>
                </TicketGate>
              </div>
            </CardContent>
          </Card>
        </section>

        <aside>
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold">Market</h2>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Floor</div>
                  <div className="font-semibold">{creator.floorPrice.toFixed(2)} CFN</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Supply</div>
                  <div className="font-semibold">{creator.supply.toLocaleString()}</div>
                </div>
              </div>
              <div className="mt-6">
                <TradeDialog creator={creator}>
                  <Button variant="gradient" className="w-full">Quick Buy</Button>
                </TradeDialog>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold">Subscriptions</h2>
              {!demoCreatorAddress ? (
                <p className="mt-2 text-sm text-muted-foreground">Set VITE_DEMO_CREATOR_ADDRESS to enable subscriptions.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {!walletAddress ? (
                    <Button
                      className="w-full"
                      onClick={() => connectors[0] && connect({ connector: connectors[0] })}
                      disabled={!connectors.length || isConnectPending}
                    >
                      {isConnectPending ? "Connecting..." : "Connect Wallet"}
                    </Button>
                  ) : tiersLoading ? (
                    <p className="text-sm text-muted-foreground">Loading tiers...</p>
                  ) : tiers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No ETH tiers available.</p>
                  ) : (
                    <>
                      <PaymentMethodSelect
                        tokens={ethTokens}
                        value={tokenAddr}
                        onChange={setTokenAddr}
                        disabled
                      />
                      <TierGrid
                        tiers={tiers}
                        onSelect={(t) => {
                          setSelectedTier(t);
                          setReviewOpen(true);
                        }}
                      />
                      <div className="mt-2 flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => setShowCompare((s) => !s)}>
                          {showCompare ? "Hide compare" : "Compare tiers"}
                        </Button>
                      </div>
                      {showCompare && (
                        <div className="mt-3">
                          <TierCompareTable tiers={tiers} />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </main>

      <ReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        creator={demoCreatorAddress}
        tier={selectedTier}
        isProcessing={isWriting || isWaiting}
        onConfirm={() => {
          if (selectedTier) {
            subscribe(demoCreatorAddress, selectedTier.id, selectedTier.price);
          }
        }}
      />

      <SuccessSheet
        open={successOpen}
        onOpenChange={setSuccessOpen}
        activeUntil={subStatus ? Number(subStatus.expiry) : undefined}
      />
    </>
  );
};

export default CreatorPage;
