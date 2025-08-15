import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePublicClient, useAccount, useConnect, useWriteContract, useWaitForTransactionReceipt, useSignTypedData } from "wagmi";
import { type Address, decodeEventLog } from "viem";
import { SubscriptionManagerAbi } from "@/services/abis/SubscriptionManager";
import { SUBSCRIPTION_MANAGER_ADDRESS } from "@/config/contracts";
import { activeChain } from "@/lib/wagmi";
import { erc20Abi } from "@/services/abis/erc20";
import { accessPassAbi } from "@/services/abis/accessPass";
import { useEffect, useRef } from "react";

export type FrontendTier = {
  id: number;
  price: bigint;
  duration: number;
  metadataURI: string;
  paymentToken?: Address; // undefined or ZERO_ADDRESS means native ETH
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export function useCreatorEthTiers(creator: Address | undefined) {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ["creator-eth-tiers", creator, SUBSCRIPTION_MANAGER_ADDRESS],
    enabled: !!creator && !!publicClient && !!SUBSCRIPTION_MANAGER_ADDRESS,
    queryFn: async (): Promise<FrontendTier[]> => {
      if (!creator || !publicClient || !SUBSCRIPTION_MANAGER_ADDRESS) return [];

      const length = (await publicClient.readContract({
        address: SUBSCRIPTION_MANAGER_ADDRESS as Address,
        abi: SubscriptionManagerAbi,
        functionName: "tiersLength",
        args: [creator],
      })) as bigint;

      const total = Number(length);
      if (!Number.isFinite(total) || total <= 0) return [];

      const indices = Array.from({ length: total }, (_, i) => i);

      const tierResults = await Promise.all(
        indices.map(async (i) => {
          try {
            const t = (await publicClient.readContract({
              address: SUBSCRIPTION_MANAGER_ADDRESS as Address,
              abi: SubscriptionManagerAbi,
              functionName: "tiers",
              args: [creator, BigInt(i)],
            })) as unknown as {
              price: bigint;
              duration: bigint;
              metadataURI: string;
              active: boolean;
              paymentToken: Address;
              deleted: boolean;
            };

            const usesOracle = (await publicClient.readContract({
              address: SUBSCRIPTION_MANAGER_ADDRESS as Address,
              abi: SubscriptionManagerAbi,
              functionName: "tierUsesOracle",
              args: [creator, BigInt(i)],
            })) as boolean;

            if (!t.active || t.deleted) return null;
            if (t.paymentToken !== ZERO_ADDRESS) return null; // ETH-only
            if (usesOracle) return null; // skip oracle-priced for MVP

            return {
              id: i,
              price: t.price,
              duration: Number(t.duration),
              metadataURI: t.metadataURI,
              paymentToken: ZERO_ADDRESS as Address,
            } as FrontendTier;
          } catch {
            return null;
          }
        })
      );

      return tierResults.filter(Boolean) as FrontendTier[];
    },
  });
}

