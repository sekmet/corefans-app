// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "openzeppelin-contracts/contracts/token/ERC721/IERC721.sol";
import {IERC2981} from "openzeppelin-contracts/contracts/interfaces/IERC2981.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {Pausable} from "openzeppelin-contracts/contracts/utils/Pausable.sol";

contract Marketplace is Ownable, Pausable, ReentrancyGuard {
    struct Listing {
        address seller;
        address nft;
        uint256 tokenId;
        uint256 price; // in wei
        bool active;
    }

    uint96 public platformFeeBps;
    address public platformTreasury;
    uint256 public nextListingId;
    mapping(uint256 => Listing) public listings;
    // Indexing helper: latest listing id for a given NFT token
    mapping(address => mapping(uint256 => uint256)) public listingIdByNFT;
    // AccessPass constraints
    uint64 public minDurationRemainingSeconds; // applies only when listing an AccessPass
    mapping(address => bool) public creatorListingAllowed; // creator => allowed flag for AccessPass listings

    event Listed(uint256 indexed id, address indexed seller, address indexed nft, uint256 tokenId, uint256 price);
    event Canceled(uint256 indexed id);
    event Bought(uint256 indexed id, address indexed buyer, uint256 price, uint256 royalty, uint256 fee, uint256 proceeds);
    event PlatformFeeUpdated(uint96 bps);
    event PlatformTreasuryUpdated(address treasury);
    event MinDurationRemainingUpdated(uint64 seconds_);
    event CreatorListingApprovalUpdated(address indexed creator, bool allowed);

    constructor(address initialOwner, address treasury, uint96 feeBps) Ownable(initialOwner) {
        require(treasury != address(0), "zero");
        platformTreasury = treasury;
        platformFeeBps = feeBps;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function setPlatformFeeBps(uint96 bps) external onlyOwner {
        require(bps <= 2000, "fee too high");
        platformFeeBps = bps;
        emit PlatformFeeUpdated(bps);
    }

    function setPlatformTreasury(address t) external onlyOwner {
        require(t != address(0), "zero");
        platformTreasury = t;
        emit PlatformTreasuryUpdated(t);
    }

    // Global minimum remaining duration constraint for AccessPass listings
    function setMinDurationRemainingSeconds(uint64 seconds_) external onlyOwner {
        minDurationRemainingSeconds = seconds_;
        emit MinDurationRemainingUpdated(seconds_);
    }

    // Creator opt-in/out for listing their AccessPasses
    function setCreatorListingAllowed(bool allowed) external {
        // Any address can toggle for itself; treated as creator identity used by AccessPass
        creatorListingAllowed[msg.sender] = allowed;
        emit CreatorListingApprovalUpdated(msg.sender, allowed);
    }

    function list(address nft, uint256 tokenId, uint256 price) external whenNotPaused returns (uint256 id) {
        id = _list(nft, tokenId, price);
    }

    function _list(address nft, uint256 tokenId, uint256 price) internal returns (uint256 id) {
        require(price > 0, "price");
        IERC721 token = IERC721(nft);
        address owner = token.ownerOf(tokenId);
        require(msg.sender == owner || token.getApproved(tokenId) == msg.sender || token.isApprovedForAll(owner, msg.sender), "not approved");

        // If this looks like an AccessPass, enforce constraints
        _enforceAccessPassConstraintsIfAny(nft, tokenId);

        id = ++nextListingId;
        listings[id] = Listing({
            seller: msg.sender,
            nft: nft,
            tokenId: tokenId,
            price: price,
            active: true
        });

        emit Listed(id, msg.sender, nft, tokenId, price);
        listingIdByNFT[nft][tokenId] = id;
    }

    function cancel(uint256 id) external {
        Listing storage l = listings[id];
        require(l.active, "inactive");
        require(msg.sender == l.seller, "not seller");
        l.active = false;
        emit Canceled(id);
    }

    function buy(uint256 id) external payable nonReentrant whenNotPaused {
        Listing storage l = listings[id];
        require(l.active, "inactive");
        require(msg.value == l.price, "price");
        l.active = false;

        // Transfer NFT first (state change above mitigates reentrancy on listing)
        IERC721 token = IERC721(l.nft);
        token.safeTransferFrom(l.seller, msg.sender, l.tokenId);

        uint256 price = msg.value;

        // Royalty
        (uint256 royaltyAmt, address royaltyReceiver) = _royaltyInfoIfAny(l.nft, l.tokenId, price);

        // Platform fee on remainder after royalty
        uint256 afterRoyalty = price - royaltyAmt;
        uint256 fee = (afterRoyalty * platformFeeBps) / 10_000;
        uint256 proceeds = afterRoyalty - fee;

        // Payouts
        if (royaltyAmt > 0 && royaltyReceiver != address(0)) {
            (bool okR, ) = royaltyReceiver.call{value: royaltyAmt}("");
            require(okR, "royalty fail");
        }
        if (fee > 0) {
            (bool okF, ) = platformTreasury.call{value: fee}("");
            require(okF, "fee fail");
        }
        (bool okS, ) = l.seller.call{value: proceeds}("");
        require(okS, "seller fail");

        emit Bought(id, msg.sender, price, royaltyAmt, fee, proceeds);
    }

    // Batch list multiple NFTs. Reverts on first failure.
    function listBatch(address[] calldata nfts, uint256[] calldata tokenIds, uint256[] calldata prices)
        external
        whenNotPaused
        returns (uint256[] memory ids)
    {
        require(nfts.length == tokenIds.length && nfts.length == prices.length, "len");
        ids = new uint256[](nfts.length);
        for (uint256 i = 0; i < nfts.length; i++) {
            ids[i] = _list(nfts[i], tokenIds[i], prices[i]);
        }
    }

    // Batch buy multiple listings. msg.value must equal the sum of listing prices.
    function buyBatch(uint256[] calldata ids_) external payable nonReentrant whenNotPaused {
        uint256 total;
        for (uint256 i = 0; i < ids_.length; i++) {
            Listing storage l = listings[ids_[i]];
            require(l.active, "inactive");
            total += l.price;
        }
        require(msg.value == total, "price");

        for (uint256 i = 0; i < ids_.length; i++) {
            _buyInto(ids_[i]);
        }
    }

    function _buyInto(uint256 id) internal {
        Listing storage l = listings[id];
        require(l.active, "inactive");
        l.active = false;
        IERC721 token = IERC721(l.nft);
        token.safeTransferFrom(l.seller, msg.sender, l.tokenId);

        uint256 price = l.price;
        (uint256 royaltyAmt, address royaltyReceiver) = _royaltyInfoIfAny(l.nft, l.tokenId, price);
        uint256 afterRoyalty = price - royaltyAmt;
        uint256 fee = (afterRoyalty * platformFeeBps) / 10_000;
        uint256 proceeds = afterRoyalty - fee;

        if (royaltyAmt > 0 && royaltyReceiver != address(0)) {
            (bool okR, ) = royaltyReceiver.call{value: royaltyAmt}("");
            require(okR, "royalty fail");
        }
        if (fee > 0) {
            (bool okF, ) = platformTreasury.call{value: fee}("");
            require(okF, "fee fail");
        }
        (bool okS, ) = l.seller.call{value: proceeds}("");
        require(okS, "seller fail");

        emit Bought(id, msg.sender, price, royaltyAmt, fee, proceeds);
    }

    function _royaltyInfoIfAny(address nft, uint256 tokenId, uint256 salePrice) internal view returns (uint256 amount, address receiver) {
        if (_supports2981(nft)) {
            (receiver, amount) = _royaltyInfo(nft, tokenId, salePrice);
        }
    }

    function _supports2981(address nft) internal view returns (bool) {
        (bool ok, bytes memory data) = nft.staticcall(abi.encodeWithSignature("supportsInterface(bytes4)", 0x2a55205a));
        return ok && data.length == 32 && abi.decode(data, (bool));
    }

    function _royaltyInfo(address nft, uint256 tokenId, uint256 salePrice) internal view returns (address receiver, uint256 amount) {
        (bool ok, bytes memory data) = nft.staticcall(abi.encodeWithSignature("royaltyInfo(uint256,uint256)", tokenId, salePrice));
        if (ok && data.length >= 64) {
            (receiver, amount) = abi.decode(data, (address, uint256));
        }
    }

    // Tries to detect AccessPass by presence of creatorByToken(uint256) and expiryByToken(uint256) getters
    function _enforceAccessPassConstraintsIfAny(address nft, uint256 tokenId) internal view {
        if (minDurationRemainingSeconds == 0) {
            return; // constraints disabled
        }
        // Fetch creator (if interface exists)
        (bool okCreator, bytes memory dataCreator) = nft.staticcall(
            abi.encodeWithSignature("creatorByToken(uint256)", tokenId)
        );
        if (!okCreator || dataCreator.length < 32) {
            return; // not an AccessPass-like NFT
        }
        address creator = abi.decode(dataCreator, (address));
        require(creatorListingAllowed[creator], "creator not allowed");

        // Fetch expiry and enforce remaining duration
        (bool okExpiry, bytes memory dataExpiry) = nft.staticcall(
            abi.encodeWithSignature("expiryByToken(uint256)", tokenId)
        );
        if (!okExpiry || dataExpiry.length < 32) {
            return; // unknown interface; skip enforcement
        }
        uint64 expiry = uint64(abi.decode(dataExpiry, (uint256)));
        require(expiry > block.timestamp, "expired");
        require(expiry - block.timestamp >= minDurationRemainingSeconds, "min duration");
    }
}
