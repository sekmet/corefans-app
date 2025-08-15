// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAccessPass} from "../interfaces/IAccessPass.sol";

contract MockAccessPass is IAccessPass {
    event MintIfNone(address to, address creator);
    event UpdateOnRenew(address to, address creator, uint64 newExpiry);

    // naive tracking; real AccessPass would be ERC721
    mapping(bytes32 => bool) public hasPass;

    function mintIfNone(address to, address creator) external {
        bytes32 key = keccak256(abi.encodePacked(to, creator));
        if (!hasPass[key]) {
            hasPass[key] = true;
            emit MintIfNone(to, creator);
        }
    }

    function updateOnRenew(address to, address creator, uint64 newExpiry) external {
        emit UpdateOnRenew(to, creator, newExpiry);
    }
}
