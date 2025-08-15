import { createPublicClient, http, PublicClient } from "viem";
import { RPC_URL } from "./config";

export function makePublicClient(): PublicClient {
  return createPublicClient({
    transport: http(RPC_URL, { batch: true }),
  });
}
