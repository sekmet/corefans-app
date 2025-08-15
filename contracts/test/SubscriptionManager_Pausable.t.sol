// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {CreatorRegistry} from "../src/CreatorRegistry.sol";
import {SubscriptionManager} from "../src/SubscriptionManager.sol";
import {ICreatorRegistry} from "../src/interfaces/ICreatorRegistry.sol";
import {Treasury} from "../src/Treasury.sol";

contract SubscriptionManagerPausableTest is Test {
    CreatorRegistry reg;
    SubscriptionManager subs;
    Treasury tre;

    address owner = address(0xA11CE);
    address creator = address(0xC0FFEE);
    address payout = address(0xBEEF);
    address user = address(0xCAFE);

    function setUp() public {
        reg = new CreatorRegistry(owner);
        vm.prank(owner);
        reg.registerCreator(creator, payout);
        subs = new SubscriptionManager(owner, ICreatorRegistry(address(reg)), owner, 200);
        tre = new Treasury(subs, owner);
        vm.prank(owner);
        subs.setTreasury(address(tre));
    }

    function testPauseBlocksCreateAndSubscribeButAllowsWithdraw() public {
        vm.prank(owner);
        subs.pause();

        vm.startPrank(creator);
        vm.expectRevert();
        subs.createTier(1 ether, 30 days, "tier://eth", address(0));
        vm.stopPrank();

        vm.deal(user, 1 ether);
        vm.expectRevert();
        subs.subscribe{value: 1 ether}(creator, 0);

        vm.prank(owner);
        subs.unpause();

        vm.prank(creator);
        uint256 tierId = subs.createTier(1 ether, 30 days, "tier://eth", address(0));

        vm.deal(user, 1 ether);
        vm.prank(user);
        subs.subscribe{value: 1 ether}(creator, tierId);

        // pause again and allow withdraws
        vm.prank(owner);
        subs.pause();
        uint256 before = creator.balance;
        vm.prank(creator);
        tre.withdrawCreator(address(0));
        assertGt(creator.balance, before);
    }
}
