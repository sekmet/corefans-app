import { useState } from "react";
import { useAccount } from "wagmi";
import type { Address } from "viem";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRecentSubscriptions } from "@/hooks/use-subscriptions";

function shortHash(h?: string) {
  if (!h) return "-";
  return `${h.slice(0, 6)}…${h.slice(-4)}`;
}

export default function SubscriptionsHistory() {
  const { address } = useAccount();
  const [creator, setCreator] = useState<string>("");
  const creatorAddress = (creator?.trim() || undefined) as Address | undefined;
  const { data = [], isLoading } = useRecentSubscriptions(address as Address | undefined, creatorAddress, 50_000n);

  return (
    <div className="container mx-auto p-4 max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle>Recent Subscriptions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Filter by creator address (optional)"
              value={creator}
              onChange={(e) => setCreator(e.target.value)}
            />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Block</TableHead>
                  <TableHead>Tx</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Creator</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Amount (wei)</TableHead>
                  <TableHead>Token</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7}>Loading…</TableCell>
                  </TableRow>
                ) : data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>No recent subscriptions</TableCell>
                  </TableRow>
                ) : (
                  data.map((row) => (
                    <TableRow key={`${row.txHash}-${row.tierId.toString()}`}>
                      <TableCell>{row.blockNumber.toString()}</TableCell>
                      <TableCell>
                        <a
                          href={`https://scan.test2.btcs.network/tx/${row.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          {shortHash(row.txHash)}
                        </a>
                      </TableCell>
                      <TableCell>{shortHash(row.user)}</TableCell>
                      <TableCell>{shortHash(row.creator)}</TableCell>
                      <TableCell>#{row.tierId.toString()}</TableCell>
                      <TableCell>{row.amount.toString()}</TableCell>
                      <TableCell>{shortHash(row.paymentToken)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
