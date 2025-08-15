// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {CreatorRegistry} from "../src/CreatorRegistry.sol";
import {SubscriptionManager} from "../src/SubscriptionManager.sol";
import {ICreatorRegistry} from "../src/interfaces/ICreatorRegistry.sol";

contract SubscriptionManagerRenewalModeTest is Test {
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

    function _createEthTier(uint64 duration, uint256 price) internal returns (uint256) {
        vm.prank(creator);
        return subs.createTier(price, duration, "tier://renew", address(0));
    }

    function testEarlyRenewResetModeResetsFromNow() public {
        uint256 tierId = _createEthTier(10 days, 1 ether);

        // initial subscribe
        vm.deal(user, 3 ether);
        vm.prank(user);
        subs.subscribe{value: 1 ether}(creator, tierId);
        uint64 firstExp = subs.subscriptionExpiry(user, creator);

        // switch to Reset mode before early renew
        vm.prank(creator);
        subs.setCreatorRenewalMode(SubscriptionManager.RenewalMode.Reset);

        // early renew just before expiry
        vm.warp(uint256(firstExp) - 1);
        vm.prank(user);
        subs.subscribe{value: 1 ether}(creator, tierId);
        uint64 secondExp = subs.subscriptionExpiry(user, creator);
        // In Reset mode, early renewals should restart from now
        assertEq(secondExp, uint64(block.timestamp) + 10 days);
        // And should NOT stack from firstExp
        assertTrue(secondExp < firstExp + 10 days);
    }

    function testSwitchBackToExtendStacksAgain() public {
        uint256 tierId = _createEthTier(5 days, 1 ether);

        vm.deal(user, 3 ether);
        vm.prank(user);
        subs.subscribe{value: 1 ether}(creator, tierId);
        uint64 exp1 = subs.subscriptionExpiry(user, creator);

        // Set Reset and renew early -> resets from now
        vm.prank(creator);
        subs.setCreatorRenewalMode(SubscriptionManager.RenewalMode.Reset);
        vm.warp(uint256(exp1) - 1);
        vm.prank(user);
        subs.subscribe{value: 1 ether}(creator, tierId);
        uint64 exp2 = subs.subscriptionExpiry(user, creator);
        assertEq(exp2, uint64(block.timestamp) + 5 days);

        // Switch back to Extend and renew early again -> stacks from current expiry
        vm.prank(creator);
        subs.setCreatorRenewalMode(SubscriptionManager.RenewalMode.Extend);
        vm.warp(uint256(exp2) - 1);
        vm.prank(user);
        subs.subscribe{value: 1 ether}(creator, tierId);
        uint64 exp3 = subs.subscriptionExpiry(user, creator);
        assertEq(exp3, exp2 + 5 days);
    }

    function testLapsedRenewIsNowBasedForBothModes() public {
        uint256 tierId = _createEthTier(3 days, 1 ether);

        vm.deal(user, 3 ether);
        vm.prank(user);
        subs.subscribe{value: 1 ether}(creator, tierId);
        uint64 exp = subs.subscriptionExpiry(user, creator);

        // Lapse by 2 days past expiry
        vm.warp(uint256(exp) + 2 days);

        // Extend mode (default)
        vm.prank(user);
        subs.subscribe{value: 1 ether}(creator, tierId);
        uint64 expExtend = subs.subscriptionExpiry(user, creator);
        assertEq(expExtend, uint64(block.timestamp) + 3 days);

        // Lapse again and set Reset mode
        vm.warp(uint256(expExtend) + 2 days);
        vm.prank(creator);
        subs.setCreatorRenewalMode(SubscriptionManager.RenewalMode.Reset);

        vm.prank(user);
        subs.subscribe{value: 1 ether}(creator, tierId);
        uint64 expReset = subs.subscriptionExpiry(user, creator);
        assertEq(expReset, uint64(block.timestamp) + 3 days);
    }
}
