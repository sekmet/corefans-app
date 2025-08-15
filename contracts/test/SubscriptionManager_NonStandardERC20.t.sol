// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {CreatorRegistry} from "../src/CreatorRegistry.sol";
import {SubscriptionManager} from "../src/SubscriptionManager.sol";
import {ICreatorRegistry} from "../src/interfaces/ICreatorRegistry.sol";
import {MockERC20NoReturn} from "../src/mocks/MockERC20NoReturn.sol";

contract SubscriptionManagerNonStandardERC20Test is Test {
    CreatorRegistry reg;
    SubscriptionManager subs;
    MockERC20NoReturn token;

    address owner = address(0xA11CE);
    address creator = address(0xC0FFEE);
    address payout = address(0xBEEF);
    address user = address(0xCAFE);

    function setUp() public {
        reg = new CreatorRegistry(owner);
        vm.prank(owner);
        reg.registerCreator(creator, payout);
        subs = new SubscriptionManager(owner, ICreatorRegistry(address(reg)), owner, 200);
        token = new MockERC20NoReturn("NoRet", "NRT");
        vm.prank(owner);
        subs.setTokenAllowed(address(token), true);
    }

    function testSubscribeRevertsWithNonStandardToken() public {
        // create ERC20 tier using non-standard token
        vm.prank(creator);
        uint256 tierId = subs.createTier(1e18, 30 days, "tier://noret", address(token));

        // user mints, approves and tries to subscribe
        token.mint(user, 1e18);
        vm.startPrank(user);
        token.approve(address(subs), 1e18); // no return value but fine from caller perspective
        vm.expectRevert(); // low-level revert due to bool decode on transferFrom
        subs.subscribe(creator, tierId);
        vm.stopPrank();

        // ensure no balances were credited
        assertEq(subs.platformBalanceByToken(address(token)), 0);
        assertEq(subs.creatorBalanceByToken(creator, address(token)), 0);
    }
}
