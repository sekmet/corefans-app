export function env(key: string, fallback?: string): string {
  const v = process.env[key] ?? fallback;
  if (v === undefined) throw new Error(`Missing env: ${key}`);
  return v;
}

export const CHAIN_ID = Number(process.env.CHAIN_ID ?? 1114);
export const RPC_URL = process.env.CHAIN_RPC_URL ?? "https://rpc.test2.btcs.network";

export const SUBSCRIPTION_MANAGER_ADDRESS = process.env.SUBSCRIPTION_MANAGER_ADDRESS as `0x${string}` | undefined;
export const ACCESS_PASS_ADDRESS = process.env.ACCESS_PASS_ADDRESS as `0x${string}` | undefined;
export const CREATOR_REGISTRY_ADDRESS = process.env.CREATOR_REGISTRY_ADDRESS as `0x${string}` | undefined;

export const INDEXER_START_BLOCK = process.env.INDEXER_START_BLOCK ? BigInt(process.env.INDEXER_START_BLOCK) : undefined;

export function requireAddresses() {
  const missing: string[] = [];
  if (!SUBSCRIPTION_MANAGER_ADDRESS) missing.push("SUBSCRIPTION_MANAGER_ADDRESS");
  if (!ACCESS_PASS_ADDRESS) missing.push("ACCESS_PASS_ADDRESS");
  if (!CREATOR_REGISTRY_ADDRESS) missing.push("CREATOR_REGISTRY_ADDRESS");
  if (missing.length) throw new Error(`Missing contract envs: ${missing.join(", ")}`);
}
