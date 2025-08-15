import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { FrontendTier } from "@/hooks/use-subscriptions";
import { formatUnits } from "viem";
import { useTokenInfo } from "@/hooks/use-subscriptions";
import { ZERO_ADDRESS } from "@/config/tokens";

export function TierCard({ tier, onSelect }: { tier: FrontendTier; onSelect: (t: FrontendTier) => void }) {
  const tokenAddr = tier.paymentToken ?? ZERO_ADDRESS;
  const { data: tokenInfo } = useTokenInfo(tokenAddr);
  return (
    <Card className="h-full">
      <CardContent className="p-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="font-medium">Tier #{tier.id}</div>
          <div className="text-xs text-muted-foreground line-clamp-1">
            {tier.metadataURI || "Subscription"}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">Duration: {tier.duration} sec</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-sm font-semibold">
            {Number(formatUnits(tier.price, tokenInfo?.decimals ?? 18)).toFixed(4)} {tokenInfo?.symbol ?? "ETH"}
          </div>
          <Button size="sm" onClick={() => onSelect(tier)}>Subscribe</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default TierCard;
