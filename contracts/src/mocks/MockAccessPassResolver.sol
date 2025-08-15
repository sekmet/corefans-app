// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAccessPassResolver} from "../interfaces/IAccessPassResolver.sol";
import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol";

contract MockAccessPassResolver is IAccessPassResolver {
    using Strings for uint256;

    function tokenURI(
        uint256 /* tokenId */,
        address /* user */,
        address /* creator */,
        uint64 expiry,
        uint256 lastTierId
    ) external pure returns (string memory) {
        // Simple, deterministic mock URI: mock://<tier>/<expiry>
        return string.concat("mock://", lastTierId.toString(), "/", uint256(expiry).toString());
    }
}
