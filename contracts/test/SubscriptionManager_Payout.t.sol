// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {CreatorRegistry} from "../src/CreatorRegistry.sol";
import {SubscriptionManager} from "../src/SubscriptionManager.sol";
import {ICreatorRegistry} from "../src/interfaces/ICreatorRegistry.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {Treasury} from "../src/Treasury.sol";

contract SubscriptionManagerPayoutTest is Test {
    CreatorRegistry reg;
    SubscriptionManager subs;
    MockERC20 token;
    Treasury tre;

    address owner = address(0xA11CE);
    address creator = address(0xC0FFEE);
    address payout = address(0xBEEF);
    address user = address(0xCAFE);
    address treasury = address(0xFEE);

    function setUp() public {
        reg = new CreatorRegistry(owner);
        vm.prank(owner);
        reg.registerCreator(creator, payout);
        subs = new SubscriptionManager(owner, ICreatorRegistry(address(reg)), treasury, 200); // 2%
        tre = new Treasury(subs, owner);
        vm.prank(owner);
        subs.setTreasury(address(tre));
        token = new MockERC20("Mock", "MOCK");
        vm.prank(owner);
        subs.setTokenAllowed(address(token), true);
    }

    function testWithdrawCreatorToPayout_ETH() public {
        // create ETH tier and subscribe
        vm.prank(creator);
        uint256 tierId = subs.createTier(1 ether, 30 days, "tier://eth", address(0));

        vm.deal(user, 1 ether);
        vm.prank(user);
        subs.subscribe{value: 1 ether}(creator, tierId);

        // balances: 2% to platform, 98% to creator
        assertEq(address(subs).balance, 1 ether, "contract hold eth");

        uint256 beforePayout = payout.balance;
        vm.prank(creator);
        tre.withdrawCreatorToPayout(address(0));
        // creator received 0.98 ether to payout address
        assertEq(payout.balance, beforePayout + (1 ether * 98) / 100, "payout received creator share");

        // platform withdraw
        uint256 beforeTreasury = treasury.balance;
        vm.prank(owner);
        tre.withdrawPlatform(address(0));
        assertEq(treasury.balance, beforeTreasury + (1 ether * 2) / 100, "treasury received platform share");
    }

    function testWithdrawCreatorToCustomDst_ERC20() public {
        // create ERC20 tier and subscribe
        vm.prank(creator);
        uint256 tierId = subs.createTier(1000, 30 days, "tier://erc20", address(token));

        token.mint(user, 1000);
        vm.prank(user);
        token.approve(address(subs), 1000);
        vm.prank(user);
        subs.subscribe(creator, tierId);

        address dst = address(0xD157);
        uint256 beforeDst = token.balanceOf(dst);
        vm.prank(creator);
        tre.withdrawCreatorTo(address(token), dst);
        assertEq(token.balanceOf(dst), beforeDst + 980, "dst received creator share");

        uint256 beforeTreasury = token.balanceOf(treasury);
        vm.prank(owner);
        tre.withdrawPlatform(address(token));
        assertEq(token.balanceOf(treasury), beforeTreasury + 20, "platform share erc20");
    }
}
