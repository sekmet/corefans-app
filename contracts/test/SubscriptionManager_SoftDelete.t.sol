// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {CreatorRegistry} from "../src/CreatorRegistry.sol";
import "../src/SubscriptionManager.sol";
import {ICreatorRegistry} from "../src/interfaces/ICreatorRegistry.sol";

contract SubscriptionManagerSoftDeleteTest is Test {
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

    function testSoftDeletePreventsReactivationAndSubscribe() public {
        vm.startPrank(creator);
        uint256 tierId = subs.createTier(0.01 ether, 30 days, "tier://eth", address(0));
        subs.deleteTier(tierId);
        vm.expectRevert(TierIsDeleted.selector);
        subs.setTierActive(tierId, true);
        vm.stopPrank();

        vm.deal(user, 1 ether);
        vm.prank(user);
        vm.expectRevert(InvalidTier.selector);
        subs.subscribe{value: 0.01 ether}(creator, tierId);
    }
}
