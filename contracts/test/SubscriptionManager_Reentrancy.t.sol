// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {CreatorRegistry} from "../src/CreatorRegistry.sol";
import {SubscriptionManager} from "../src/SubscriptionManager.sol";
import {ICreatorRegistry} from "../src/interfaces/ICreatorRegistry.sol";
import {ReentrantCreator} from "../src/mocks/ReentrantCreator.sol";
import {Treasury} from "../src/Treasury.sol";

contract SubscriptionManagerReentrancyTest is Test {
    CreatorRegistry reg;
    SubscriptionManager subs;
    ReentrantCreator reent;
    Treasury tre;

    address owner = address(0xA11CE);
    address user = address(0xCAFE);

    function setUp() public {
        reg = new CreatorRegistry(owner);
        subs = new SubscriptionManager(owner, ICreatorRegistry(address(reg)), owner, 200);
        tre = new Treasury(subs, owner);
        vm.prank(owner);
        subs.setTreasury(address(tre));
        reent = new ReentrantCreator(address(tre), address(subs));
        vm.prank(owner);
        reg.registerCreator(address(reent), address(reent));
    }

    function testWithdrawCreatorNonReentrant() public {
        // creator creates ETH tier
        vm.prank(address(reent));
        uint256 tierId = reent.createEthTier(1 ether, 30 days, "tier://eth");

        // user subscribes, accruing creator balance
        vm.deal(user, 1 ether);
        vm.prank(user);
        subs.subscribe{value: 1 ether}(address(reent), tierId);

        // withdraw to creator (reent) triggers receive() and reentrancy attempt
        uint256 before = address(reent).balance;
        vm.prank(address(reent));
        reent.doWithdrawCreator(address(0));
        uint256 afterBal = address(reent).balance;

        assertGt(afterBal, before, "creator should receive funds");
        // state should be cleared despite reentrancy attempt
        assertEq(subs.creatorBalanceByToken(address(reent), address(0)), 0);
    }
}