// Recent subscription history using on-chain logs (lightweight indexer)
export function useRecentSubscriptions(user?: Address, creator?: Address, lookbackBlocks = 100_000n) {
  const publicClient = usePublicClient();

  const enabled = Boolean(publicClient && SUBSCRIPTION_MANAGER_ADDRESS && (user || creator));

  return useQuery({
    queryKey: [
      "recent-subscriptions",
      user ?? "*",
      creator ?? "*",
      SUBSCRIPTION_MANAGER_ADDRESS,
      lookbackBlocks.toString(),
    ],
    enabled,
    queryFn: async (): Promise<Array<{
      txHash: `0x${string}`;
      blockNumber: bigint;
      user: Address;
      creator: Address;
      tierId: bigint;
      expiresAt: bigint;
      amount: bigint;
      paymentToken: Address;
    }>> => {
      if (!publicClient || !SUBSCRIPTION_MANAGER_ADDRESS) return [];
      const latest = await publicClient.getBlockNumber();
      const fromBlock = latest > lookbackBlocks ? latest - lookbackBlocks : 0n;

      const filterArgs: { user?: Address; creator?: Address } = {};
      if (user) filterArgs.user = user as Address;
      if (creator) filterArgs.creator = creator as Address;

      const subscribedEvent = SubscriptionManagerAbi.find(
        (x) => (x as any)?.type === "event" && (x as any)?.name === "Subscribed",
      ) as unknown as import("viem").AbiEvent;

      const logs = await publicClient.getLogs({
        address: SUBSCRIPTION_MANAGER_ADDRESS as Address,
        event: subscribedEvent,
        ...(Object.keys(filterArgs).length ? { args: filterArgs } : {}),
        fromBlock,
        toBlock: latest,
      });

      return logs.map((l) => {
        const decoded = decodeEventLog({
          abi: SubscriptionManagerAbi,
          eventName: "Subscribed",
          data: l.data,
          topics: (l as any).topics,
        }) as unknown as {
          args: {
            user: Address;
            creator: Address;
            tierId: bigint | number | string;
            expiresAt: bigint | number | string;
            amount: bigint | number | string;
            paymentToken: Address;
          };
        };
        const args = decoded.args;
        return {
          txHash: l.transactionHash!,
          blockNumber: l.blockNumber!,
          user: args.user,
          creator: args.creator,
          tierId: BigInt(args.tierId as any),
          expiresAt: BigInt(args.expiresAt as any),
          amount: BigInt(args.amount as any),
          paymentToken: args.paymentToken,
        };
      });
    },
  });
}

// Detects if a token likely supports EIP-2612 permit by probing `name()` and `nonces(owner)`
export function useTokenPermitSupport(token: Address | undefined) {
  const publicClient = usePublicClient();
  const { address } = useAccount();

  const enabled = Boolean(
    publicClient && token && (token as string).toLowerCase() !== ZERO_ADDRESS.toLowerCase() && address
  );

  return useQuery({
    queryKey: ["token-permit-support", token, address],
    enabled,
    queryFn: async (): Promise<boolean> => {
      if (!publicClient || !token || !address) return false;
      try {
        // Some non-EIP-2612 tokens may still implement name(); use nonces() as the key signal
        await publicClient.readContract({ address: token as Address, abi: erc20Abi, functionName: "name" });
        await publicClient.readContract({
          address: token as Address,
          abi: erc20Abi,
          functionName: "nonces",
          args: [address as Address],
        });
        return true;
      } catch {
        return false;
      }
    },
  });
}

// Preview the AccessPass tokenURI for the current user and creator after subscription
export function useAccessPassPreview(user: Address | undefined, creator: Address | undefined) {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ["access-pass-preview", user, creator, SUBSCRIPTION_MANAGER_ADDRESS],
    enabled: !!publicClient && !!user && !!creator && !!SUBSCRIPTION_MANAGER_ADDRESS,
    queryFn: async (): Promise<{ tokenId: bigint; tokenURI?: string; accessPass?: Address } | null> => {
      if (!publicClient || !user || !creator || !SUBSCRIPTION_MANAGER_ADDRESS) return null;
      const accessPass = (await publicClient.readContract({
        address: SUBSCRIPTION_MANAGER_ADDRESS as Address,
        abi: SubscriptionManagerAbi,
        functionName: "accessPass",
      })) as Address;
      if (!accessPass || accessPass.toLowerCase() === ZERO_ADDRESS.toLowerCase()) return { tokenId: 0n, tokenURI: undefined, accessPass };
      const tokenId = (await publicClient.readContract({ address: accessPass, abi: accessPassAbi, functionName: "tokenIdFor", args: [user as Address, creator as Address] })) as bigint;
      try {
        const tokenURI = (await publicClient.readContract({ address: accessPass, abi: accessPassAbi, functionName: "tokenURI", args: [tokenId] })) as string;
        return { tokenId, tokenURI, accessPass };
      } catch {
        return { tokenId, tokenURI: undefined, accessPass };
      }
    },
  });
}

