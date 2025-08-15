import { ReactNode, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { Creator } from "@/data/creators";

interface TradeDialogProps {
  creator: Creator;
  children: ReactNode; // trigger
}

const TradeDialog = ({ creator, children }: TradeDialogProps) => {
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState<number>(1);
  const price = (creator.floorPrice * amount).toFixed(2);

  const onSubmit = () => {
    toast.success(`${mode === 'buy' ? 'Purchased' : 'Listed'} ${amount} ${creator.name} ticket(s) • ${price} CFN`, {
      description: 'Connect Supabase to enable real trading and settlement.'
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Trade tickets — {creator.name}</DialogTitle>
          <DialogDescription>
            Mock trading UI. Real trading activates after Supabase integration.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="flex rounded-md border p-1">
            <Button
              variant={mode === 'buy' ? 'gradient' : 'soft'}
              className="flex-1"
              onClick={() => setMode('buy')}
            >
              Buy
            </Button>
            <Button
              variant={mode === 'sell' ? 'gradient' : 'soft'}
              className="flex-1"
              onClick={() => setMode('sell')}
            >
              Sell
            </Button>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(Math.max(1, Number(e.target.value)))}
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Est. {mode === 'buy' ? 'Cost' : 'Proceeds'}</span>
            <span className="font-semibold">{price} CFN</span>
          </div>

          <Button variant="hero" onClick={onSubmit}>
            {mode === 'buy' ? 'Confirm Purchase' : 'Confirm Sell'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TradeDialog;
