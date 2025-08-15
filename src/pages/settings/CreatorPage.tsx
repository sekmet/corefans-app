import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient, useWriteContract, useChainId } from "wagmi";
import type { Address } from "viem";
import { parseEther } from "viem";
import { activeChain } from "@/lib/wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { CreatorRegistryAbi } from "@/services/abis/CreatorRegistry";
import { SubscriptionManagerAbi } from "@/services/abis/SubscriptionManager";
import { CREATOR_REGISTRY_ADDRESS, SUBSCRIPTION_MANAGER_ADDRESS } from "@/config/contracts";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

function isAddressLike(v?: string): v is Address {
  return typeof v === "string" && /^0x[a-fA-F0-9]{40}$/.test(v);
}

export default function CreatorSettingsPage() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const walletChainId = useChainId();

  const enabled = Boolean(publicClient && address && CREATOR_REGISTRY_ADDRESS);
  const isWrongNetwork = Boolean(walletChainId && walletChainId !== activeChain.id);

  const { data: creatorInfo, refetch, isFetching } = useQuery({
    queryKey: ["creator-info", address, CREATOR_REGISTRY_ADDRESS],
    enabled,
    queryFn: async (): Promise<{
      isCreator: boolean;
      payout?: Address;
      isAI?: boolean;
      handle?: string;
      owner?: Address;
      isOwner?: boolean;
    } | null> => {
      if (!publicClient || !address || !CREATOR_REGISTRY_ADDRESS) return null;
      try {
        // Read owner and creator status first; other fields may revert for non-creators
        const [owner, isCreator] = await Promise.all([
          publicClient.readContract({ address: CREATOR_REGISTRY_ADDRESS as Address, abi: CreatorRegistryAbi, functionName: "owner" }) as Promise<Address>,
          publicClient.readContract({ address: CREATOR_REGISTRY_ADDRESS as Address, abi: CreatorRegistryAbi, functionName: "isCreator", args: [address as Address] }) as Promise<boolean>,
        ]);
        const isOwner = !!owner && owner.toLowerCase() === (address as string).toLowerCase();

        if (!isCreator) {
          // Do not attempt to read creator-specific fields if not a creator yet
          return { isCreator, payout: undefined, isAI: undefined, handle: "", owner, isOwner };
        }

        // Read creator-specific fields, tolerate failures
        const [payoutRes, isAIRes, handleRes] = await Promise.allSettled([
          publicClient.readContract({ address: CREATOR_REGISTRY_ADDRESS as Address, abi: CreatorRegistryAbi, functionName: "getPayoutAddress", args: [address as Address] }) as Promise<Address>,
          publicClient.readContract({ address: CREATOR_REGISTRY_ADDRESS as Address, abi: CreatorRegistryAbi, functionName: "isAI", args: [address as Address] }) as Promise<boolean>,
          publicClient.readContract({ address: CREATOR_REGISTRY_ADDRESS as Address, abi: CreatorRegistryAbi, functionName: "displayHandle", args: [address as Address] }) as Promise<string>,
        ]);

        const payout = payoutRes.status === "fulfilled" ? (payoutRes.value as Address) : undefined;
        const isAI = isAIRes.status === "fulfilled" ? (isAIRes.value as boolean) : undefined;
        const handle = handleRes.status === "fulfilled" ? (handleRes.value as string) : "";

        return { isCreator, payout, isAI, handle, owner, isOwner };
      } catch (e) {
        return { isCreator: false, payout: undefined, isAI: undefined, handle: "", owner: undefined, isOwner: false };
      }
    },
  });

  const [payout, setPayout] = useState<string>("");
  const [handle, setHandle] = useState<string>("");
  const [aiFlag, setAiFlag] = useState<boolean>(false);

  // Tier creation form state (ETH default)
  const [tierPriceEth, setTierPriceEth] = useState<string>("");
  const [tierDurationDays, setTierDurationDays] = useState<string>("30");
  const [tierMeta, setTierMeta] = useState<string>("");
  const [useOracle, setUseOracle] = useState<boolean>(false);
  const [usdPrice, setUsdPrice] = useState<string>(""); // e.g., 9.99
  const [tokenDecimals, setTokenDecimals] = useState<string>("18"); // ETH default

  // Owner: register arbitrary address state
  const [ownerRegCreator, setOwnerRegCreator] = useState<string>("");
  const [ownerRegPayout, setOwnerRegPayout] = useState<string>("");

  useEffect(() => {
    if (creatorInfo) {
      setPayout(creatorInfo.payout && creatorInfo.payout !== ZERO_ADDRESS ? creatorInfo.payout : "");
      setHandle(creatorInfo.handle || "");
      setAiFlag(Boolean(creatorInfo.isAI));
    }
  }, [creatorInfo]);

  const canWrite = useMemo(() => Boolean(address && CREATOR_REGISTRY_ADDRESS), [address]);

  // Helpers
  const toUsd1e8 = useCallback((v: string): bigint => {
    const s = (v || "").trim();
    if (!s) return 0n;
    const [w, fRaw = ""] = s.split(".");
    const f = (fRaw + "00000000").slice(0, 8);
    return BigInt(w || "0") * 100000000n + BigInt(f || "0");
  }, []);

  const doUpdatePayout = useCallback(async () => {
    if (!canWrite || !isAddressLike(payout)) {
      toast.error("Enter a valid payout address");
      return;
    }
    if (isWrongNetwork) {
      toast.error(`Wrong network. Please switch to ${activeChain.name} (chainId ${activeChain.id}).`);
      return;
    }
    try {
      const hash = await writeContractAsync({
        address: CREATOR_REGISTRY_ADDRESS as Address,
        abi: CreatorRegistryAbi,
        functionName: "setPayoutAddress",
        args: [payout as Address],
        account: address as Address,
        chain: activeChain,
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      toast.success("Payout address updated");
      refetch();
    } catch (e: any) {
      toast.error(e?.shortMessage || e?.message || "Failed to update payout");
    }
  }, [payout, canWrite, writeContractAsync, publicClient, address, refetch]);

  const doUpdateHandle = useCallback(async () => {
    if (!canWrite) return;
    if (isWrongNetwork) {
      toast.error(`Wrong network. Please switch to ${activeChain.name} (chainId ${activeChain.id}).`);
      return;
    }
    try {
      const hash = await writeContractAsync({
        address: CREATOR_REGISTRY_ADDRESS as Address,
        abi: CreatorRegistryAbi,
        functionName: "setDisplayHandle",
        args: [handle],
        account: address as Address,
        chain: activeChain,
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      toast.success("Display handle updated");
      refetch();
    } catch (e: any) {
      toast.error(e?.shortMessage || e?.message || "Failed to update handle");
    }
  }, [handle, canWrite, writeContractAsync, publicClient, address, refetch]);

  const doUpdateAI = useCallback(async () => {
    if (!canWrite) return;
    if (isWrongNetwork) {
      toast.error(`Wrong network. Please switch to ${activeChain.name} (chainId ${activeChain.id}).`);
      return;
    }
    try {
      const hash = await writeContractAsync({
        address: CREATOR_REGISTRY_ADDRESS as Address,
        abi: CreatorRegistryAbi,
        functionName: "setAI",
        args: [aiFlag],
        account: address as Address,
        chain: activeChain,
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      toast.success("AI flag updated");
      refetch();
    } catch (e: any) {
      toast.error(e?.shortMessage || e?.message || "Failed to update AI flag");
    }
  }, [aiFlag, canWrite, writeContractAsync, publicClient, address, refetch]);

  // Owner-only registration of the connected wallet
  const doOwnerRegisterSelf = useCallback(async () => {
    if (!address) return;
    if (!creatorInfo?.isOwner) return;
    const payoutAddr = (payout || address) as string;
    if (!isAddressLike(payoutAddr)) {
      toast.error("Enter a valid payout address");
      return;
    }
    if (isWrongNetwork) {
      toast.error(`Wrong network. Please switch to ${activeChain.name} (chainId ${activeChain.id}).`);
      return;
    }
    try {
      const hash = await writeContractAsync({
        address: CREATOR_REGISTRY_ADDRESS as Address,
        abi: CreatorRegistryAbi,
        functionName: "registerCreator",
        args: [address as Address, payoutAddr as Address],
        account: address as Address,
        chain: activeChain,
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      toast.success("Creator registered");
      refetch();
    } catch (e: any) {
      toast.error(e?.shortMessage || e?.message || "Failed to register");
    }
  }, [address, payout, creatorInfo?.isOwner, writeContractAsync, publicClient, refetch]);

  // Owner-only (server): register the connected wallet via server owner key
  const doOwnerRegisterSelfServer = useCallback(async () => {
    if (!address) return;
    if (!creatorInfo?.isOwner) return;
    const payoutAddr = (payout || address) as string;
    if (!isAddressLike(payoutAddr)) {
      toast.error("Enter a valid payout address");
      return;
    }
    try {
      const base = import.meta.env.VITE_AUTH_BASE_URL || "http://localhost:3000";
      const resp = await fetch(`${base}/api/creator/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creator: address, payout: payoutAddr }),
        credentials: "include",
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || `Server register failed (${resp.status})`);
      toast.success("Registration submitted (server)", { description: data?.txHash });
      setTimeout(() => refetch(), 2500);
    } catch (e: any) {
      toast.error(e?.message || "Failed to register (server)");
    }
  }, [address, payout, creatorInfo?.isOwner, refetch]);

  // Owner-only: register an arbitrary address
  const doOwnerRegisterAddress = useCallback(async () => {
    if (!creatorInfo?.isOwner) return;
    const creatorAddr = ownerRegCreator.trim();
    const payoutAddr = (ownerRegPayout || ownerRegCreator).trim();
    if (!isAddressLike(creatorAddr)) {
      toast.error("Enter a valid creator address");
      return;
    }
    if (!isAddressLike(payoutAddr)) {
      toast.error("Enter a valid payout address");
      return;
    }
    if (isWrongNetwork) {
      toast.error(`Wrong network. Please switch to ${activeChain.name} (chainId ${activeChain.id}).`);
      return;
    }
    try {
      const hash = await writeContractAsync({
        address: CREATOR_REGISTRY_ADDRESS as Address,
        abi: CreatorRegistryAbi,
        functionName: "registerCreator",
        args: [creatorAddr as Address, payoutAddr as Address],
        account: address as Address,
        chain: activeChain,
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      toast.success("Creator registered", { description: creatorAddr });
      setOwnerRegCreator("");
      setOwnerRegPayout("");
      refetch();
    } catch (e: any) {
      toast.error(e?.shortMessage || e?.message || "Failed to register address");
    }
  }, [creatorInfo?.isOwner, ownerRegCreator, ownerRegPayout, writeContractAsync, publicClient, address, refetch]);

  // Owner-only (server): register an arbitrary address via server owner key
  const doOwnerRegisterAddressServer = useCallback(async () => {
    if (!creatorInfo?.isOwner) return;
    const creatorAddr = ownerRegCreator.trim();
    const payoutAddr = (ownerRegPayout || ownerRegCreator).trim();
    if (!isAddressLike(creatorAddr)) {
      toast.error("Enter a valid creator address");
      return;
    }
    if (!isAddressLike(payoutAddr)) {
      toast.error("Enter a valid payout address");
      return;
    }
    try {
      const base = import.meta.env.VITE_AUTH_BASE_URL || "http://localhost:3000";
      const resp = await fetch(`${base}/api/creator/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creator: creatorAddr, payout: payoutAddr }),
        credentials: "include",
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || `Server register failed (${resp.status})`);
      toast.success("Creator registered (server)", { description: data?.txHash });
      setOwnerRegCreator("");
      setOwnerRegPayout("");
      setTimeout(() => refetch(), 2500);
    } catch (e: any) {
      toast.error(e?.message || "Failed to register address (server)");
    }
  }, [creatorInfo?.isOwner, ownerRegCreator, ownerRegPayout, refetch]);

  const devRegister = useCallback(async () => {
    if (!address) return;
    try {
      const base = import.meta.env.VITE_AUTH_BASE_URL || "http://localhost:3000";
      const seedKey = (import.meta.env as any).VITE_DEV_SEED_KEY as string | undefined;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (seedKey) headers["x-dev-seed-key"] = seedKey;
      const resp = await fetch(`${base}/api/dev/seed/register-creator`, {
        method: "POST",
        headers,
        body: JSON.stringify({ creator: address, payout: address }),
        credentials: "include",
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const msg =
          data?.error ||
          (resp.status === 403
            ? "Dev seeding disabled or missing x-dev-seed-key. Set DEV_SEED_ENABLE=true on server and configure VITE_DEV_SEED_KEY in frontend."
            : `Registration failed (${resp.status})`);
        throw new Error(msg);
      }
      toast.success("Registration tx submitted", { description: data?.txHash });
      // Wait a bit then refetch status
      setTimeout(() => refetch(), 2500);
    } catch (e: any) {
      toast.error(e?.message || "Dev registration failed");
    }
  }, [address, refetch]);

  // --- Tiers data ---
  const tiersEnabled = Boolean(publicClient && address && SUBSCRIPTION_MANAGER_ADDRESS);
  const { data: tiersData, refetch: refetchTiers, isFetching: isFetchingTiers } = useQuery({
    queryKey: ["creator-tiers", address, SUBSCRIPTION_MANAGER_ADDRESS],
    enabled: tiersEnabled,
    queryFn: async (): Promise<
      | Array<{
          id: number;
          price: bigint;
          duration: bigint;
          metadataURI: string;
          active: boolean;
          paymentToken: Address;
          deleted: boolean;
          usesOracle: boolean;
        }>
      | null
    > => {
      if (!publicClient || !address || !SUBSCRIPTION_MANAGER_ADDRESS) return null;
      const len = (await publicClient.readContract({
        address: SUBSCRIPTION_MANAGER_ADDRESS as Address,
        abi: SubscriptionManagerAbi,
        functionName: "tiersLength",
        args: [address as Address],
      })) as bigint;
      const n = Number(len);
      if (!Number.isFinite(n) || n <= 0) return [];
      const idxs = Array.from({ length: n }, (_, i) => i);
      const raw = await Promise.all(
        idxs.map(async (i) => {
          const [tuple, usesOracle] = await Promise.all([
            publicClient.readContract({
              address: SUBSCRIPTION_MANAGER_ADDRESS as Address,
              abi: SubscriptionManagerAbi,
              functionName: "tiers",
              args: [address as Address, BigInt(i)],
            }) as Promise<{ price: bigint; duration: bigint; metadataURI: string; active: boolean; paymentToken: Address; deleted: boolean }>,
            publicClient.readContract({
              address: SUBSCRIPTION_MANAGER_ADDRESS as Address,
              abi: SubscriptionManagerAbi,
              functionName: "tierUsesOracle",
              args: [address as Address, BigInt(i)],
            }) as Promise<boolean>,
          ]);
          return { id: i, usesOracle, ...tuple };
        })
      );
      return raw;
    },
  });

  const hasTierWrite = useMemo(() => Boolean(address && SUBSCRIPTION_MANAGER_ADDRESS), [address]);

  const doCreateTier = useCallback(async () => {
    if (!hasTierWrite) return;
    if (isWrongNetwork) {
      toast.error(`Wrong network. Please switch to ${activeChain.name} (chainId ${activeChain.id}).`);
      return;
    }
    try {
      if (!tierDurationDays || (!useOracle && !tierPriceEth) || (useOracle && !usdPrice)) {
        toast.error("Fill in required fields");
        return;
      }
      const durationSec = BigInt(Math.floor(Number(tierDurationDays) * 86400));
      if (durationSec <= 0) {
        toast.error("Duration must be > 0 days");
        return;
      }
      let hash: Address | `0x${string}` | undefined;
      if (useOracle) {
        const usdScaled = toUsd1e8(usdPrice);
        if (usdScaled <= 0n) {
          toast.error("USD price must be > 0");
          return;
        }
        const decimalsNum = Number(tokenDecimals) || 18;
        hash = await writeContractAsync({
          address: SUBSCRIPTION_MANAGER_ADDRESS as Address,
          abi: SubscriptionManagerAbi,
          functionName: "createTierOracle",
          args: [usdScaled, durationSec, tierMeta, ZERO_ADDRESS, ZERO_ADDRESS, decimalsNum],
          account: address as Address,
          chain: activeChain,
          value: 0n,
        });
      } else {
        const priceWei = parseEther(tierPriceEth || "0");
        if (priceWei <= 0n) {
          toast.error("Price must be > 0");
          return;
        }
        hash = await writeContractAsync({
          address: SUBSCRIPTION_MANAGER_ADDRESS as Address,
          abi: SubscriptionManagerAbi,
          functionName: "createTier",
          args: [priceWei, durationSec, tierMeta, ZERO_ADDRESS],
          account: address as Address,
          chain: activeChain,
          value: 0n,
        });
      }
      if (publicClient && hash) await publicClient.waitForTransactionReceipt({ hash });
      toast.success("Tier created");
      setTierPriceEth("");
      setUsdPrice("");
      setTierMeta("");
      refetchTiers();
    } catch (e: any) {
      toast.error(e?.shortMessage || e?.message || "Failed to create tier");
    }
  }, [hasTierWrite, useOracle, tierPriceEth, usdPrice, tierMeta, tokenDecimals, tierDurationDays, writeContractAsync, publicClient, address, toUsd1e8, refetchTiers]);

  const doToggleActive = useCallback(
    async (tierId: number, active: boolean) => {
      if (!hasTierWrite) return;
      if (isWrongNetwork) {
        toast.error(`Wrong network. Please switch to ${activeChain.name} (chainId ${activeChain.id}).`);
        return;
      }
      try {
        const hash = await writeContractAsync({
          address: SUBSCRIPTION_MANAGER_ADDRESS as Address,
          abi: SubscriptionManagerAbi,
          functionName: "setTierActive",
          args: [BigInt(tierId), active],
          account: address as Address,
          chain: activeChain,
        });
        if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
        toast.success(active ? "Tier activated" : "Tier deactivated");
        refetchTiers();
      } catch (e: any) {
        toast.error(e?.shortMessage || e?.message || "Failed to update tier status");
      }
    },
    [hasTierWrite, writeContractAsync, publicClient, address, refetchTiers]
  );

  const doDeleteTier = useCallback(
    async (tierId: number) => {
      if (!hasTierWrite) return;
      if (isWrongNetwork) {
        toast.error(`Wrong network. Please switch to ${activeChain.name} (chainId ${activeChain.id}).`);
        return;
      }
      try {
        const hash = await writeContractAsync({
          address: SUBSCRIPTION_MANAGER_ADDRESS as Address,
          abi: SubscriptionManagerAbi,
          functionName: "deleteTier",
          args: [BigInt(tierId)],
          account: address as Address,
          chain: activeChain,
        });
        if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
        toast.success("Tier deleted");
        refetchTiers();
      } catch (e: any) {
        toast.error(e?.shortMessage || e?.message || "Failed to delete tier");
      }
    },
    [hasTierWrite, writeContractAsync, publicClient, address, refetchTiers]
  );

  if (!CREATOR_REGISTRY_ADDRESS) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Creator</CardTitle>
          <CardDescription>Configure your on-chain creator metadata</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">CreatorRegistry address is not configured. Set VITE_CREATOR_REGISTRY_ADDRESS in your environment.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Creator status</CardTitle>
          <CardDescription>Manage your creator registration and metadata</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Connected wallet</span>
              <span className="font-mono text-xs">{address || "Not connected"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Creator registered</span>
              <span className="font-medium">{creatorInfo?.isCreator ? "Yes" : "No"}</span>
            </div>
          </div>

          {!creatorInfo?.isCreator ? (
            <div className="space-y-3">
              {creatorInfo?.isOwner ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    You are the contract owner. Register this connected wallet as a creator.
                  </p>
                  <div className="grid gap-2">
                    <Label htmlFor="ownerPayout">Payout address</Label>
                    <div className="flex gap-2">
                      <Input id="ownerPayout" placeholder="0x..." value={payout || (address || "")} onChange={(e) => setPayout(e.target.value)} />
                      <Button onClick={doOwnerRegisterSelf} disabled={isPending}>Register (wallet)</Button>
                      <Button variant="secondary" onClick={doOwnerRegisterSelfServer}>Register (server)</Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Defaults to your connected wallet if left unchanged.</p>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Registration is owner-only on-chain. For local/dev, you can request registration via the dev seeding endpoint.
                  </p>
                  <Button variant="hero" disabled={!address} onClick={devRegister}>
                    Request dev registration
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-2">
                <Label htmlFor="payout">Payout address</Label>
                <div className="flex gap-2">
                  <Input id="payout" placeholder="0x..." value={payout} onChange={(e) => setPayout(e.target.value)} />
                  <Button onClick={doUpdatePayout} disabled={isPending}>Update</Button>
                </div>
                <p className="text-xs text-muted-foreground">Funds from subscriptions will be sent to this address.</p>
              </div>

              <Separator />

              <div className="grid gap-2">
                <Label htmlFor="handle">Display handle</Label>
                <div className="flex gap-2">
                  <Input id="handle" placeholder="e.g. @alice" value={handle} onChange={(e) => setHandle(e.target.value)} />
                  <Button onClick={doUpdateHandle} disabled={isPending}>Save</Button>
                </div>
                <p className="text-xs text-muted-foreground">Shown to fans in UI. Can be changed anytime.</p>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="grid gap-1">
                  <Label>AI Creator</Label>
                  <p className="text-xs text-muted-foreground">Mark this creator as AI-generated.</p>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={aiFlag} onCheckedChange={setAiFlag} />
                  <Button variant="secondary" onClick={doUpdateAI} disabled={isPending}>Apply</Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {creatorInfo?.isOwner && (
        <Card>
          <CardHeader>
            <CardTitle>Owner actions</CardTitle>
            <CardDescription>Register any address as a creator</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="ownerRegCreator">Creator address</Label>
              <Input
                id="ownerRegCreator"
                placeholder="0x..."
                value={ownerRegCreator}
                onChange={(e) => setOwnerRegCreator(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ownerRegPayout">Payout address</Label>
              <Input
                id="ownerRegPayout"
                placeholder="0x... (defaults to creator)"
                value={ownerRegPayout}
                onChange={(e) => setOwnerRegPayout(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">If empty, payout defaults to the creator address.</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <Button onClick={doOwnerRegisterAddress} disabled={isPending}>
                Register (wallet)
              </Button>
              <Button variant="secondary" onClick={doOwnerRegisterAddressServer}>
                Register (server)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {creatorInfo?.isCreator && (
        <Card>
          <CardHeader>
            <CardTitle>Subscription tiers</CardTitle>
            <CardDescription>Create and manage your tiers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!SUBSCRIPTION_MANAGER_ADDRESS ? (
              <p className="text-sm text-muted-foreground">SubscriptionManager address is not configured. Set VITE_SUBSCRIPTION_MANAGER_ADDRESS.</p>
            ) : (
              <>
                <div className="grid gap-2">
                  <Label>Create new tier</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {!useOracle ? (
                      <>
                        <div className="grid gap-1">
                          <Label htmlFor="tierPriceEth">Price (ETH)</Label>
                          <Input id="tierPriceEth" placeholder="0.01" value={tierPriceEth} onChange={(e) => setTierPriceEth(e.target.value)} />
                        </div>
                        <div className="grid gap-1">
                          <Label htmlFor="tierDurationDays">Duration (days)</Label>
                          <Input id="tierDurationDays" placeholder="30" value={tierDurationDays} onChange={(e) => setTierDurationDays(e.target.value)} />
                        </div>
                        <div className="grid gap-1 sm:col-span-2">
                          <Label htmlFor="tierMeta">Metadata URI</Label>
                          <Input id="tierMeta" placeholder="ipfs://... or https://..." value={tierMeta} onChange={(e) => setTierMeta(e.target.value)} />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="grid gap-1">
                          <Label htmlFor="usdPrice">USD Price</Label>
                          <Input id="usdPrice" placeholder="9.99" value={usdPrice} onChange={(e) => setUsdPrice(e.target.value)} />
                        </div>
                        <div className="grid gap-1">
                          <Label htmlFor="tokenDecimals">Token decimals</Label>
                          <Input id="tokenDecimals" placeholder="18" value={tokenDecimals} onChange={(e) => setTokenDecimals(e.target.value)} />
                        </div>
                        <div className="grid gap-1">
                          <Label htmlFor="oracleDurationDays">Duration (days)</Label>
                          <Input id="oracleDurationDays" placeholder="30" value={tierDurationDays} onChange={(e) => setTierDurationDays(e.target.value)} />
                        </div>
                        <div className="grid gap-1">
                          <Label htmlFor="oracleMeta">Metadata URI</Label>
                          <Input id="oracleMeta" placeholder="ipfs://... or https://..." value={tierMeta} onChange={(e) => setTierMeta(e.target.value)} />
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch checked={useOracle} onCheckedChange={setUseOracle} id="oracleSwitch" />
                      <Label htmlFor="oracleSwitch">Oracle pricing (USD)</Label>
                    </div>
                    <Button onClick={doCreateTier} disabled={isPending || !hasTierWrite}>
                      Create tier
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-2">
                  <Label>Your tiers</Label>
                  {isFetchingTiers ? (
                    <p className="text-sm text-muted-foreground">Loading tiers…</p>
                  ) : !tiersData || tiersData.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tiers yet. Create your first tier above.</p>
                  ) : (
                    <div className="grid gap-3">
                      {tiersData.map((t) => (
                        <div key={t.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-md border p-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-medium">Tier #{t.id}</span>
                              {t.deleted && <span className="text-xs px-1 rounded bg-destructive/10 text-destructive">deleted</span>}
                              {!t.active && !t.deleted && <span className="text-xs px-1 rounded bg-muted">inactive</span>}
                              {t.usesOracle && <span className="text-xs px-1 rounded bg-indigo-100 text-indigo-700">oracle</span>}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {t.metadataURI || "(no metadata)"}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="secondary" size="sm" onClick={() => doToggleActive(t.id, !t.active)} disabled={isPending || t.deleted}>
                              {t.active ? "Deactivate" : "Activate"}
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => doDeleteTier(t.id)} disabled={isPending || t.deleted}>
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
