// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {Marketplace} from "../src/Marketplace.sol";
import {AccessPass} from "../src/AccessPass.sol";

contract MarketplaceConstraintsTest is Test {
    Marketplace market;
    AccessPass pass;

    address owner = address(0xA11CE);
    address seller = address(0xB0B);
    address creator = address(0xC0FFEE);

    function setUp() public {
        market = new Marketplace(owner, owner, 200);
        pass = new AccessPass("Access", "PASS", "ipfs://base/", owner);
        // enable min duration 200s
        vm.prank(owner);
        market.setMinDurationRemainingSeconds(200);
        // set manager to seller so they can mint/update
        vm.prank(owner);
        pass.setManager(seller);
        // seller mints their pass with creator identity
        vm.prank(seller);
        pass.mintIfNone(seller, creator);
        // initial expiry short (100s)
        vm.prank(seller);
        pass.updateOnRenew(seller, creator, uint64(block.timestamp + 100));
        // approve market
        uint256 tid = pass.tokenIdFor(seller, creator);
        vm.prank(seller);
        pass.approve(address(market), tid);
    }

    function testRevertOnMinDurationTooLow() public {
        uint256 tid = pass.tokenIdFor(seller, creator);
        // grant creator approval so min-duration check is evaluated
        vm.prank(creator);
        market.setCreatorListingAllowed(true);
        vm.expectRevert(bytes("min duration"));
        vm.prank(seller);
        market.list(address(pass), tid, 1 ether);
    }

    function testRevertOnCreatorNotAllowedAndThenSuccess() public {
        uint256 tid = pass.tokenIdFor(seller, creator);
        // extend expiry enough but creator not yet allowed
        vm.prank(seller);
        pass.updateOnRenew(seller, creator, uint64(block.timestamp + 1000));
        vm.expectRevert(bytes("creator not allowed"));
        vm.prank(seller);
        market.list(address(pass), tid, 1 ether);
        // approve from creator
        vm.prank(creator);
        market.setCreatorListingAllowed(true);
        // now should succeed
        vm.prank(seller);
        uint256 id = market.list(address(pass), tid, 1 ether);
        assertEq(id, 1);
    }

    function testRevertOnExpired() public {
        uint256 tid = pass.tokenIdFor(seller, creator);
        vm.prank(seller);
        pass.updateOnRenew(seller, creator, uint64(block.timestamp - 1));
        // grant creator approval so expiry check is evaluated
        vm.prank(creator);
        market.setCreatorListingAllowed(true);
        vm.expectRevert(bytes("expired"));
        vm.prank(seller);
        market.list(address(pass), tid, 1 ether);
    }
}
