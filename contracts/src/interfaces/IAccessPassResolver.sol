// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAccessPassResolver {
    function tokenURI(
        uint256 tokenId,
        address user,
        address creator,
        uint64 expiry,
        uint256 lastTierId
    ) external view returns (string memory);
}
