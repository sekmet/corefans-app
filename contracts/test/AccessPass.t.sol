// SPDX-License-Identifier: MIT
  pragma solidity ^0.8.24;

  import "forge-std/Test.sol";
  import {AccessPass} from "../src/AccessPass.sol";

  contract AccessPassTest is Test {
      AccessPass pass;
      address owner = address(0xA11CE);
      address manager = address(0xB0B);
      address user = address(0xCAFE);
      address creator = address(0xC0FFEE);

  function setUp() public {
      pass = new AccessPass("AccessPass", "APASS", "ipfs://base/", owner);
      vm.prank(owner);
      pass.setManager(manager);
  }

  function testMintAndUpdate() public {
      uint256 tid = pass.tokenIdFor(user, creator);
      assertEq(tid, uint256(keccak256(abi.encodePacked(user, creator))));

      // non-manager cannot mint
      vm.expectRevert(bytes("not manager"));
      pass.mintIfNone(user, creator);

      // manager mints
      vm.prank(manager);
      pass.mintIfNone(user, creator);
      assertTrue(pass.hasPass(user, creator));
      assertEq(pass.ownerOf(tid), user);

      // mint again is idempotent
      vm.prank(manager);
      pass.mintIfNone(user, creator);
      assertEq(pass.ownerOf(tid), user);

      // update expiry
      vm.prank(manager);
      pass.updateOnRenew(user, creator, uint64(block.timestamp + 30 days));
      assertEq(pass.expiryByToken(tid), uint64(block.timestamp + 30 days));

      // non-manager cannot update
      vm.expectRevert(bytes("not manager"));
      pass.updateOnRenew(user, creator, uint64(block.timestamp + 60 days));
  }

  function testPauseBlocksMint() public {
      vm.prank(owner);
      pass.pause();

      vm.prank(manager);
      vm.expectRevert(); // Pausable revert
      pass.mintIfNone(user, creator);

      vm.prank(owner);
      pass.unpause();

      vm.prank(manager);
      pass.mintIfNone(user, creator);
      assertTrue(pass.hasPass(user, creator));
  }
  }
