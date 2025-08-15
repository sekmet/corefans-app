import type { Address } from "viem";

export type TokenInfo = {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  isNative: boolean;
};

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

const ETH_NATIVE: TokenInfo = {
  address: ZERO_ADDRESS,
  symbol: "ETH",
  name: "Ether",
  decimals: 18,
  isNative: true,
};

// Minimal placeholder token lists for dev/test. Replace ERC20 addresses per environment.
const TOKENS_BY_CHAIN: Record<number, TokenInfo[]> = {
  // Anvil (local)
  31337: [
    ETH_NATIVE,
    { address: "0x0000000000000000000000000000000000000001" as Address, symbol: "USDT", name: "Tether USD", decimals: 6, isNative: false },
    { address: "0x0000000000000000000000000000000000000002" as Address, symbol: "USDC", name: "USD Coin", decimals: 6, isNative: false },
  ],
  // Core Testnet2 (example)
  1114: [
    ETH_NATIVE,
    { address: "0x0000000000000000000000000000000000000001" as Address, symbol: "USDT", name: "Tether USD", decimals: 6, isNative: false },
    { address: "0x0000000000000000000000000000000000000002" as Address, symbol: "USDC", name: "USD Coin", decimals: 6, isNative: false },
  ],
};

export function getSupportedPaymentTokens(chainId: number): TokenInfo[] {
  return TOKENS_BY_CHAIN[chainId] ?? [ETH_NATIVE];
}
