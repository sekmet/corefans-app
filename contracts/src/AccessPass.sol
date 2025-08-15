// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {Pausable} from "openzeppelin-contracts/contracts/utils/Pausable.sol";
import {IAccessPassResolver} from "./interfaces/IAccessPassResolver.sol";

contract AccessPass is ERC721, Ownable, Pausable {
    // Manager (e.g., SubscriptionManager) allowed to mint/update
    address public manager;
    string private _baseTokenURI;
    // Optional resolver to compute dynamic tokenURI
    IAccessPassResolver public resolver;

    // tokenId => expiry
    mapping(uint256 => uint64) public expiryByToken;
    // track existence explicitly
    mapping(uint256 => bool) private existsByToken;
    // tokenId => creator
    mapping(uint256 => address) public creatorByToken;
    // tokenId => last renewed tier id
    mapping(uint256 => uint256) public lastTierIdByToken;

    event ManagerUpdated(address indexed manager);
    event BaseURISet(string baseURI);
    event ResolverUpdated(address indexed resolver);
    event PassMinted(address indexed user, address indexed creator, uint256 indexed tokenId);
    event PassUpdated(address indexed user, address indexed creator, uint256 indexed tokenId, uint64 newExpiry);

    modifier onlyManager() {
        _onlyManager();
        _;
    }
    function _onlyManager() internal view {
        require(msg.sender == manager, "not manager");
    }

    constructor(string memory name_, string memory symbol_, string memory baseURI_, address initialOwner)
        ERC721(name_, symbol_)
        Ownable(initialOwner)
    {
        _baseTokenURI = baseURI_;
    }

    function setManager(address m) external onlyOwner {
        manager = m;
        emit ManagerUpdated(m);
    }

    function setBaseURI(string memory baseURI_) external onlyOwner {
        _baseTokenURI = baseURI_;
        emit BaseURISet(baseURI_);
    }

    function setResolver(address r) external onlyOwner {
        resolver = IAccessPassResolver(r);
        emit ResolverUpdated(r);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // Derive deterministic tokenId for (user, creator)
    function tokenIdFor(address user, address creator) public pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(user, creator)));
    }

    function hasPass(address user, address creator) public view returns (bool) {
        uint256 tid = tokenIdFor(user, creator);
        return existsByToken[tid];
    }

    function mintIfNone(address to, address creator) external onlyManager whenNotPaused {
        uint256 tid = tokenIdFor(to, creator);
        if (existsByToken[tid]) return;
        _safeMint(to, tid);
        existsByToken[tid] = true;
        creatorByToken[tid] = creator;
        emit PassMinted(to, creator, tid);
    }

    function updateOnRenew(address to, address creator, uint64 newExpiry) external onlyManager {
        uint256 tid = tokenIdFor(to, creator);
        require(existsByToken[tid], "no pass");
        expiryByToken[tid] = newExpiry;
        emit PassUpdated(to, creator, tid, newExpiry);
    }

    // Tier-aware update for dynamic metadata
    function updateOnRenewWithTier(address to, address creator, uint64 newExpiry, uint256 tierId) external onlyManager {
        uint256 tid = tokenIdFor(to, creator);
        if (!existsByToken[tid]) {
            // Mint first if not exists
            _safeMint(to, tid);
            existsByToken[tid] = true;
            creatorByToken[tid] = creator;
            emit PassMinted(to, creator, tid);
        }
        expiryByToken[tid] = newExpiry;
        lastTierIdByToken[tid] = tierId;
        emit PassUpdated(to, creator, tid, newExpiry);
    }

    function batchUpdateOnRenewWithTier(
        address creator,
        address[] calldata users,
        uint64[] calldata newExpiries,
        uint256[] calldata tierIds
    ) external onlyManager {
        require(users.length == newExpiries.length && users.length == tierIds.length, "len");
        for (uint256 i = 0; i < users.length; i++) {
            uint256 tid = tokenIdFor(users[i], creator);
            if (!existsByToken[tid]) {
                _safeMint(users[i], tid);
                existsByToken[tid] = true;
                creatorByToken[tid] = creator;
                emit PassMinted(users[i], creator, tid);
            }
            expiryByToken[tid] = newExpiries[i];
            lastTierIdByToken[tid] = tierIds[i];
            emit PassUpdated(users[i], creator, tid, newExpiries[i]);
        }
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (address(resolver) != address(0)) {
            address user = ownerOf(tokenId);
            address creator = creatorByToken[tokenId];
            return resolver.tokenURI(tokenId, user, creator, expiryByToken[tokenId], lastTierIdByToken[tokenId]);
        }
        return super.tokenURI(tokenId);
    }
}
