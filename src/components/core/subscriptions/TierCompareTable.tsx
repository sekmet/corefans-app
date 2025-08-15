import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatEther } from "viem";
import type { FrontendTier } from "@/hooks/use-subscriptions";

export function TierCompareTable({ tiers }: { tiers: FrontendTier[] }) {
  if (!tiers?.length) return null;
  return (
    <div className="w-full overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Tier</TableHead>
            <TableHead className="whitespace-nowrap">Price (ETH)</TableHead>
            <TableHead className="whitespace-nowrap">Duration (days)</TableHead>
            <TableHead className="min-w-[200px]">Metadata</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tiers.map((t) => {
            const days = Math.max(1, Math.floor(t.duration / 86400));
            const meta = t.metadataURI?.length > 48 ? t.metadataURI.slice(0, 45) + "…" : t.metadataURI;
            return (
              <TableRow key={t.id}>
                <TableCell>#{t.id}</TableCell>
                <TableCell>{formatEther(t.price)}</TableCell>
                <TableCell>{days}</TableCell>
                <TableCell title={t.metadataURI} className="text-muted-foreground">
                  {meta || "-"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export default TierCompareTable;
