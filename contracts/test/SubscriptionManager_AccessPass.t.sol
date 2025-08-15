// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {CreatorRegistry} from "../src/CreatorRegistry.sol";
import {SubscriptionManager} from "../src/SubscriptionManager.sol";
import {ICreatorRegistry} from "../src/interfaces/ICreatorRegistry.sol";
import {MockAccessPass} from "../src/mocks/MockAccessPass.sol";

contract SubscriptionManagerAccessPassTest is Test {
    CreatorRegistry reg;
    SubscriptionManager subs;
    MockAccessPass pass;

    address owner = address(0xA11CE);
    address creator = address(0xC0FFEE);
    address payout = address(0xBEEF);
    address user = address(0xCAFE);

    function setUp() public {
        reg = new CreatorRegistry(owner);
        vm.prank(owner);
        reg.registerCreator(creator, payout);
        subs = new SubscriptionManager(owner, ICreatorRegistry(address(reg)), owner, 200);
        pass = new MockAccessPass();
        vm.prank(owner);
        subs.setAccessPass(address(pass));
    }

    function testMintAndRenew() public {
        vm.prank(creator);
        uint256 tierId = subs.createTier(1 ether, 30 days, "tier://eth", address(0));

        vm.deal(user, 3 ether);
        vm.expectEmit(true, true, false, true);
        emit MockAccessPass.MintIfNone(user, creator);
        vm.expectEmit(true, true, false, true);
        emit MockAccessPass.UpdateOnRenew(user, creator, uint64(block.timestamp) + 30 days);
        vm.prank(user);
        subs.subscribe{value: 1 ether}(creator, tierId);

        // renew
        vm.warp(block.timestamp + 10 days);
        vm.expectEmit(true, true, false, true);
        emit MockAccessPass.UpdateOnRenew(user, creator, uint64(block.timestamp + 30 days + 20 days));
        vm.prank(user);
        subs.subscribe{value: 1 ether}(creator, tierId);
    }
}
