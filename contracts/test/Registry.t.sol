// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {CreatorRegistry} from "../src/CreatorRegistry.sol";

contract RegistryTest is Test {
    CreatorRegistry reg;
    address owner = address(0xA11CE);
    address creator = address(0xC0FFEE);
    address payout = address(0xBEEF);

    function setUp() public {
        reg = new CreatorRegistry(owner);
    }

    function testRegisterAndPayout() public {
        vm.prank(owner);
        reg.registerCreator(creator, payout);
        assertTrue(reg.isCreator(creator));
        assertEq(reg.getPayoutAddress(creator), payout);

        vm.prank(creator);
        reg.setPayoutAddress(address(0x1234));
        assertEq(reg.getPayoutAddress(creator), address(0x1234));
    }
}
