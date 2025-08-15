import { ReactNode } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TicketGateProps {
  hasTicket?: boolean;
  onBuy?: () => void;
  children: ReactNode;
}

const TicketGate = ({ hasTicket, onBuy, children }: TicketGateProps) => {
  if (hasTicket) return <>{children}</>;

  return (
    <div className="relative">
      <div className="rounded-lg border p-6 text-center glass">
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-secondary">
          <Lock className="size-5 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">Exclusive content</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Hold this creator’s ticket to unlock livestreams, meetups, and private posts.
        </p>
        <div className="mt-4 flex justify-center">
          <Button variant="gradient" size="lg" onClick={onBuy}>Get Ticket</Button>
        </div>
      </div>
    </div>
  );
};

export default TicketGate;
