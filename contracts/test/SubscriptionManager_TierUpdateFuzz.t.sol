// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {CreatorRegistry} from "../src/CreatorRegistry.sol";
import {SubscriptionManager} from "../src/SubscriptionManager.sol";
import {ICreatorRegistry} from "../src/interfaces/ICreatorRegistry.sol";

contract SubscriptionManagerTierUpdateFuzzTest is Test {
    CreatorRegistry reg;
    SubscriptionManager subs;

    address owner = address(0xA11CE);
    address creator = address(0xC0FFEE);
    address payout = address(0xBEEF);
    address user = address(0xCAFE);

    function setUp() public {
        reg = new CreatorRegistry(owner);
        vm.prank(owner);
        reg.registerCreator(creator, payout);
        subs = new SubscriptionManager(owner, ICreatorRegistry(address(reg)), owner, 200);
    }

    // Fuzz updating price and duration while subscription is active.
    function testFuzz_UpdateTierWithActiveSubscription(uint256 newPrice, uint64 newDurationDays) public {
        // create initial ETH tier: 1 ether, 7 days
        vm.prank(creator);
        uint256 tierId = subs.createTier(1 ether, 7 days, "tier://eth", address(0));

        // user subscribes once
        vm.deal(user, 10 ether);
        vm.prank(user);
        subs.subscribe{value: 1 ether}(creator, tierId);
        uint64 firstExp = subs.subscriptionExpiry(user, creator);
        assertEq(firstExp, uint64(block.timestamp) + 7 days);

        // bound fuzz inputs to reasonable ranges
        newPrice = bound(newPrice, 1 wei, 1000 ether);
        uint64 newDuration = uint64(bound(uint256(newDurationDays), 1 days, 365 days));

        // update tier while user has an active sub
        vm.prank(creator);
        subs.updateTier(tierId, newPrice, newDuration, "tier://eth-upd", address(0));

        // immediate renew (still active) -> Extend mode stacks from current expiry
        // top up to cover potentially high fuzzed price
        vm.deal(user, newPrice * 2);
        vm.prank(user);
        subs.subscribe{value: newPrice}(creator, tierId);
        uint64 secondExp = subs.subscriptionExpiry(user, creator);
        assertEq(secondExp, firstExp + newDuration);

        // let it lapse, then renew -> should start from now
        vm.warp(uint256(secondExp) + 3 days);
        // top up again before next renewal
        vm.deal(user, newPrice * 2);
        vm.prank(user);
        subs.subscribe{value: newPrice}(creator, tierId);
        uint64 thirdExp = subs.subscriptionExpiry(user, creator);
        assertEq(thirdExp, uint64(block.timestamp) + newDuration);
    }
}
