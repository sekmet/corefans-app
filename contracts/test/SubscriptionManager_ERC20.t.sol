// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {CreatorRegistry} from "../src/CreatorRegistry.sol";
import {SubscriptionManager} from "../src/SubscriptionManager.sol";
import {ICreatorRegistry} from "../src/interfaces/ICreatorRegistry.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {Treasury} from "../src/Treasury.sol";

contract SubscriptionManagerERC20Test is Test {
    CreatorRegistry reg;
    SubscriptionManager subs;
    MockERC20 usdc;
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
        usdc = new MockERC20("USD Coin", "USDC");
        // allow USDC for tiers
        vm.prank(owner);
        subs.setTokenAllowed(address(usdc), true);
    }

    function testSubscribeERC20AndWithdraws() public {
        vm.startPrank(creator);
        uint256 tierId = subs.createTier(1000e6, 30 days, "tier://usdc", address(usdc));
        vm.stopPrank();

        usdc.mint(user, 2000e6);
        vm.prank(user);
        usdc.approve(address(subs), 1000e6);

        vm.prank(user);
        subs.subscribe(creator, tierId);

        // balances: 2% fee
        assertEq(subs.subscriptionExpiry(user, creator), uint64(block.timestamp) + 30 days);
        assertEq(subs.platformBalanceByToken(address(usdc)), 20e6);
        assertEq(subs.creatorBalanceByToken(creator, address(usdc)), 980e6);

        // creator withdraws
        uint256 beforeC = usdc.balanceOf(creator);
        vm.prank(creator);
        tre.withdrawCreator(address(usdc));
        assertEq(usdc.balanceOf(creator) - beforeC, 980e6);

        // platform withdraws
        uint256 beforeP = usdc.balanceOf(owner);
        vm.prank(owner);
        tre.withdrawPlatform(address(usdc));
        assertEq(usdc.balanceOf(owner) - beforeP, 20e6);
    }
}