export function useCreatorErc20Tiers(creator: Address | undefined) {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ["creator-erc20-tiers", creator, SUBSCRIPTION_MANAGER_ADDRESS],
    enabled: !!creator && !!publicClient && !!SUBSCRIPTION_MANAGER_ADDRESS,
    queryFn: async (): Promise<FrontendTier[]> => {
      if (!creator || !publicClient || !SUBSCRIPTION_MANAGER_ADDRESS) return [];

      const length = (await publicClient.readContract({
        address: SUBSCRIPTION_MANAGER_ADDRESS as Address,
        abi: SubscriptionManagerAbi,
        functionName: "tiersLength",
        args: [creator],
      })) as bigint;

      const total = Number(length);
      if (!Number.isFinite(total) || total <= 0) return [];

      const indices = Array.from({ length: total }, (_, i) => i);

      const tierResults = await Promise.all(
        indices.map(async (i) => {
          try {
            const t = (await publicClient.readContract({
              address: SUBSCRIPTION_MANAGER_ADDRESS as Address,
              abi: SubscriptionManagerAbi,
              functionName: "tiers",
              args: [creator, BigInt(i)],
            })) as unknown as {
              price: bigint;
              duration: bigint;
              metadataURI: string;
              active: boolean;
              paymentToken: Address;
              deleted: boolean;
            };

            const usesOracle = (await publicClient.readContract({
              address: SUBSCRIPTION_MANAGER_ADDRESS as Address,
              abi: SubscriptionManagerAbi,
              functionName: "tierUsesOracle",
              args: [creator, BigInt(i)],
            })) as boolean;

            if (!t.active || t.deleted) return null;
            if (t.paymentToken === ZERO_ADDRESS) return null; // ERC20-only in this hook
            if (usesOracle) return null; // skip oracle-priced for now

            return {
              id: i,
              price: t.price,
              duration: Number(t.duration),
              metadataURI: t.metadataURI,
              paymentToken: t.paymentToken,
            } as FrontendTier;
          } catch {
            return null;
          }
        })
      );

      return tierResults.filter(Boolean) as FrontendTier[];
    },
  });
}

