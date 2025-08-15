import type { Abi } from "viem";

// Frontend ABI for CreatorRegistry used by settings UI
// Keep in sync with contracts/src/CreatorRegistry.sol
export const CreatorRegistryAbi: Abi = [
  // Views
  {
    type: "function",
    stateMutability: "view",
    name: "isCreator",
    inputs: [{ name: "creator", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "getPayoutAddress",
    inputs: [{ name: "creator", type: "address" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "isAI",
    inputs: [{ name: "creator", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "displayHandle",
    inputs: [{ name: "creator", type: "address" }],
    outputs: [{ name: "", type: "string" }],
  },
  // Ownable view
  {
    type: "function",
    stateMutability: "view",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  // Mutations a creator can call
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "setPayoutAddress",
    inputs: [{ name: "payout", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "setAI",
    inputs: [{ name: "value", type: "bool" }],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "setDisplayHandle",
    inputs: [{ name: "handle", type: "string" }],
    outputs: [],
  },
  // Owner-only mutation
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "registerCreator",
    inputs: [
      { name: "creator", type: "address" },
      { name: "payout", type: "address" },
    ],
    outputs: [],
  },
] as const;
