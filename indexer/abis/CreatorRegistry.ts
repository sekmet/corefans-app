// Minimal ABI for events used by the indexer
// Keep this in sync with contracts/src/CreatorRegistry.sol
import type { Abi } from "viem";

export const CreatorRegistryAbi: Abi = [
  {
    type: "event",
    name: "CreatorRegistered",
    inputs: [
      { name: "creator", type: "address", indexed: true },
      { name: "payout", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "CreatorEnabled",
    inputs: [
      { name: "creator", type: "address", indexed: true },
      { name: "payout", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "CreatorDisabled",
    inputs: [
      { name: "creator", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "PayoutUpdated",
    inputs: [
      { name: "creator", type: "address", indexed: true },
      { name: "payout", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "OperatorAdded",
    inputs: [
      { name: "creator", type: "address", indexed: true },
      { name: "operator", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "OperatorRemoved",
    inputs: [
      { name: "creator", type: "address", indexed: true },
      { name: "operator", type: "address", indexed: true },
    ],
  },
] as const;
