// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {SubscriptionManager} from "../src/SubscriptionManager.sol";
import {OracleConfigurator} from "../src/OracleConfigurator.sol";

contract UpdateTierOracle is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address subsAddr = vm.envAddress("SUBSCRIPTION_MANAGER");
        address configAddr = vm.envAddress("ORACLE_CONFIGURATOR");
        address creator = vm.envAddress("CREATOR");
        uint256 tierId = vm.envUint("TIER_ID");
        uint256 usdPrice = vm.envUint("USD_PRICE");
        // Optional override oracle + decimals; if ORACLE is zero, use default registry
        address oracle = vm.envOr("ORACLE", address(0));
        uint256 tokenDecimals = vm.envOr("TOKEN_DECIMALS", uint256(0));

        vm.startBroadcast(pk);
        // Wire configurator for tier oracle updates
        SubscriptionManager subs = SubscriptionManager(payable(subsAddr));
        OracleConfigurator config = OracleConfigurator(configAddr);
        // creator-facing call via configurator: oracle=0 => use default; tokenDecimals=0 => use default
        vm.prank(creator);
        config.setTierOracleConfig(tierId, oracle, uint8(tokenDecimals), usdPrice);
        vm.stopBroadcast();
    }
}
