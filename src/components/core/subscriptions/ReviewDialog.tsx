import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Address } from "viem";
import type { FrontendTier } from "@/hooks/use-subscriptions";
import { formatEther, formatUnits } from "viem";
import { useEstimateSubscribe, usePlatformFeeBps, useTokenInfo, useTokenPermitSupport } from "@/hooks/use-subscriptions";
import { useAccount } from "wagmi";
import { activeChain } from "@/lib/wagmi";
import { ZERO_ADDRESS } from "@/config/tokens";
import { Switch } from "@/components/ui/switch";

export function ReviewDialog({
  open,
  onOpenChange,
  creator,
  tier,
  onConfirm,
  isProcessing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  creator: Address | undefined;
  tier: FrontendTier | null;
  onConfirm: (usePermit?: boolean) => void;
  isProcessing?: boolean;
}) {
  const params = useMemo(() => ({
    creator,
    tierId: tier?.id,
    amountWei: tier?.price,
    paymentToken: tier?.paymentToken ?? (ZERO_ADDRESS as Address),
  }), [creator, tier]);

  const { data: est } = useEstimateSubscribe(params);
  const { data: feeBps } = usePlatformFeeBps();
  const { address } = useAccount();
  const tokenAddress = tier?.paymentToken ?? (ZERO_ADDRESS as Address);
  const { data: tokenInfo } = useTokenInfo(tokenAddress);
  const isEth = !tier || !tier.paymentToken || tier.paymentToken.toLowerCase() === ZERO_ADDRESS.toLowerCase();
  const { data: permitSupported } = useTokenPermitSupport(isEth ? undefined : tokenAddress);
  const [permitEnabled, setPermitEnabled] = useState(false);

  useEffect(() => {
    // Default to permit when supported, ERC20, and approval is needed
    if (!isEth && permitSupported && est?.approvalNeeded) {
      setPermitEnabled(true);
    } else {
      setPermitEnabled(false);
    }
  }, [isEth, permitSupported, est?.approvalNeeded]);

  const feeRow = useMemo(() => {
    if (!tier) return null;
    const bps = typeof feeBps === "number" ? feeBps : 0;
    const feeWei = (tier.price * BigInt(bps)) / 10000n;
    const creatorWei = tier.price - feeWei;
    return {
      bps,
      fee: Number(formatUnits(feeWei, tokenInfo?.decimals ?? 18)),
      creator: Number(formatUnits(creatorWei, tokenInfo?.decimals ?? 18)),
    };
  }, [tier, feeBps, tokenInfo?.decimals]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review Subscription</DialogTitle>
          <DialogDescription>
            Confirm your subscription details before proceeding.
          </DialogDescription>
        </DialogHeader>

        {tier ? (
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Tier</span>
              <span className="font-medium">#{tier.id}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Amount</span>
              <span className="font-medium">
                {Number(formatUnits(tier.price, tokenInfo?.decimals ?? 18)).toFixed(4)} {tokenInfo?.symbol ?? "ETH"}
              </span>
            </div>
            {feeRow ? (
              <>
                <div className="flex items-center justify-between">
                  <span>Platform Fee</span>
                  <span className="font-medium">{feeRow.bps / 100}% • {feeRow.fee.toFixed(6)} {tokenInfo?.symbol ?? "ETH"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Creator Receives</span>
                  <span className="font-medium">{feeRow.creator.toFixed(6)} {tokenInfo?.symbol ?? "ETH"}</span>
                </div>
              </>
            ) : null}
            <div className="flex items-center justify-between">
              <span>Estimated Gas</span>
              <span className="font-medium">{est ? Number(formatEther(est.feeWei)).toFixed(6) : "-"} ETH</span>
            </div>
            {est?.approvalNeeded ? (
              <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
                <span>Allowance</span>
                <span className="font-medium">Approval required</span>
              </div>
            ) : null}
            {!isEth ? (
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span>Permit (one tx)</span>
                  <span className="text-xs text-muted-foreground">
                    {permitSupported ? (est?.approvalNeeded ? "Recommended: avoids separate approval" : "Optional: single tx flow") : "Not supported by token"}
                  </span>
                </div>
                <Switch checked={permitEnabled} onCheckedChange={setPermitEnabled} disabled={!permitSupported || isProcessing} />
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <span>Network</span>
              <span className="font-medium">{activeChain?.name ?? "-"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Wallet</span>
              <span className="font-medium">{address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "-"}</span>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>Cancel</Button>
          <Button onClick={() => onConfirm(permitEnabled)} disabled={!tier || isProcessing}>{isProcessing ? "Processing..." : "Confirm"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ReviewDialog;
