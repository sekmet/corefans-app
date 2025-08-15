// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {CreatorRegistry} from "../src/CreatorRegistry.sol";
import {SubscriptionManager} from "../src/SubscriptionManager.sol";
import {ICreatorRegistry} from "../src/interfaces/ICreatorRegistry.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

contract SubscriptionManagerPaymentsFuzzTest is Test {
    CreatorRegistry reg;
    SubscriptionManager subs;
    MockERC20 token;

    address owner = address(0xA11CE);
    address creator = address(0xC0FFEE);
    address payout = address(0xBEEF);
    address user = address(0xCAFE);

    function setUp() public {
        reg = new CreatorRegistry(owner);
        vm.prank(owner);
        reg.registerCreator(creator, payout);
        subs = new SubscriptionManager(owner, ICreatorRegistry(address(reg)), owner, 200);
        token = new MockERC20("Mock", "MOCK");
        vm.prank(owner);
        subs.setTokenAllowed(address(token), true);
    }

    function testFuzz_FeeSplits(uint96 platformBps, uint96 creatorCap) public {
        // bounds: platform 0..2000, cap 0..platform
        platformBps = uint96(bound(platformBps, 0, 2000));
        creatorCap = uint96(bound(creatorCap, 0, platformBps));

        vm.prank(owner);
        subs.setPlatformFeeBps(platformBps);

        vm.prank(creator);
        subs.setCreatorFeeCapBps(creatorCap);

        // create ERC20 tier
        vm.prank(creator);
        uint256 tierId = subs.createTier(1e18, 7 days, "tier://fee-fuzz", address(token));

        // subscribe
        token.mint(user, 1e18);
        vm.startPrank(user);
        token.approve(address(subs), 1e18);
        subs.subscribe(creator, tierId);
        vm.stopPrank();

        uint96 effective = creatorCap != 0 && creatorCap < platformBps ? creatorCap : platformBps;
        uint256 platformCut = (1e18 * effective) / 10_000;
        uint256 creatorCut = 1e18 - platformCut;

        assertEq(subs.platformBalanceByToken(address(token)), platformCut);
        assertEq(subs.creatorBalanceByToken(creator, address(token)), creatorCut);
    }
}
