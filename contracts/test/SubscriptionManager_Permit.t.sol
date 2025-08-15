// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {CreatorRegistry} from "../src/CreatorRegistry.sol";
import {SubscriptionManager} from "../src/SubscriptionManager.sol";
import {ICreatorRegistry} from "../src/interfaces/ICreatorRegistry.sol";
import {MockERC20Permit} from "../src/mocks/MockERC20Permit.sol";
import {MockOracle} from "../src/mocks/MockOracle.sol";

contract SubscriptionManagerPermitTest is Test {
    CreatorRegistry reg;
    SubscriptionManager subs;
    MockERC20Permit token;

    address owner = address(0xA11CE);
    address creator = address(0xC0FFEE);
    address payout = address(0xBEEF);
    uint256 userPk = 0xA11CE; // deterministic test key
    address user = vm.addr(userPk);

    function setUp() public {
        reg = new CreatorRegistry(owner);
        vm.prank(owner);
        reg.registerCreator(creator, payout);
        subs = new SubscriptionManager(owner, ICreatorRegistry(address(reg)), owner, 200);
        token = new MockERC20Permit("PermitUSDC", "pUSDC");
        vm.prank(owner);
        subs.setTokenAllowed(address(token), true);
    }

    function testSubscribeWithPermit_OracleExactValue() public {
        // Create oracle-priced tier for ERC20 permit token
        vm.startPrank(creator);
        MockOracle oracle = new MockOracle(8, 2000e8, block.timestamp); // $2000/token
        uint256 usdPrice = 25 * 1e8; // $25
        uint256 tierId = subs.createTierOracle(usdPrice, 30 days, "tier://permit-oracle", address(token), address(oracle), 18);
        vm.stopPrank();

        // expected token amount = (25e8 * 1e18) / 2000e8 = 0.0125 tokens
        uint256 expected = (usdPrice * 1e18) / (2000e8);

        // mint and permit exact value
        token.mint(user, expected);
        uint256 value = expected; // exact
        uint256 nonce = token.nonces(user);
        uint256 deadline = block.timestamp + 1 days;
        bytes32 DOMAIN_SEPARATOR = token.DOMAIN_SEPARATOR();
        bytes32 PERMIT_TYPEHASH = keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
        bytes32 structHash = keccak256(abi.encode(PERMIT_TYPEHASH, user, address(subs), value, nonce, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPk, digest);

        vm.prank(user);
        subs.subscribeWithPermit(creator, tierId, value, deadline, v, r, s);

        assertTrue(subs.hasActiveSubscription(user, creator));
        // 2% fee split
        assertEq(subs.creatorBalanceByToken(creator, address(token)), expected * 98 / 100);
        assertEq(subs.platformBalanceByToken(address(token)), expected * 2 / 100);
    }

    function testSubscribeWithPermit_OracleOverValue() public {
        vm.startPrank(creator);
        MockOracle oracle = new MockOracle(8, 1500e8, block.timestamp); // $1500/token
        uint256 usdPrice = 30 * 1e8; // $30
        uint256 tierId = subs.createTierOracle(usdPrice, 30 days, "tier://permit-oracle-over", address(token), address(oracle), 18);
        vm.stopPrank();

        uint256 expected = (usdPrice * 1e18) / (1500e8);

        token.mint(user, expected * 2);
        uint256 value = expected * 2; // allowance greater than needed
        uint256 nonce = token.nonces(user);
        uint256 deadline = block.timestamp + 1 days;
        bytes32 DOMAIN_SEPARATOR = token.DOMAIN_SEPARATOR();
        bytes32 PERMIT_TYPEHASH = keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
        bytes32 structHash = keccak256(abi.encode(PERMIT_TYPEHASH, user, address(subs), value, nonce, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPk, digest);

        vm.prank(user);
        subs.subscribeWithPermit(creator, tierId, value, deadline, v, r, s);

        assertTrue(subs.hasActiveSubscription(user, creator));
        assertEq(subs.creatorBalanceByToken(creator, address(token)), expected * 98 / 100);
        assertEq(subs.platformBalanceByToken(address(token)), expected * 2 / 100);
    }

    function testSubscribeWithPermit() public {
        vm.prank(creator);
        uint256 tierId = subs.createTier(1000, 30 days, "tier://permit", address(token));

        // mint to user
        token.mint(user, 10_000);

        // build permit
        uint256 value = 1000;
        uint256 nonce = token.nonces(user);
        uint256 deadline = block.timestamp + 1 days;
        bytes32 DOMAIN_SEPARATOR = token.DOMAIN_SEPARATOR();
        bytes32 PERMIT_TYPEHASH = keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
        bytes32 structHash = keccak256(abi.encode(PERMIT_TYPEHASH, user, address(subs), value, nonce, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPk, digest);

        vm.prank(user);
        subs.subscribeWithPermit(creator, tierId, value, deadline, v, r, s);

        assertTrue(subs.hasActiveSubscription(user, creator));
        assertEq(subs.creatorBalanceByToken(creator, address(token)), 980);
        assertEq(subs.platformBalanceByToken(address(token)), 20);
    }
}
