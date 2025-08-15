// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "openzeppelin-contracts/contracts/token/common/ERC2981.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {Pausable} from "openzeppelin-contracts/contracts/utils/Pausable.sol";

contract GemToken is ERC721, ERC2981, Ownable, Pausable {
    string private _baseTokenURI;
    uint256 private _nextId;

    event BaseURISet(string baseURI);
    event Minted(address indexed to, uint256 indexed tokenId);

    constructor(
        string memory name_,
        string memory symbol_,
        string memory baseURI_,
        address royaltyReceiver,
        uint96 royaltyBps,
        address initialOwner
    ) ERC721(name_, symbol_) Ownable(initialOwner) {
        _baseTokenURI = baseURI_;
        _setDefaultRoyalty(royaltyReceiver, royaltyBps);
        _nextId = 1;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function setBaseURI(string memory baseURI_) external onlyOwner {
        _baseTokenURI = baseURI_;
        emit BaseURISet(baseURI_);
    }

    function setDefaultRoyalty(address receiver, uint96 feeNumerator) external onlyOwner {
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    function mint(address to) external onlyOwner whenNotPaused returns (uint256 tokenId) {
        tokenId = _nextId++;
        _safeMint(to, tokenId);
        emit Minted(to, tokenId);
    }

    function batchMint(address to, uint256 count) external onlyOwner whenNotPaused {
        for (uint256 i = 0; i < count; i++) {
            uint256 tokenId = _nextId++;
            _safeMint(to, tokenId);
            emit Minted(to, tokenId);
        }
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