export function useSubscribe() {
  const { address } = useAccount();
  const { connectors, connect, isPending: isConnectPending } = useConnect();
  const { writeContract, writeContractAsync, data: txHash, isPending: isWriting, error: writeError } = useWriteContract();
  const { data: receipt, isLoading: isWaiting } = useWaitForTransactionReceipt({ hash: txHash });
  const { signTypedDataAsync } = useSignTypedData();
  const queryClient = useQueryClient();
  const lastCreatorRef = useRef<Address | null>(null);
  const publicClient = usePublicClient();

  async function subscribe(creator: Address, tierId: number, valueWei: bigint, paymentToken?: Address) {
    if (!SUBSCRIPTION_MANAGER_ADDRESS) throw new Error("SubscriptionManager address is not configured");
    if (!address) throw new Error("Wallet not connected");
    lastCreatorRef.current = creator;
    // ETH path
    if (!paymentToken || paymentToken.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
      return writeContract({
        address: SUBSCRIPTION_MANAGER_ADDRESS as Address,
        abi: SubscriptionManagerAbi,
        functionName: "subscribe",
        args: [creator, BigInt(tierId)],
        value: valueWei,
        account: address,
        chain: activeChain,
      });
    }
    // ERC20 path: ensure allowance then call subscribe with no value
    let allowance: bigint = 0n;
    if (publicClient) {
      allowance = (await publicClient.readContract({
        address: paymentToken as Address,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, SUBSCRIPTION_MANAGER_ADDRESS as Address],
      })) as bigint;
    }

    if (allowance < valueWei) {
      const approveHash = await writeContractAsync({
        address: paymentToken as Address,
        abi: erc20Abi,
        functionName: "approve",
        args: [SUBSCRIPTION_MANAGER_ADDRESS as Address, valueWei],
        account: address,
        chain: activeChain,
      });
      // Wait for approval to be mined before subscribing
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }
    }

    return writeContract({
      address: SUBSCRIPTION_MANAGER_ADDRESS as Address,
      abi: SubscriptionManagerAbi,
      functionName: "subscribe",
      args: [creator, BigInt(tierId)],
      account: address,
      chain: activeChain,
    });
  }

  // Optional permit-based flow using EIP-2612
  async function subscribeWithPermit(
    creator: Address,
    tierId: number,
    valueWei: bigint,
    paymentToken: Address | undefined,
    opts?: { deadlineSeconds?: number }
  ) {
    if (!SUBSCRIPTION_MANAGER_ADDRESS) throw new Error("SubscriptionManager address is not configured");
    if (!address) throw new Error("Wallet not connected");
    lastCreatorRef.current = creator;
    // If ETH or no token provided, fallback to normal subscribe with value
    if (!paymentToken || paymentToken.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
      return writeContract({
        address: SUBSCRIPTION_MANAGER_ADDRESS as Address,
        abi: SubscriptionManagerAbi,
        functionName: "subscribe",
        args: [creator, BigInt(tierId)],
        value: valueWei,
        account: address,
        chain: activeChain,
      });
    }

    if (!publicClient) throw new Error("Public client unavailable");

    const [tokenName, nonce] = await Promise.all([
      publicClient.readContract({ address: paymentToken as Address, abi: erc20Abi, functionName: "name" }) as Promise<string>,
      publicClient.readContract({ address: paymentToken as Address, abi: erc20Abi, functionName: "nonces", args: [address] }) as Promise<bigint>,
    ]);

    const deadline = BigInt(Math.floor(Date.now() / 1000) + (opts?.deadlineSeconds ?? 1200));

    const domain = {
      name: tokenName,
      version: "1",
      chainId: activeChain.id,
      verifyingContract: paymentToken as Address,
    } as const;

    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    } as const;

    const message = {
      owner: address,
      spender: SUBSCRIPTION_MANAGER_ADDRESS as Address,
      value: valueWei,
      nonce,
      deadline,
    } as const;

    const signature = await signTypedDataAsync({
      account: address,
      domain,
      types,
      primaryType: "Permit",
      message,
    });

    const sig = signature.startsWith("0x") ? signature.slice(2) : signature;
    const r = ("0x" + sig.slice(0, 64)) as `0x${string}`;
    const s = ("0x" + sig.slice(64, 128)) as `0x${string}`;
    let v = parseInt(sig.slice(128, 130), 16);
    if (v < 27) v += 27;

    return writeContract({
      address: SUBSCRIPTION_MANAGER_ADDRESS as Address,
      abi: SubscriptionManagerAbi,
      functionName: "subscribeWithPermit",
      args: [creator, BigInt(tierId), valueWei, deadline, v, r, s],
      account: address,
      chain: activeChain,
    });
  }

  useEffect(() => {
    if (receipt && lastCreatorRef.current && address) {
      queryClient.invalidateQueries({
        queryKey: ["subscription-status", address, lastCreatorRef.current, SUBSCRIPTION_MANAGER_ADDRESS],
        exact: false,
      });
    }
  }, [receipt, address, queryClient]);

  return {
    address,
    connectors,
    connect,
    isConnectPending,
    subscribe,
    subscribeWithPermit,
    txHash,
    receipt,
    isWriting,
    isWaiting,
    writeError,
  } as const;
}

export function useSubscriptionStatus(user: Address | undefined, creator: Address | undefined) {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ["subscription-status", user, creator, SUBSCRIPTION_MANAGER_ADDRESS],
    enabled: !!user && !!creator && !!publicClient && !!SUBSCRIPTION_MANAGER_ADDRESS,
    queryFn: async (): Promise<{ expiry: bigint; active: boolean }> => {
      if (!user || !creator || !publicClient || !SUBSCRIPTION_MANAGER_ADDRESS) {
        return { expiry: 0n, active: false };
      }

      const expiry = (await publicClient.readContract({
        address: SUBSCRIPTION_MANAGER_ADDRESS as Address,
        abi: SubscriptionManagerAbi,
        functionName: "subscriptionExpiry",
        args: [user, creator],
      })) as bigint;

      const nowSec = BigInt(Math.floor(Date.now() / 1000));
      return { expiry, active: expiry > nowSec };
    },
  });
}

