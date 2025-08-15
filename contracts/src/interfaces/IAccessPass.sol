// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAccessPass {
    function mintIfNone(address to, address creator) external;
    function updateOnRenew(address to, address creator, uint64 newExpiry) external;
}
