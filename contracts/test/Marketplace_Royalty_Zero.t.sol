// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {Marketplace} from "../src/Marketplace.sol";
import {GemToken} from "../src/GemToken.sol";

contract MarketplaceRoyaltyZeroTest is Test {
    Marketplace market;
    GemToken gem;
    address owner = address(0xA11CE);
    address seller = address(0xB0B);
    address buyer = address(0xCAFE);
    address treasury = address(0xFEED);

    function setUp() public {
        market = new Marketplace(owner, treasury, 200); // 2%
        gem = new GemToken("Gems", "GEM", "ipfs://base/", owner, 0, owner); // 0% royalty initially
        vm.startPrank(owner);
        gem.setDefaultRoyalty(owner, 0); // explicitly ensure zero royalty
        uint256 id = gem.mint(seller);
        vm.stopPrank();

        vm.prank(seller);
        gem.approve(address(market), 1);
    }

    function testZeroRoyaltyPath() public {
        vm.prank(seller);
        uint256 listingId = market.list(address(gem), 1, 100 ether);

        vm.deal(buyer, 200 ether);

        uint256 treasuryBefore = treasury.balance;
        uint256 sellerBefore = seller.balance;

        // Expect Bought event with royalty=0, fee=2 ether on full price, proceeds=98 ether
        vm.expectEmit(true, true, false, true);
        emit Marketplace.Bought(listingId, buyer, 100 ether, 0, 2 ether, 98 ether);

        vm.prank(buyer);
        market.buy{value: 100 ether}(listingId);

        assertEq(treasury.balance - treasuryBefore, 2 ether);
        assertEq(seller.balance - sellerBefore, 98 ether);
    }
}
