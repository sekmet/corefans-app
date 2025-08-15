// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {EIP712} from "openzeppelin-contracts/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";

/// @notice Minimal DAI-like permit token used for tests
contract MockDaiLikeERC20 is ERC20, EIP712 {
    mapping(address => uint256) public nonces;

    bytes32 public constant PERMIT_TYPEHASH = keccak256(
        "Permit(address holder,address spender,uint256 nonce,uint256 expiry,bool allowed)"
    );

    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) EIP712(name_, "1") {}

    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function permit(
        address holder,
        address spender,
        uint256 nonce,
        uint256 expiry,
        bool allowed,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(holder != address(0) && spender != address(0), "zero");
        require(expiry == 0 || block.timestamp <= expiry, "expired");
        require(nonce == nonces[holder], "bad nonce");

        bytes32 structHash = keccak256(abi.encode(
            PERMIT_TYPEHASH,
            holder,
            spender,
            nonce,
            expiry,
            allowed
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, v, r, s);
        require(signer == holder, "bad sig");

        unchecked { nonces[holder] = nonce + 1; }
        _approve(holder, spender, allowed ? type(uint256).max : 0);
    }
}
