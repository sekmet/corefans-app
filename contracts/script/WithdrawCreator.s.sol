// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {Treasury} from "../src/Treasury.sol";

contract WithdrawCreator is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address treAddr = vm.envAddress("TREASURY");
        address token = vm.envOr("TOKEN", address(0)); // address(0) for ETH
        address dst = vm.envOr("DST", address(0));    // if zero -> payout

        vm.startBroadcast(pk);
        Treasury tre = Treasury(payable(treAddr));
        if (dst == address(0)) {
            tre.withdrawCreatorToPayout(token);
        } else {
            tre.withdrawCreatorTo(token, dst);
        }
        vm.stopBroadcast();
    }
}
