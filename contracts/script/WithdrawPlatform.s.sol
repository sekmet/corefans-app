// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {Treasury} from "../src/Treasury.sol";

contract WithdrawPlatform is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address treAddr = vm.envAddress("TREASURY");
        address token = vm.envOr("TOKEN", address(0)); // address(0) for ETH

        vm.startBroadcast(pk);
        Treasury tre = Treasury(treAddr);
        tre.withdrawPlatform(token);
        vm.stopBroadcast();
    }
}
