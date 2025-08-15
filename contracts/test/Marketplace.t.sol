// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {Marketplace} from "../src/Marketplace.sol";
import {GemToken} from "../src/GemToken.sol";

contract MarketplaceTest is Test {
    Marketplace market;
    GemToken gem;
    address owner = address(0xA11CE);
    address seller = address(0xB0B);
    address buyer = address(0xCAFE);

    function setUp() public {
        market = new Marketplace(owner, owner, 200);
        gem = new GemToken("Gems", "GEM", "ipfs://base/", owner, 500, owner);
        vm.startPrank(owner);
        uint256 id = gem.mint(seller);
        vm.stopPrank();

        vm.prank(seller);
        // approve market
        // Since onlyOwner can mint, seller owns id=1 after mint above
        gem.approve(address(market), 1);
    }

    function testListAndBuy() public {
        vm.prank(seller);
        uint256 listingId = market.list(address(gem), 1, 1 ether);

        vm.deal(buyer, 2 ether);
        vm.prank(buyer);
        market.buy{value: 1 ether}(listingId);

        assertEq(gem.ownerOf(1), buyer);
    }
}
