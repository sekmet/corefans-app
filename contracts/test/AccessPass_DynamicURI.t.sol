// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol";
import {AccessPass} from "../src/AccessPass.sol";
import {MockAccessPassResolver} from "../src/mocks/MockAccessPassResolver.sol";

contract AccessPassDynamicURITest is Test {
    AccessPass pass;
    MockAccessPassResolver resolver;

    address owner = address(0xA11CE);
    address manager = address(0xB0B5);
    address creator = address(0xC0FFEE);
    address user = address(0xCAFE);
    address user2 = address(0xF00D);

    function setUp() public {
        pass = new AccessPass("AccessPass", "APASS", "ipfs://base/", owner);
        resolver = new MockAccessPassResolver();
        vm.prank(owner);
        pass.setManager(manager);
        vm.prank(owner);
        pass.setResolver(address(resolver));
    }

    function testTokenURIDynamicWithResolverAndTier() public {
        uint64 exp = uint64(block.timestamp + 30 days);
        uint256 tierId = 3;

        vm.prank(manager);
        pass.updateOnRenewWithTier(user, creator, exp, tierId); // also mints if none

        uint256 tid = pass.tokenIdFor(user, creator);
        string memory uri = pass.tokenURI(tid);
        // expected mock format: mock://<tier>/<expiry>
        string memory expected = string(abi.encodePacked("mock://", Strings.toString(tierId), "/", Strings.toString(uint256(exp))));
        assertEq(uri, expected, "resolver tokenURI mismatch");
    }

    function testBatchUpdateAndBaseURIFallback() public {
        // unset resolver -> fallback to baseURI + tokenId
        vm.prank(owner);
        pass.setResolver(address(0));

        address[] memory users = new address[](2);
        users[0] = user;
        users[1] = user2;
        uint64[] memory exps = new uint64[](2);
        exps[0] = uint64(block.timestamp + 10 days);
        exps[1] = uint64(block.timestamp + 20 days);
        uint256[] memory tiers = new uint256[](2);
        tiers[0] = 1;
        tiers[1] = 2;

        vm.prank(manager);
        pass.batchUpdateOnRenewWithTier(creator, users, exps, tiers);

        uint256 tid1 = pass.tokenIdFor(user, creator);
        uint256 tid2 = pass.tokenIdFor(user2, creator);

        assertEq(pass.expiryByToken(tid1), exps[0], "expiry1");
        assertEq(pass.expiryByToken(tid2), exps[1], "expiry2");
        assertEq(pass.lastTierIdByToken(tid1), tiers[0], "tier1");
        assertEq(pass.lastTierIdByToken(tid2), tiers[1], "tier2");

        // Fallback tokenURI should be base + tokenId
        string memory base1 = string(abi.encodePacked("ipfs://base/", Strings.toString(tid1)));
        string memory base2 = string(abi.encodePacked("ipfs://base/", Strings.toString(tid2)));
        assertEq(pass.tokenURI(tid1), base1, "base uri 1");
        assertEq(pass.tokenURI(tid2), base2, "base uri 2");
    }
}
