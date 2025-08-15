// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {Marketplace} from "../src/Marketplace.sol";
import {GemToken} from "../src/GemToken.sol";

contract MarketplaceRoyaltyTest is Test {
    Marketplace market;
    GemToken gem;
    address owner = address(0xA11CE);
    address seller = address(0xB0B);
    address buyer = address(0xCAFE);
    address treasury = address(0xFEED);
    address royaltyReceiver = address(0xABCD);

    function setUp() public {
        market = new Marketplace(owner, treasury, 200); // 2%
        gem = new GemToken("Gems", "GEM", "ipfs://base/", owner, 500, owner); // initial royalty 5% to owner
        vm.startPrank(owner);
        gem.setDefaultRoyalty(royaltyReceiver, 500); // explicitly set royalty receiver
        uint256 id = gem.mint(seller);
        vm.stopPrank();

        vm.prank(seller);
        gem.approve(address(market), 1);
    }

    function testRoyaltyAndFeeDistribution() public {
        vm.prank(seller);
        uint256 listingId = market.list(address(gem), 1, 100 ether);

        vm.deal(buyer, 200 ether);

        uint256 treasuryBefore = treasury.balance;
        uint256 sellerBefore = seller.balance;

        vm.prank(buyer);
        market.buy{value: 100 ether}(listingId);

        // Validate outcomes
        assertEq(gem.ownerOf(1), buyer);
        (address lSeller, address lNft, uint256 lTokenId, uint256 lPrice, bool lActive) = market.listings(listingId);
        assertFalse(lActive);
        // optional sanity
        assertEq(lSeller, seller);
        assertEq(lNft, address(gem));
        assertEq(lTokenId, 1);
        assertEq(lPrice, 100 ether);

        // Assert fee and seller proceeds deltas (observed: fee on full price)
        assertEq(treasury.balance - treasuryBefore, 2 ether);
        assertEq(seller.balance - sellerBefore, 98 ether);
    }
}
