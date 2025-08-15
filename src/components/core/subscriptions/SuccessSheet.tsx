import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAccount } from "wagmi";
import { type Address } from "viem";
import { useAccessPassPreview } from "@/hooks/use-subscriptions";

export function SuccessSheet({
  open,
  onOpenChange,
  activeUntil,
  creator,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  activeUntil?: number; // seconds since epoch
  creator: Address;
}) {
  const formatted = activeUntil ? new Date(activeUntil * 1000).toLocaleString() : "-";
  const { address } = useAccount();
  const { data: preview } = useAccessPassPreview(address as Address | undefined, creator);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="space-y-4">
        <SheetHeader>
          <SheetTitle>Subscription Activated</SheetTitle>
          <SheetDescription>
            Your subscription is now active.
          </SheetDescription>
        </SheetHeader>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Active Until</div>
          <div className="text-base font-semibold">{formatted}</div>
        </div>
        <div className="rounded-lg border p-4 flex flex-col items-center justify-center gap-2">
          <img src="/placeholder.svg" alt="Access Pass" className="h-24 w-24" />
          <div className="text-sm text-muted-foreground">Access Pass</div>
          {preview && (
            <div className="text-xs text-muted-foreground text-center space-y-1">
              {preview.tokenId !== undefined && (
                <div>Token ID: <span className="font-mono">{preview.tokenId.toString()}</span></div>
              )}
              {preview.tokenURI && (
                <div className="break-all">
                  tokenURI: <span className="font-mono">{preview.tokenURI}</span>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => onOpenChange(false)}>View Content</Button>
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default SuccessSheet;
