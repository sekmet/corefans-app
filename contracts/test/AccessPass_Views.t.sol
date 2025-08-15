// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {AccessPass} from "../src/AccessPass.sol";

contract AccessPass_Views_Test is Test {
    AccessPass pass;
    address owner = address(this);

    function setUp() public {
        pass = new AccessPass("CoreFans Access Pass", "CFPASS", "https://meta.example/", owner);
        pass.setManager(address(this));
    }

    function test_tokenIdFor_and_hasPass_and_expiry() public {
        address user = makeAddr("user");
        address creator = makeAddr("creator");

        // Initially no pass
        uint256 tid = pass.tokenIdFor(user, creator);
        assertEq(tid, uint256(keccak256(abi.encodePacked(user, creator))));
        assertFalse(pass.hasPass(user, creator));

        // Mint and update expiry with tier
        uint64 expiry = uint64(block.timestamp + 30 days);
        uint256 tierId = 1;
        pass.mintIfNone(user, creator);
        pass.updateOnRenewWithTier(user, creator, expiry, tierId);

        // Views and mappings
        assertTrue(pass.hasPass(user, creator));
        assertEq(pass.expiryByToken(tid), expiry);
        assertEq(pass.lastTierIdByToken(tid), tierId);
    }
}
