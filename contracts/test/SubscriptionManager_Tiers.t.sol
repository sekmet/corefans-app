// SPDX-License-Identifier: MIT
  pragma solidity ^0.8.24;

  import "forge-std/Test.sol";
  import {CreatorRegistry} from "../src/CreatorRegistry.sol";
  import {SubscriptionManager} from "../src/SubscriptionManager.sol";
  import {ICreatorRegistry} from "../src/interfaces/ICreatorRegistry.sol";
  import {MockERC20} from "../src/mocks/MockERC20.sol";

  contract SubscriptionManagerTiersTest is Test {
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

  function testUpdateTierAndActiveToggle() public {
      vm.prank(creator);
      uint256 tierId = subs.createTier(1 ether, 7 days, "tier://eth", address(0));

      vm.prank(creator);
      subs.updateTier(tierId, 2 ether, 14 days, "tier://eth-updated", address(0));

      vm.deal(user, 5 ether);
      vm.prank(user);
      subs.subscribe{value: 2 ether}(creator, tierId);
      assertEq(subs.subscriptionExpiry(user, creator), uint64(block.timestamp) + 14 days);

      vm.prank(creator);
      subs.setTierActive(tierId, false);

      vm.deal(user, 2 ether);
      vm.expectRevert(); // inactive tier -> invalid tier
      vm.prank(user);
      subs.subscribe{value: 2 ether}(creator, tierId);

      vm.prank(creator);
      subs.setTierActive(tierId, true);

      uint64 beforeExp = subs.subscriptionExpiry(user, creator);
      vm.deal(user, 2 ether);
      vm.prank(user);
      subs.subscribe{value: 2 ether}(creator, tierId);
      assertEq(subs.subscriptionExpiry(user, creator), beforeExp + 14 days);
  }

  function testGracePeriodSemantics() public {
      // creator sets grace period 3 days
      vm.prank(creator);
      subs.setCreatorGracePeriod(3 days);

      // create short ETH tier: 7 days
      vm.prank(creator);
      uint256 tierId = subs.createTier(1 ether, 7 days, "tier://eth-grace", address(0));

      // subscribe
      vm.deal(user, 1 ether);
      vm.prank(user);
      subs.subscribe{value: 1 ether}(creator, tierId);

      uint64 exp = subs.subscriptionExpiry(user, creator);
      // within grace (exp + 2 days)
      vm.warp(uint256(exp) + 2 days);
      assertTrue(subs.hasActiveSubscription(user, creator));

      // beyond grace (exp + 3 days + 1)
      vm.warp(uint256(exp) + 3 days + 1);
      assertFalse(subs.hasActiveSubscription(user, creator));
  }

  function testRenewalAccumulation() public {
      // Create ETH tier: duration 10 days, price 1 ether
      vm.prank(creator);
      uint256 tierId = subs.createTier(1 ether, 10 days, "tier://eth-renew", address(0));

      // First subscription
      vm.deal(user, 3 ether);
      vm.prank(user);
      subs.subscribe{value: 1 ether}(creator, tierId);
      uint64 firstExp = subs.subscriptionExpiry(user, creator);

      // Renew before expiry -> should accumulate from current expiry
      vm.warp(uint256(firstExp) - 1);
      vm.prank(user);
      subs.subscribe{value: 1 ether}(creator, tierId);
      uint64 secondExp = subs.subscriptionExpiry(user, creator);
      assertEq(secondExp, firstExp + 10 days);

      // Let it lapse past expiry, then renew -> should start from now
      vm.warp(uint256(secondExp) + 5 days);
      vm.prank(user);
      subs.subscribe{value: 1 ether}(creator, tierId);
      uint64 thirdExp = subs.subscriptionExpiry(user, creator);
      // now-based, so equals block.timestamp + 10 days
      assertEq(thirdExp, uint64(block.timestamp) + 10 days);
  }
  }
