// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {CreatorRegistry} from "../src/CreatorRegistry.sol";
import {SubscriptionManager} from "../src/SubscriptionManager.sol";
import {ICreatorRegistry} from "../src/interfaces/ICreatorRegistry.sol";

contract SubscriptionManager_GatingViews_Scaffold_Test is Test {
    CreatorRegistry reg;
    SubscriptionManager subs;
    address owner = address(0xA11CE);
    address creator = address(0xC0FFEE);
    address payout = address(0xBEEF);
    address user = address(0xCAFE);
    address creator2 = address(0xD00D);
    address payout2 = address(0xF00D);

    function setUp() public {
        reg = new CreatorRegistry(owner);
        vm.prank(owner);
        reg.registerCreator(creator, payout);
        vm.prank(owner);
        reg.registerCreator(creator2, payout2);
        subs = new SubscriptionManager(owner, ICreatorRegistry(address(reg)), owner, 200);
    }

    function test_hasActiveSubscription_and_grace() public {
        // initially false
        assertFalse(subs.hasActiveSubscription(user, creator));

        // create a 7-day ETH tier and subscribe
        vm.prank(creator);
        uint256 tierId = subs.createTier(1 ether, 7 days, "tier://gating", address(0));
        vm.deal(user, 2 ether);
        vm.prank(user);
        subs.subscribe{value: 1 ether}(creator, tierId);
        assertTrue(subs.hasActiveSubscription(user, creator));

        // move forward beyond expiry and check false
        vm.warp(block.timestamp + 8 days);
        assertFalse(subs.hasActiveSubscription(user, creator));

        // set grace period to 3 days; now still within grace -> true
        vm.prank(creator);
        subs.setCreatorGracePeriod(3 days);
        assertTrue(subs.hasActiveSubscription(user, creator));

        // move beyond grace -> false
        vm.warp(block.timestamp + 4 days);
        assertFalse(subs.hasActiveSubscription(user, creator));
    }

    function test_hasAnyActiveSubscription_multi_creators_and_grace() public {
        // starts false (no subs)
        assertFalse(subs.hasAnyActiveSubscription(user));

        // creators set tiers
        vm.prank(creator);
        uint256 tier1 = subs.createTier(1 ether, 7 days, "tier://c1", address(0));
        vm.prank(creator2);
        uint256 tier2 = subs.createTier(1 ether, 3 days, "tier://c2", address(0));

        vm.deal(user, 5 ether);

        // subscribe only to creator2 (3-day tier)
        vm.prank(user);
        subs.subscribe{value: 1 ether}(creator2, tier2);
        assertTrue(subs.hasAnyActiveSubscription(user));

        // after 4 days (expired by 1 day), without grace -> false
        vm.warp(block.timestamp + 4 days);
        assertFalse(subs.hasAnyActiveSubscription(user));

        // set grace for creator2 to 2 days -> now within grace -> true
        vm.prank(creator2);
        subs.setCreatorGracePeriod(2 days);
        assertTrue(subs.hasAnyActiveSubscription(user));

        // move beyond grace -> false
        vm.warp(block.timestamp + 2 days);
        assertFalse(subs.hasAnyActiveSubscription(user));

        // subscribe to creator1 (7-day tier) -> true during active
        vm.prank(user);
        subs.subscribe{value: 1 ether}(creator, tier1);
        assertTrue(subs.hasAnyActiveSubscription(user));

        // after 8 days (expired by 1 day), no grace yet -> false
        vm.warp(block.timestamp + 8 days);
        assertFalse(subs.hasAnyActiveSubscription(user));

        // set grace for creator1 to 1 day -> now within grace -> true
        vm.prank(creator);
        subs.setCreatorGracePeriod(1 days);
        assertTrue(subs.hasAnyActiveSubscription(user));

        // beyond grace -> false
        vm.warp(block.timestamp + 2 days);
        assertFalse(subs.hasAnyActiveSubscription(user));
    }
}
