// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {CreatorRegistry} from "../src/CreatorRegistry.sol";
import "../src/SubscriptionManager.sol";
import {SubscribeWithMax} from "../src/SubscribeWithMax.sol";
import {ICreatorRegistry} from "../src/interfaces/ICreatorRegistry.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockOracle} from "../src/mocks/MockOracle.sol";

contract SubscriptionManagerSlippageTest is Test {
    CreatorRegistry reg;
    SubscriptionManager subs;
    SubscribeWithMax ext;
    MockERC20 usdc; // 6 decimals
    MockOracle ethUsd;

    address owner = address(0xA11CE);
    address creator = address(0xC0FFEE);
    address payout = address(0xBEEF);
    address user = address(0xCAFE);

    function setUp() public {
        reg = new CreatorRegistry(owner);
        vm.prank(owner);
        reg.registerCreator(creator, payout);
        subs = new SubscriptionManager(owner, ICreatorRegistry(address(reg)), owner, 200);
        ext = new SubscribeWithMax(subs);
        vm.prank(owner);
        subs.setSubscribeExtension(address(ext));
        usdc = new MockERC20("USD Coin", "USDC");
        vm.prank(owner);
        subs.setTokenAllowed(address(usdc), true);
        ethUsd = new MockOracle(8, 2000e8, block.timestamp); // 1 ETH = $2000
    }

    function testEthSubscribeWithMax() public {
        uint256 usdPrice = 10 * 1e8; // $10
        vm.prank(creator);
        uint256 tierId = subs.createTierOracle(usdPrice, 30 days, "tier://eth-oracle", address(0), address(ethUsd), 18);

        uint256 expected = (usdPrice * 1e18) / (2000e8); // 0.005 ether
        vm.deal(user, 1 ether);

        // success when max >= expected
        vm.prank(user);
        ext.subscribeEthWithMax{value: expected}(creator, tierId, expected);

        // revert on slippage when max < expected
        vm.deal(user, 1 ether);
        vm.prank(user);
        vm.expectRevert(Slippage.selector);
        ext.subscribeEthWithMax{value: expected}(creator, tierId, expected - 1);
    }

    function testErc20SubscribeWithMax() public {
        uint256 usdPrice = 25 * 1e8; // $25
        vm.prank(creator);
        uint256 tierId = subs.createTierOracle(usdPrice, 30 days, "tier://usdc-oracle", address(usdc), address(ethUsd), 6);
        uint256 expected = (usdPrice * 1e6) / (2000e8);

        usdc.mint(user, 1_000_000_000);
        vm.startPrank(user);
        usdc.approve(address(subs), expected);
        ext.subscribeWithMax(creator, tierId, expected);
        vm.stopPrank();

        // Revert when max < required
        usdc.mint(user, 1_000_000_000);
        vm.startPrank(user);
        usdc.approve(address(subs), expected);
        vm.expectRevert(Slippage.selector);
        ext.subscribeWithMax(creator, tierId, expected - 1);
        vm.stopPrank();
    }
}
