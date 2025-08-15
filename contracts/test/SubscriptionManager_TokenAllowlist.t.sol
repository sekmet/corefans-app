  // SPDX-License-Identifier: MIT
  pragma solidity ^0.8.24;

  import "forge-std/Test.sol";
  import {CreatorRegistry} from "../src/CreatorRegistry.sol";
  import "../src/SubscriptionManager.sol";
  import {ICreatorRegistry} from "../src/interfaces/ICreatorRegistry.sol";
  import {MockERC20} from "../src/mocks/MockERC20.sol";

  contract SubscriptionManagerTokenAllowlistTest is Test {
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
  }

  function testAllowlistEnforcementOnCreateAndUpdate() public {
      vm.startPrank(creator);
      vm.expectRevert(TokenNotAllowed.selector);
      subs.createTier(1000, 30 days, "tier://erc20", address(token));
      vm.stopPrank();

      vm.prank(owner);
      subs.setTokenAllowed(address(token), true);

      vm.prank(creator);
      uint256 tierId = subs.createTier(1000, 30 days, "tier://erc20", address(token));

      vm.prank(owner);
      subs.setTokenAllowed(address(token), false);

      vm.startPrank(creator);
      vm.expectRevert(TokenNotAllowed.selector);
      subs.createTier(2000, 30 days, "tier://erc20-2", address(token));
      vm.stopPrank();

      token.mint(user, 5000);
      vm.startPrank(user);
      token.approve(address(subs), 1000);
      subs.subscribe(creator, tierId);
      vm.stopPrank();

      vm.startPrank(creator);
      vm.expectRevert(TokenNotAllowed.selector);
      subs.updateTier(tierId, 1000, 30 days, "tier://erc20", address(token));
      vm.stopPrank();
  }
  }
