import React from "react";
import { useAccount, useConnect, useDisconnect, usePublicClient } from "wagmi";
import type { Address } from "viem";
import { formatEther } from "viem";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "./common";
import { DEMO_WALLET_TX } from "./demo";
import { Banknote, Coins, CreditCard, Wallet as WalletIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function WalletPage() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending: isConnectPending } = useConnect();
  const { disconnect } = useDisconnect();
  const publicClient = usePublicClient();

  const { data: balanceWei, isFetching: isBalanceLoading } = useQuery({
    queryKey: ["native-balance", address],
    enabled: !!publicClient && !!address,
    queryFn: async () => {
      if (!publicClient || !address) return 0n;
      return publicClient.getBalance({ address: address as Address });
    },
  });

  const formattedBalance = isConnected
    ? (isBalanceLoading ? "Loading..." : `${Number(formatEther(balanceWei ?? 0n)).toLocaleString(undefined, { maximumFractionDigits: 6 })} ETH`)
    : "—";

  return (
    <section>
      <SectionHeader title="Wallet" description="Deposit or withdraw funds." />
      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2"><WalletIcon className="size-4" /> Balance</CardTitle>
          <CardDescription>Connected wallet and on-chain balance</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-3xl font-semibold">{formattedBalance}</div>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <span className="text-xs text-muted-foreground font-mono hidden sm:inline">{address}</span>
                  <Button variant="secondary" size="sm" onClick={() => disconnect()}>Disconnect</Button>
                </>
              ) : (
                connectors.map((c) => (
                  <Button
                    key={c.uid}
                    variant="hero"
                    size="sm"
                    onClick={() => connect({ connector: c })}
                    disabled={isConnectPending}
                    title={`Connect with ${c.name}`}
                  >
                    Connect {c.name}
                  </Button>
                ))
              )}
            </div>
          </div>
          <Tabs defaultValue="deposit" className="max-w-xl">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="deposit">Deposit</TabsTrigger>
              <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
            </TabsList>

            <TabsContent value="deposit">
              <div className="grid gap-4">
                <div className="grid gap-2 max-w-sm">
                  <Label htmlFor="amount-deposit">Amount</Label>
                  <Input id="amount-deposit" type="number" min={1} step="0.01" placeholder="0.00" />
                </div>
                <div className="grid gap-2 max-w-sm">
                  <Label>Payment method</Label>
                  <RadioGroup defaultValue="card" className="grid gap-2">
                    <label htmlFor="pm-card" className="flex items-center justify-between rounded-md border p-2 cursor-pointer">
                      <span className="inline-flex items-center gap-2"><CreditCard className="size-4" /> Card</span>
                      <RadioGroupItem id="pm-card" value="card" />
                    </label>
                    <label htmlFor="pm-bank" className="flex items-center justify-between rounded-md border p-2 cursor-pointer">
                      <span className="inline-flex items-center gap-2"><Banknote className="size-4" /> Bank</span>
                      <RadioGroupItem id="pm-bank" value="bank" />
                    </label>
                    <label htmlFor="pm-crypto" className="flex items-center justify-between rounded-md border p-2 cursor-pointer">
                      <span className="inline-flex items-center gap-2"><Coins className="size-4" /> Crypto</span>
                      <RadioGroupItem id="pm-crypto" value="crypto" />
                    </label>
                  </RadioGroup>
                </div>
                <div>
                  <Button>Continue</Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="withdraw">
              <div className="grid gap-4">
                <div className="grid gap-2 max-w-sm">
                  <Label htmlFor="amount-withdraw">Amount</Label>
                  <Input id="amount-withdraw" type="number" min={1} step="0.01" placeholder="0.00" />
                </div>
                <div className="grid gap-2 max-w-sm">
                  <Label>Destination</Label>
                  <RadioGroup defaultValue="bank" className="grid gap-2">
                    <label htmlFor="wd-bank" className="flex items-center justify-between rounded-md border p-2 cursor-pointer">
                      <span className="inline-flex items-center gap-2"><Banknote className="size-4" /> Bank</span>
                      <RadioGroupItem id="wd-bank" value="bank" />
                    </label>
                    <label htmlFor="wd-crypto" className="flex items-center justify-between rounded-md border p-2 cursor-pointer">
                      <span className="inline-flex items-center gap-2"><Coins className="size-4" /> Crypto</span>
                      <RadioGroupItem id="wd-crypto" value="crypto" />
                    </label>
                  </RadioGroup>
                </div>
                <div>
                  <Button>Continue</Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Transaction history</CardTitle>
          <CardDescription>Recent wallet activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {DEMO_WALLET_TX.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.date}</TableCell>
                    <TableCell>{t.type}</TableCell>
                    <TableCell>${t.amount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={t.status === "completed" ? "default" : t.status === "pending" ? "secondary" : "destructive"}>
                        {t.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
