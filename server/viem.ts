import { createPublicClient, http, defineChain, createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const CHAIN_ID = Number(process.env.CHAIN_ID || process.env.VITE_CHAIN_ID || 1114);
const RPC_URL = process.env.CHAIN_RPC_URL || process.env.VITE_CHAIN_RPC_URL || "https://rpc.test2.btcs.network";

// Minimal chain definition for server-side viem client
export const serverChain = defineChain({
  id: CHAIN_ID,
  name: `Chain-${CHAIN_ID}`,
  nativeCurrency: { name: "Native", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
    public: { http: [RPC_URL] },
  },
});

export const publicClient = createPublicClient({
  chain: serverChain,
  transport: http(RPC_URL),
  batch: { multicall: true },
});

// Create a wallet client for signing txs (dev/anvil seeding)
export function getWalletClient(privateKey: string) {
  const pk = privateKey.startsWith("0x") ? privateKey : ("0x" + privateKey);
  const account = privateKeyToAccount(pk as `0x${string}`);
  return createWalletClient({
    chain: serverChain,
    transport: http(RPC_URL),
    account,
  });
}
