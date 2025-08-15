import { makePublicClient } from "./client";
import { requireAddresses, SUBSCRIPTION_MANAGER_ADDRESS, ACCESS_PASS_ADDRESS, CREATOR_REGISTRY_ADDRESS } from "./config";
import { SubscriptionManagerAbi } from "./abis/SubscriptionManager";
import { AccessPassAbi } from "./abis/AccessPass";
import { CreatorRegistryAbi } from "./abis/CreatorRegistry";

async function main() {
  requireAddresses();
  const client = makePublicClient();

  const unsubs: Array<() => void> = [];

  // SubscriptionManager: watch all events defined in ABI
  unsubs.push(
    client.watchContractEvent({
      address: SUBSCRIPTION_MANAGER_ADDRESS!,
      abi: SubscriptionManagerAbi,
      pollingInterval: 5_000,
      onLogs: (logs) => {
        for (const log of logs) {
          console.log("[SubscriptionManager]", {
            address: log.address,
            blockNumber: log.blockNumber?.toString(),
            txHash: log.transactionHash,
            logIndex: log.logIndex,
            topics: log.topics,
          });
          // TODO: decode via viem.decodeEventLog({ abi, data: log.data, topics: log.topics }) and persist
        }
      },
      onError: (err) => console.error("watch error (SubscriptionManager)", err),
    })
  );

  // AccessPass: watch events
  unsubs.push(
    client.watchContractEvent({
      address: ACCESS_PASS_ADDRESS!,
      abi: AccessPassAbi,
      pollingInterval: 5_000,
      onLogs: (logs) => {
        for (const log of logs) {
          console.log("[AccessPass]", {
            address: log.address,
            blockNumber: log.blockNumber?.toString(),
            txHash: log.transactionHash,
            logIndex: log.logIndex,
            topics: log.topics,
          });
          // TODO: decode & persist (pass expiry cache)
        }
      },
      onError: (err) => console.error("watch error (AccessPass)", err),
    })
  );

  // CreatorRegistry: watch events
  unsubs.push(
    client.watchContractEvent({
      address: CREATOR_REGISTRY_ADDRESS!,
      abi: CreatorRegistryAbi,
      pollingInterval: 5_000,
      onLogs: (logs) => {
        for (const log of logs) {
          console.log("[CreatorRegistry]", {
            address: log.address,
            blockNumber: log.blockNumber?.toString(),
            txHash: log.transactionHash,
            logIndex: log.logIndex,
            topics: log.topics,
          });
          // TODO: decode & persist (creators, operators)
        }
      },
      onError: (err) => console.error("watch error (CreatorRegistry)", err),
    })
  );

  console.log("[indexer] watching events...");

  const shutdown = () => {
    console.log("[indexer] shutting down...");
    for (const un of unsubs) {
      try { un(); } catch {}
    }
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[indexer] fatal", err);
  process.exit(1);
});
