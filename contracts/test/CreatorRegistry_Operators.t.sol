// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {CreatorRegistry} from "../src/CreatorRegistry.sol";

contract CreatorRegistry_Operators_Scaffold_Test is Test {
    // mirror events from CreatorRegistry for expectEmit
    event OperatorAdded(address indexed creator, address indexed operator);
    event OperatorRemoved(address indexed creator, address indexed operator);

    CreatorRegistry reg;
    address owner = makeAddr("owner");
    address creator = makeAddr("creator");
    address payout = makeAddr("payout");
    address operator1 = makeAddr("operator1");
    address operator2 = makeAddr("operator2");

    function setUp() public {
        reg = new CreatorRegistry(owner);
        vm.prank(owner);
        reg.registerCreator(creator, payout);
    }

    function test_register_and_update_payout() public {
        // baseline
        assertTrue(reg.isCreator(creator));
        assertEq(reg.getPayoutAddress(creator), payout);

        // creator updates payout
        address newPayout = makeAddr("newPayout");
        vm.prank(creator);
        reg.setPayoutAddress(newPayout);
        assertEq(reg.getPayoutAddress(creator), newPayout);
    }

    function test_add_and_remove_operator_by_creator() public {
        // add by creator
        vm.prank(creator);
        reg.addOperator(operator1);
        assertTrue(reg.isOperator(creator, operator1));

        // remove by creator
        vm.prank(creator);
        reg.removeOperator(operator1);
        assertFalse(reg.isOperator(creator, operator1));
    }

    function test_add_and_remove_operator_by_owner_for_creator() public {
        // owner can add for creator
        vm.prank(owner);
        reg.addOperatorFor(creator, operator2);
        assertTrue(reg.isOperator(creator, operator2));

        // owner can remove for creator
        vm.prank(owner);
        reg.removeOperatorFor(creator, operator2);
        assertFalse(reg.isOperator(creator, operator2));
    }

    function test_only_creator_or_owner_can_update_operators() public {
        address attacker = makeAddr("attacker");

        // non-creator cannot add/remove
        vm.prank(attacker);
        vm.expectRevert("not creator");
        reg.addOperator(operator1);

        vm.prank(attacker);
        vm.expectRevert("not creator");
        reg.removeOperator(operator1);

        // non-owner cannot call owner-only functions
        vm.prank(attacker);
        vm.expectRevert();
        reg.addOperatorFor(creator, operator1);

        vm.prank(attacker);
        vm.expectRevert();
        reg.removeOperatorFor(creator, operator1);
    }

    function test_operator_added_event_emitted() public {
        vm.expectEmit(true, true, false, true);
        // event OperatorAdded(address indexed creator, address indexed operator);
        emit OperatorAdded(creator, operator1);
        vm.prank(creator);
        reg.addOperator(operator1);
    }
}
