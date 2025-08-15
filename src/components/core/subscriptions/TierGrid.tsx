import type { FrontendTier } from "@/hooks/use-subscriptions";
import TierCard from "./TierCard";

export function TierGrid({ tiers, onSelect }: { tiers: FrontendTier[]; onSelect: (t: FrontendTier) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {tiers.map((t) => (
        <TierCard key={t.id} tier={t} onSelect={onSelect} />
      ))}
    </div>
  );
}

export default TierGrid;
