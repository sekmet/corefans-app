// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {CreatorRegistry} from "../src/CreatorRegistry.sol";
import {SubscriptionManager} from "../src/SubscriptionManager.sol";
import {SubscribeWithMax} from "../src/SubscribeWithMax.sol";
import {ICreatorRegistry} from "../src/interfaces/ICreatorRegistry.sol";

// Basic deploy script that only deploys the core contracts:
// - CreatorRegistry
// - SubscriptionManager
// No AccessPass, Marketplace, or sample collections.
contract DeployBasic is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address owner = vm.addr(pk);
        address platformTreasury = vm.envOr("PLATFORM_TREASURY", owner);
        uint256 platformFeeBps = vm.envOr("PLATFORM_FEE_BPS", uint256(200));

        // Fund the deployer on local Anvil to avoid insufficient funds during broadcast
        if (block.chainid == 31337 && owner.balance < 10 ether) {
            vm.deal(owner, 100 ether);
        }

        vm.startBroadcast(pk);

        CreatorRegistry registry = new CreatorRegistry(owner);
        SubscriptionManager subs = new SubscriptionManager(
            owner,
            ICreatorRegistry(address(registry)),
            platformTreasury,
            uint96(platformFeeBps)
        );

        // Wire SubscribeWithMax extension
        SubscribeWithMax ext = new SubscribeWithMax(subs);
        subs.setSubscribeExtension(address(ext));

        vm.stopBroadcast();

        // Optionally: log deployed addresses (uncomment if needed)
        // console2.log("CreatorRegistry:", address(registry));
        // console2.log("SubscriptionManager:", address(subs));
    }
}
