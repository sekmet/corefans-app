// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {CreatorRegistry} from "../src/CreatorRegistry.sol";
import "../src/SubscriptionManager.sol";
import {ICreatorRegistry} from "../src/interfaces/ICreatorRegistry.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockOracle} from "../src/mocks/MockOracle.sol";

contract SubscriptionManagerOracleTest is Test {
    CreatorRegistry reg;
    SubscriptionManager subs;
    MockERC20 usdc; // 6 decimals
    MockOracle ethUsd; // 8 decimals typical

    address owner = address(0xA11CE);
    address creator = address(0xC0FFEE);
    address payout = address(0xBEEF);
    address user = address(0xCAFE);

    function setUp() public {
        reg = new CreatorRegistry(owner);
        vm.prank(owner);
        reg.registerCreator(creator, payout);
        subs = new SubscriptionManager(owner, ICreatorRegistry(address(reg)), owner, 200);
        usdc = new MockERC20("USD Coin", "USDC");
        vm.prank(owner);
        subs.setTokenAllowed(address(usdc), true);
        ethUsd = new MockOracle(8, 2000e8, block.timestamp); // 1 ETH = $2000
    }

    function testOracleEthTier() public {
        // price $10 in 1e8 => 10 * 1e8
        uint256 usdPrice = 10 * 1e8;
        vm.prank(creator);
        uint256 tierId = subs.createTierOracle(usdPrice, 30 days, "tier://eth-oracle", address(0), address(ethUsd), 18);

        // expected ETH amount = (10e8 * 1e18) / 2000e8 = 0.005 ether
        uint256 expected = (usdPrice * 1e18) / (2000e8);

        vm.deal(user, 1 ether);
        vm.prank(user);
        subs.subscribe{value: expected}(creator, tierId);
        assertTrue(subs.hasActiveSubscription(user, creator));
    }

    function testOracleUsdcTier() public {
        // price $25 => 25e8, USDC: 6 decimals, oracle 8 decimals
        uint256 usdPrice = 25 * 1e8;
        vm.prank(creator);
        uint256 tierId = subs.createTierOracle(usdPrice, 30 days, "tier://usdc-oracle", address(usdc), address(ethUsd), 6);

        // For demo, re-use ETH/USD as token/USD price feed
        // expected USDC amount = (25e8 * 1e6) / 2000e8 = 12500 (i.e. 0.0125 USDC with 6 decimals)
        uint256 expected = (usdPrice * 1e6) / (2000e8);

        usdc.mint(user, 1_000_000_000);
        vm.startPrank(user);
        usdc.approve(address(subs), expected);
        subs.subscribe(creator, tierId);
        vm.stopPrank();

        assertTrue(subs.hasActiveSubscription(user, creator));
    }

    function testOracleStaleReverts() public {
        // Ensure current block timestamp is safely greater than 3 hours to avoid underflow
        vm.warp(10 days);
        // Use USDC tier to avoid ETH msg.value path
        MockOracle stale = new MockOracle(8, 1, block.timestamp - 3 hours);
        uint256 usdPrice = 10 * 1e8;
        vm.prank(creator);
        uint256 tierId = subs.createTierOracle(usdPrice, 30 days, "tier://usdc-oracle-stale", address(usdc), address(stale), 6);

        // expected USDC amount = (10e8 * 1e6) / 2000e8
        uint256 expected = (usdPrice * 1e6) / (2000e8);

        usdc.mint(user, expected);
        vm.startPrank(user);
        usdc.approve(address(subs), expected);
        vm.expectRevert(OracleStale.selector);
        subs.subscribe(creator, tierId);
        vm.stopPrank();
    }

    function testOracleZeroReverts() public {
        MockOracle bad = new MockOracle(8, 0, block.timestamp);
        uint256 usdPrice = 10 * 1e8;
        vm.prank(creator);
        uint256 tierId = subs.createTierOracle(usdPrice, 30 days, "tier://eth-oracle", address(0), address(bad), 18);

        vm.deal(user, 1 ether);
        vm.prank(user);
        vm.expectRevert(OracleInvalid.selector);
        subs.subscribe{value: 1}(creator, tierId);
    }
}
