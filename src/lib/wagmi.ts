import { createConfig } from "@wagmi/core";
import { http, type Chain } from "viem";
import { coreTestnet2 as coreTestnet2Chain } from 'viem/chains';
import { defineChain } from "viem";
import { injected } from "@wagmi/connectors";

// Re-export chain so app code can import the id, etc.
export const coreTestnet2 = coreTestnet2Chain;

// Prefer env-provided chain for local Anvil or custom RPC
const envChainId = Number(import.meta.env.VITE_CHAIN_ID || 0);
const envRpcUrl = (import.meta.env.VITE_CHAIN_RPC_URL || "").toString();

let selectedChain: Chain = coreTestnet2;
if (envChainId === 31337) {
  const anvilUrl = envRpcUrl || "http://127.0.0.1:8545";
  selectedChain = defineChain({
    id: 31337,
    name: "Anvil 31337",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: [anvilUrl] },
      public: { http: [anvilUrl] },
    },
  });
} else if (envChainId && envRpcUrl) {
  selectedChain = defineChain({
    id: envChainId,
    name: `Custom ${envChainId}`,
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: [envRpcUrl] },
      public: { http: [envRpcUrl] },
    },
  });
}

export const wagmiConfig = createConfig({
  chains: [selectedChain],
  transports: {
    [selectedChain.id]: http(),
  },
  connectors: [injected()],
});

export const activeChain = selectedChain;