export function useTokenInfo(token: Address | undefined) {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ["token-info", token],
    enabled: !!publicClient && !!token,
    queryFn: async (): Promise<{ symbol: string; decimals: number; isNative: boolean }> => {
      if (!publicClient || !token) return { symbol: "ETH", decimals: 18, isNative: true };
      if (token.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
        return { symbol: "ETH", decimals: 18, isNative: true };
      }
      const [symbol, decimals] = await Promise.all([
        publicClient.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }) as Promise<string>,
        publicClient.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }) as Promise<number>,
      ]);
      return { symbol, decimals, isNative: false };
    },
  });
}

export function usePlatformFeeBps() {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ["platform-fee-bps", SUBSCRIPTION_MANAGER_ADDRESS],
    enabled: !!publicClient && !!SUBSCRIPTION_MANAGER_ADDRESS,
    queryFn: async (): Promise<number> => {
      if (!publicClient || !SUBSCRIPTION_MANAGER_ADDRESS) return 0;
      const bps = (await publicClient.readContract({
        address: SUBSCRIPTION_MANAGER_ADDRESS as Address,
        abi: SubscriptionManagerAbi,
        functionName: "platformFeeBps",
      })) as bigint;
      return Number(bps);
    },
  });
}

export function useEstimateSubscribe(params: { creator?: Address; tierId?: number; amountWei?: bigint; paymentToken?: Address }) {
  const publicClient = usePublicClient();
  const { address } = useAccount();

  const enabled = Boolean(
    publicClient &&
    SUBSCRIPTION_MANAGER_ADDRESS &&
    params.creator &&
    typeof params.tierId === "number" &&
    params.amountWei !== undefined &&
    (params.amountWei as bigint) >= 0n
  );

  return useQuery({
    queryKey: [
      "estimate-subscribe",
      params.creator,
      params.tierId,
      params.amountWei !== undefined ? params.amountWei.toString() : "0",
      params.paymentToken ?? ZERO_ADDRESS,
      SUBSCRIPTION_MANAGER_ADDRESS,
      address,
    ],
    enabled,
    queryFn: async (): Promise<{ gas: bigint; gasPrice: bigint; feeWei: bigint; approvalNeeded: boolean }> => {
      if (!publicClient || !params.creator || params.tierId === undefined || params.amountWei === undefined) {
        return { gas: 0n, gasPrice: 0n, feeWei: 0n, approvalNeeded: false };
      }
      const isEth = !params.paymentToken || (params.paymentToken?.toLowerCase?.() === ZERO_ADDRESS.toLowerCase());
      let gas: bigint = 0n;
      if (isEth) {
        gas = await publicClient.estimateContractGas({
          address: SUBSCRIPTION_MANAGER_ADDRESS as Address,
          abi: SubscriptionManagerAbi,
          functionName: "subscribe",
          args: [params.creator as Address, BigInt(params.tierId as number)],
          account: address,
          value: params.amountWei as bigint,
        });
      } else {
        gas = await publicClient.estimateContractGas({
          address: SUBSCRIPTION_MANAGER_ADDRESS as Address,
          abi: SubscriptionManagerAbi,
          functionName: "subscribe",
          args: [params.creator as Address, BigInt(params.tierId as number)],
          account: address,
        });
      }

      const gasPrice = await publicClient.getGasPrice();
      const feeWei = gas * gasPrice;
      let approvalNeeded = false;
      if (!isEth && params.paymentToken) {
        const allowance = (await publicClient.readContract({
          address: params.paymentToken as Address,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address as Address, SUBSCRIPTION_MANAGER_ADDRESS as Address],
        })) as bigint;
        approvalNeeded = allowance < (params.amountWei as bigint);
      }
      return { gas, gasPrice, feeWei, approvalNeeded };
    },
  });
}
