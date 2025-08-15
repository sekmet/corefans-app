// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ICreatorRegistry {
    function isCreator(address) external view returns (bool);
    function getPayoutAddress(address creator) external view returns (address);
    
    // Operator delegation
    function isOperator(address creator, address operator) external view returns (bool);
    function getCreatorForOperator(address operator) external view returns (address);
}
