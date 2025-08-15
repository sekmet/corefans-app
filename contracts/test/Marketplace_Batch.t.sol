// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {Marketplace} from "../src/Marketplace.sol";
import {GemToken} from "../src/GemToken.sol";

contract MarketplaceBatchTest is Test {
    Marketplace market;
    GemToken gem;
    address owner = address(0xA11CE);
    address seller = address(0xB0B);
    address buyer = address(0xCAFE);

    function setUp() public {
        market = new Marketplace(owner, owner, 200);
        gem = new GemToken("Gems", "GEM", "ipfs://base/", owner, 500, owner);
        // Mint two tokens to seller
        vm.startPrank(owner);
        uint256 id1 = gem.mint(seller);
        uint256 id2 = gem.mint(seller);
        vm.stopPrank();
        assertEq(id1, 1);
        assertEq(id2, 2);
        vm.startPrank(seller);
        gem.approve(address(market), 1);
        gem.approve(address(market), 2);
        vm.stopPrank();
    }

    function testListBatchAndBuyBatch() public {
        address[] memory nfts = new address[](2);
        uint256[] memory tokenIds = new uint256[](2);
        uint256[] memory prices = new uint256[](2);
        nfts[0] = address(gem);
        nfts[1] = address(gem);
        tokenIds[0] = 1;
        tokenIds[1] = 2;
        prices[0] = 1 ether;
        prices[1] = 2 ether;

        vm.prank(seller);
        uint256[] memory ids = market.listBatch(nfts, tokenIds, prices);
        assertEq(ids.length, 2);
        assertEq(ids[0], 1);
        assertEq(ids[1], 2);

        vm.deal(buyer, 5 ether);
        vm.prank(buyer);
        market.buyBatch{value: 3 ether}(ids);

        assertEq(gem.ownerOf(1), buyer);
        assertEq(gem.ownerOf(2), buyer);
    }
}
