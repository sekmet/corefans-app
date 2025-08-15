// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {CreatorRegistry} from "../src/CreatorRegistry.sol";
import "../src/SubscriptionManager.sol";
import {SubscribeWithMax} from "../src/SubscribeWithMax.sol";
import {ICreatorRegistry} from "../src/interfaces/ICreatorRegistry.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockOracle} from "../src/mocks/MockOracle.sol";

contract SubscriptionManagerOracleFuzzTest is Test {
    CreatorRegistry reg;
    SubscriptionManager subs;
    SubscribeWithMax ext;
    MockERC20 token;
    MockOracle oracle;

    address owner = address(0xA11CE);
    address creator = address(0xC0FFEE);
    address payout = address(0xBEEF);
    address user = address(0xCAFE);

    uint256 constant USD_1E8 = 1e8;

    function setUp() public {
        reg = new CreatorRegistry(owner);
        vm.prank(owner);
        reg.registerCreator(creator, payout);
        subs = new SubscriptionManager(owner, ICreatorRegistry(address(reg)), owner, 200);
        ext = new SubscribeWithMax(subs);
        vm.prank(owner);
        subs.setSubscribeExtension(address(ext));
        token = new MockERC20("MockUSDC", "mUSDC");
        vm.prank(owner);
        subs.setTokenAllowed(address(token), true);
        oracle = new MockOracle(8, 2000e8, block.timestamp); // $2000 per token
    }

    function _createOracleTier(uint256 usdPrice) internal returns (uint256 tierId) {
        vm.prank(creator);
        tierId = subs.createTierOracle(usdPrice, 30 days, "tier://oracle-fuzz", address(token), address(oracle), 18);
    }

    // Fuzz around staleness boundary and future timestamps
    function testFuzz_UpdatedAtBoundary(int128 deltaSeconds) public {
        uint256 usdPrice = 25 * USD_1E8; // $25
        uint256 tierId = _createOracleTier(usdPrice);

        // Clamp delta to +/- 1 day to avoid overflow
        int256 d = int256(deltaSeconds);
        vm.assume(d >= -86400 && d <= 86400);

        uint256 ts;
        if (d >= 0) {
            ts = uint256(int256(block.timestamp) + d);
        } else {
            ts = uint256(int256(block.timestamp) + d); // safe due to bound above
        }
        oracle.setAnswer(2000e8, ts);

        // Compute amount when valid
        uint256 amount = (usdPrice * 1e18) / uint256(2000e8);

        if (ts > block.timestamp) {
            // future-dated -> revert
            vm.expectRevert(OracleFuture.selector);
            vm.prank(user);
            ext.subscribeWithMax(creator, tierId, type(uint256).max);
            return;
        }

        uint256 age = block.timestamp - ts;
        if (age > subs.ORACLE_STALE_AFTER()) {
            vm.expectRevert(OracleStale.selector);
            vm.prank(user);
            ext.subscribeWithMax(creator, tierId, type(uint256).max);
            return;
        }

        // Valid window: mint/approve and subscribe
        token.mint(user, amount);
        vm.startPrank(user);
        token.approve(address(subs), amount);
        ext.subscribeWithMax(creator, tierId, amount);
        vm.stopPrank();

        assertTrue(subs.hasActiveSubscription(user, creator));
    }

    // Fuzz price answer boundaries, including invalid and amount==0 cases
    function testFuzz_AnswerBoundaries(int128 answerRaw) public {
        uint256 usdPrice = 1 * USD_1E8; // $1 to hit amount==0 when answer huge
        uint256 tierId = _createOracleTier(usdPrice);

        int256 ans = int256(answerRaw);
        // Bound within reasonable range to avoid extreme gas/time
        vm.assume(ans >= -1e14 && ans <= 1e14);

        uint256 ts = block.timestamp;
        oracle.setAnswer(ans, ts);

        if (ans <= 0) {
            vm.expectRevert(OracleInvalid.selector);
            vm.prank(user);
            ext.subscribeWithMax(creator, tierId, type(uint256).max);
            return;
        }

        // Compute amount and check amount zero path
        uint256 amount = (usdPrice * 1e18) / uint256(ans);
        if (amount == 0) {
            vm.expectRevert(AmountZero.selector);
            vm.prank(user);
            ext.subscribeWithMax(creator, tierId, type(uint256).max);
            return;
        }

        // happy path: mint/approve and subscribe
        token.mint(user, amount);
        vm.startPrank(user);
        token.approve(address(subs), amount);
        ext.subscribeWithMax(creator, tierId, amount);
        vm.stopPrank();
        assertTrue(subs.hasActiveSubscription(user, creator));
    }
}
