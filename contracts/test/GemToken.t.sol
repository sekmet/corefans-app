// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {GemToken} from "../src/GemToken.sol";

contract GemTokenTest is Test {
    GemToken gem;
    address owner = address(0xA11CE);

    function setUp() public {
        gem = new GemToken("Gems", "GEM", "ipfs://base/", owner, 500, owner);
    }

    function testMint() public {
        address recipient = address(0xDEAD);
        vm.prank(owner);
        uint256 id = gem.mint(recipient);
        assertEq(gem.ownerOf(id), recipient);
    }
}
