// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";

import {CreatorRegistry} from "../src/CreatorRegistry.sol";
import {SubscriptionManager} from "../src/SubscriptionManager.sol";
import {TipJar} from "../src/TipJar.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {ICreatorRegistry} from "../src/interfaces/ICreatorRegistry.sol";

// Helper contract used to attempt reentrancy during ETH withdraw
contract ReentrantReceiver {
    TipJar public tip;
    constructor(TipJar t) { tip = t; }
    receive() external payable {
        // Attempt to re-enter; should fail due to nonReentrant
        try tip.withdrawCreator(address(0)) { } catch { }
    }
}

contract TipJarTest is Test {
    address owner = address(0xC0FFEE);
    address treasury = address(0xBEEF);
    address creator = address(0xCAFE);
    address user = address(0xF00D);

    CreatorRegistry registry;
    SubscriptionManager subs;
    TipJar tip;

    uint96 constant FEE_BPS = 200; // 2%

    function setUp() public {
        vm.deal(owner, 100 ether);
        vm.prank(owner);
        registry = new CreatorRegistry(owner);

        vm.prank(owner);
        subs = new SubscriptionManager(owner, ICreatorRegistry(address(registry)), treasury, FEE_BPS);

        // Register a creator with a payout address
        vm.prank(owner);
        registry.registerCreator(creator, address(0x1234));

        // Create an ETH tier to allow subscriptions
        vm.prank(creator);
        subs.createTier(1 ether, 30 days, "tier://basic", address(0));

        vm.prank(owner);
        tip = new TipJar(owner, ICreatorRegistry(address(registry)), address(subs), treasury, FEE_BPS);

        vm.deal(user, 100 ether);
    }

    function test_tipETH_splits_and_withdraws() public {
        uint256 amt = 5 ether;
        vm.prank(user);
        tip.tipETH{value: amt}(creator);

        // 2% to platform
        assertEq(tip.platformBalanceByToken(address(0)), (amt * FEE_BPS) / 10_000);
        assertEq(tip.creatorBalanceByToken(creator, address(0)), amt - (amt * FEE_BPS) / 10_000);

        // Withdraw creator
        uint256 beforeCreator = creator.balance;
        vm.prank(creator);
        tip.withdrawCreator(address(0));
        uint256 afterCreator = creator.balance;
        assertEq(afterCreator - beforeCreator, 5 ether - (5 ether * FEE_BPS) / 10_000);

        // Withdraw platform
        uint256 beforeTreasury = treasury.balance;
        tip.withdrawPlatform(address(0));
        uint256 afterTreasury = treasury.balance;
        assertEq(afterTreasury - beforeTreasury, (5 ether * FEE_BPS) / 10_000);
    }

    function test_tipERC20_splits_and_withdraws() public {
        MockERC20 token = new MockERC20("Mock", "MOCK");
        token.mint(user, 1000e18);

        vm.startPrank(user);
        token.approve(address(tip), 100e18);
        tip.tipERC20(creator, address(token), 100e18);
        vm.stopPrank();

        assertEq(tip.platformBalanceByToken(address(token)), (100e18 * FEE_BPS) / 10_000);
        assertEq(tip.creatorBalanceByToken(creator, address(token)), 100e18 - (100e18 * FEE_BPS) / 10_000);

        // Withdraw creator
        uint256 creatorBefore = token.balanceOf(creator);
        vm.prank(creator);
        tip.withdrawCreator(address(token));
        uint256 creatorAfter = token.balanceOf(creator);
        assertEq(creatorAfter - creatorBefore, 100e18 - (100e18 * FEE_BPS) / 10_000);

        // Withdraw platform
        uint256 treBefore = token.balanceOf(treasury);
        tip.withdrawPlatform(address(token));
        uint256 treAfter = token.balanceOf(treasury);
        assertEq(treAfter - treBefore, (100e18 * FEE_BPS) / 10_000);
    }

    function test_pause_blocks_tips() public {
        vm.prank(owner);
        tip.pause();
        vm.expectRevert();
        vm.prank(user);
        tip.tipETH{value: 1 ether}(creator);

        vm.prank(owner);
        tip.unpause();
        vm.prank(user);
        tip.tipETH{value: 1 ether}(creator);
        assertEq(tip.creatorBalanceByToken(creator, address(0)) > 0, true);
    }

    function test_subscriberOnly_requires_active_subscription() public {
        vm.prank(owner);
        tip.setSubscriberOnly(true);

        // Non-subscriber should fail
        vm.expectRevert(bytes("not subscriber"));
        vm.prank(user);
        tip.tipETH{value: 1 ether}(creator);

        // Subscribe user to creator
        vm.deal(user, 10 ether);
        vm.prank(user);
        subs.subscribe{value: 1 ether}(creator, 0);

        // Now tipping succeeds
        vm.prank(user);
        tip.tipETH{value: 2 ether}(creator);
        assertEq(tip.creatorBalanceByToken(creator, address(0)), 2 ether - (2 ether * FEE_BPS) / 10_000);
    }

    function test_withdrawCreator_reentrancy_protected() public {
        // Switch creator to a reentrant contract
        ReentrantReceiver rr = new ReentrantReceiver(tip);
        // Re-point mapping balance by moving the creator address: simulate creator being the contract
        // For this test, register rr as a creator and tip it
        vm.prank(owner);
        registry.registerCreator(address(rr), address(0x8888));
        vm.prank(user);
        tip.tipETH{value: 1 ether}(address(rr));

        uint256 net = 1 ether - (1 ether * FEE_BPS) / 10_000;
        uint256 before = address(rr).balance;
        vm.prank(address(rr));
        tip.withdrawCreator(address(0));
        uint256 afterBal = address(rr).balance;
        // Withdrawal should succeed and be non-reentrant; mapping cleared
        assertEq(afterBal - before, net);
        assertEq(tip.creatorBalanceByToken(address(rr), address(0)), 0);
    }
}
