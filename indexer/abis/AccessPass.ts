// Minimal ABI for events used by the indexer
// Keep this in sync with contracts/src/AccessPass.sol
import type { Abi } from "viem";

export const AccessPassAbi: Abi = [
  {
    type: "event",
    name: "PassMinted",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
  },
  {
    type: "event",
    name: "PassUpdated",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "newExpiry", type: "uint64", indexed: false },
    ],
  },
] as const;
