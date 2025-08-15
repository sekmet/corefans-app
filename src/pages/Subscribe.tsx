import Seo from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PaymentMethodSelect } from "@/components/core/subscriptions/PaymentMethodSelect";
import { TierGrid } from "@/components/core/subscriptions/TierGrid";
import { ReviewDialog } from "@/components/core/subscriptions/ReviewDialog";
import SuccessSheet from "@/components/core/subscriptions/SuccessSheet";
import { TierCompareTable } from "@/components/core/subscriptions/TierCompareTable";
import { useCreatorEthTiers, useCreatorErc20Tiers, useSubscribe, useSubscriptionStatus, type FrontendTier } from "@/hooks/use-subscriptions";
import { useMemo, useState, useEffect } from "react";
import { type Address } from "viem";
import { getSupportedPaymentTokens, ZERO_ADDRESS } from "@/config/tokens";
import { activeChain } from "@/lib/wagmi";
import { useToast } from "@/hooks/use-toast";

const SubscribePage = () => {
  const demoCreatorAddress = (import.meta.env.VITE_DEMO_CREATOR_ADDRESS || "") as Address;
  const { data: ethTiers = [], isLoading: ethTiersLoading } = useCreatorEthTiers(demoCreatorAddress);
  const { data: erc20Tiers = [], isLoading: erc20TiersLoading } = useCreatorErc20Tiers(demoCreatorAddress);

  const {
    address: walletAddress,
    connectors,
    connect,
    isConnectPending,
    subscribe,
    subscribeWithPermit,
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
  const supportedTokens = useMemo(() => getSupportedPaymentTokens(activeChain.id), []);
  const displayedTiers: FrontendTier[] = useMemo(() => {
    if (!tokenAddr || tokenAddr.toLowerCase() === ZERO_ADDRESS.toLowerCase()) return ethTiers;
    return erc20Tiers.filter((t) => t.paymentToken?.toLowerCase() === tokenAddr.toLowerCase());
  }, [tokenAddr, ethTiers, erc20Tiers]);

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

  return (
    <>
      <Seo title="Subscribe — CoreFans" description="Subscribe to a creator's content" canonical="/subscribe" />
      <main className="container py-10">
        <Card>
          <CardContent className="p-6 space-y-4">
            <h1 className="text-2xl font-bold">Subscribe</h1>
            {!demoCreatorAddress ? (
              <p className="text-sm text-muted-foreground">Set VITE_DEMO_CREATOR_ADDRESS to enable subscriptions.</p>
            ) : (
              <div className="space-y-4">
                {!walletAddress ? (
                  <Button
                    className="w-full"
                    onClick={() => connectors[0] && connect({ connector: connectors[0] })}
                    disabled={!connectors.length || isConnectPending}
                  >
                    {isConnectPending ? "Connecting..." : "Connect Wallet"}
                  </Button>
                ) : (ethTiersLoading || erc20TiersLoading) ? (
                  <p className="text-sm text-muted-foreground">Loading tiers...</p>
                ) : displayedTiers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tiers available for selected token.</p>
                ) : (
                  <>
                    <PaymentMethodSelect
                      tokens={supportedTokens}
                      value={tokenAddr}
                      onChange={setTokenAddr}
                    />
                    <TierGrid
                      tiers={displayedTiers}
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
                        <TierCompareTable tiers={displayedTiers} />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <ReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        creator={demoCreatorAddress}
        tier={selectedTier}
        isProcessing={isWriting || isWaiting}
        onConfirm={(usePermit) => {
          if (selectedTier) {
            if (usePermit && selectedTier.paymentToken && selectedTier.paymentToken.toLowerCase() !== ZERO_ADDRESS.toLowerCase()) {
              subscribeWithPermit(
                demoCreatorAddress,
                selectedTier.id,
                selectedTier.price,
                selectedTier.paymentToken
              );
            } else {
              subscribe(
                demoCreatorAddress,
                selectedTier.id,
                selectedTier.price,
                selectedTier.paymentToken
              );
            }
          }
        }}
      />

      <SuccessSheet
        open={successOpen}
        onOpenChange={setSuccessOpen}
        activeUntil={subStatus ? Number(subStatus.expiry) : undefined}
        creator={demoCreatorAddress}
      />
    </>
  );
};

export default SubscribePage;
