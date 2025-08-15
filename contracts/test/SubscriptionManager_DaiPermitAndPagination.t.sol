// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {CreatorRegistry} from "../src/CreatorRegistry.sol";
import "../src/SubscriptionManager.sol";
import {SubscribeWithMax} from "../src/SubscribeWithMax.sol";
import "../src/SubscriptionViews.sol";
import "../src/OracleConfigurator.sol";
import {ICreatorRegistry} from "../src/interfaces/ICreatorRegistry.sol";
import {MockOracle} from "../src/mocks/MockOracle.sol";
import {MockDaiLikeERC20} from "../src/mocks/MockDaiLikeERC20.sol";

contract SubscriptionManagerDaiPermitAndPaginationTest is Test {
    CreatorRegistry reg;
    SubscriptionManager subs;
    SubscribeWithMax ext;
    SubscriptionViews views;
    OracleConfigurator config;
    MockDaiLikeERC20 dai;
    MockOracle oracle; // token/USD, 8 decimals

    address owner = address(0xA11CE);
    address creator = address(0xC0FFEE);
    address payout = address(0xBEEF);

    uint256 userPk = 0xB0B; // deterministic
    address user = vm.addr(userPk);
    address user2 = address(0xCAFE);

    function setUp() public {
        reg = new CreatorRegistry(owner);
        vm.prank(owner);
        reg.registerCreator(creator, payout);
        subs = new SubscriptionManager(owner, ICreatorRegistry(address(reg)), owner, 200);
        ext = new SubscribeWithMax(subs);
        vm.prank(owner);
        subs.setSubscribeExtension(address(ext));
        views = new SubscriptionViews(subs);
        config = new OracleConfigurator(subs, owner);
        vm.prank(owner);
        subs.setOracleConfigurator(address(config));
        dai = new MockDaiLikeERC20("MockDAI", "mDAI");
        vm.prank(owner);
        subs.setTokenAllowed(address(dai), true);
        oracle = new MockOracle(8, 2000e8, block.timestamp); // price feed

        // set default oracle for this token
        vm.prank(owner);
        config.setTokenOracleDefault(address(dai), address(oracle), 18);

        // fund users
        dai.mint(user, 1_000_000 ether);
        dai.mint(user2, 1_000_000 ether);
        vm.deal(user, 10 ether);
        vm.deal(user2, 10 ether);
    }

    function testSubscribeWithDaiPermit_fixed() public {
        vm.prank(creator);
        uint256 tierId = subs.createTier(1 ether, 30 days, "tier://fixed", address(dai));

        // Build DAI-like permit
        uint256 nonce = dai.nonces(user);
        uint256 expiry = block.timestamp + 1 days;
        bytes32 DOMAIN_SEPARATOR = dai.DOMAIN_SEPARATOR();
        bytes32 TYPEHASH = keccak256("Permit(address holder,address spender,uint256 nonce,uint256 expiry,bool allowed)");
        bytes32 structHash = keccak256(abi.encode(TYPEHASH, user, address(subs), nonce, expiry, true));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPk, digest);

        vm.startPrank(user);
        ext.subscribeWithDaiPermit(creator, tierId, nonce, expiry, true, v, r, s);
        vm.stopPrank();

        assertTrue(subs.hasActiveSubscription(user, creator));
    }

    function testCreateTierOracle_usesDefault() public {
        // create oracle-priced tier using default oracle
        uint256 usdPrice = 25 * 1e8;
        vm.prank(creator);
        uint256 tierId = subs.createTierOracle(usdPrice, 30 days, "tier://oracle-default", address(dai), address(0), 0);

        // compute expected in DAI units: (25e8 * 1e18)/2000e8
        uint256 expected = (usdPrice * 1e18) / (2000e8);

        // Permit for expected value
        uint256 nonce = dai.nonces(user);
        uint256 expiry = block.timestamp + 1 days;
        bytes32 DOMAIN_SEPARATOR = dai.DOMAIN_SEPARATOR();
        bytes32 TYPEHASH = keccak256("Permit(address holder,address spender,uint256 nonce,uint256 expiry,bool allowed)");
        bytes32 structHash = keccak256(abi.encode(TYPEHASH, user, address(subs), nonce, expiry, true));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPk, digest);

        vm.startPrank(user);
        ext.subscribeWithDaiPermit(creator, tierId, nonce, expiry, true, v, r, s);
        vm.stopPrank();

        assertTrue(subs.hasActiveSubscription(user, creator));
    }

    function testOracleFutureRevert() public {
        MockOracle future = new MockOracle(8, 2000e8, block.timestamp + 1 hours);
        vm.prank(owner);
        config.setTokenOracleDefault(address(0), address(future), 18); // for ETH path

        uint256 usdPrice = 10 * 1e8;
        vm.prank(creator);
        uint256 tierId = subs.createTierOracle(usdPrice, 30 days, "tier://eth-oracle", address(0), address(0), 0); // use default ETH

        vm.deal(user, 1 ether);
        vm.prank(user);
        vm.expectRevert(OracleFuture.selector);
        subs.subscribe{value: 1}(creator, tierId);
    }

    function testActiveSubscribersPagination() public {
        // Create a fixed-price ERC20 tier
        vm.prank(creator);
        uint256 tierId = subs.createTier(1000, 30 days, "tier://fixed", address(dai));

        // user and user2 subscribe using approve path for simplicity
        dai.approve(address(subs), type(uint256).max);
        vm.startPrank(user);
        dai.approve(address(subs), type(uint256).max);
        subs.subscribe(creator, tierId);
        vm.stopPrank();

        vm.startPrank(user2);
        dai.approve(address(subs), type(uint256).max);
        subs.subscribe(creator, tierId);
        vm.stopPrank();

        // list subscribers
        (address[] memory page, uint256 next) = views.getSubscribersPage(creator, 0, 10);
        assertEq(page.length, 2);
        assertEq(page[0], user);
        assertEq(page[1], user2);
        assertEq(next, 2);

        // active page should also show both
        (address[] memory alive, uint256 next2) = views.getActiveSubscribersPage(creator, 0, 10);
        assertEq(alive.length, 2);
        assertEq(next2, 2);
    }
}
