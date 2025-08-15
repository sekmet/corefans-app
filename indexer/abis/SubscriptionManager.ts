// Minimal ABI for events used by the indexer
// Keep this in sync with contracts/src/SubscriptionManager.sol
import type { Abi } from "viem";

export const SubscriptionManagerAbi: Abi = [
  {
    type: "event",
    name: "Subscribed",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "tierId", type: "uint256", indexed: true },
      { name: "expiresAt", type: "uint64", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "paymentToken", type: "address", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TierCreated",
    inputs: [
      { name: "creator", type: "address", indexed: true },
      { name: "tierId", type: "uint256", indexed: true },
      { name: "price", type: "uint256", indexed: false },
      { name: "duration", type: "uint64", indexed: false },
      { name: "metadataURI", type: "string", indexed: false },
      { name: "paymentToken", type: "address", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TierDeleted",
    inputs: [
      { name: "creator", type: "address", indexed: true },
      { name: "tierId", type: "uint256", indexed: true },
    ],
  },
  {
    type: "event",
    name: "CreatorGracePeriodUpdated",
    inputs: [
      { name: "creator", type: "address", indexed: true },
      { name: "graceSeconds", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "CreatorRenewalModeUpdated",
    inputs: [
      { name: "creator", type: "address", indexed: true },
      // enum RenewalMode { Extend, Reset } -> uint8
      { name: "mode", type: "uint8", indexed: false },
    ],
  },
  {
    type: "event",
    name: "CreatorWithdrawn",
    inputs: [
      { name: "creator", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PlatformWithdrawn",
    inputs: [
      { name: "treasury", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TierOracleUpdated",
    inputs: [
      { name: "creator", type: "address", indexed: true },
      { name: "tierId", type: "uint256", indexed: true },
      { name: "oracle", type: "address", indexed: false },
      { name: "tokenDecimals", type: "uint8", indexed: false },
      { name: "usdPrice", type: "uint256", indexed: false },
    ],
  },
] as const;
