// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

contract CreatorRegistry is Ownable {
    mapping(address => bool) private _isCreator;
    mapping(address => address) private _payout;

    // optional metadata
    mapping(address => bool) private _isAI;
    mapping(address => string) private _displayHandle;

    // operator delegation: creator => operator => allowed
    mapping(address => mapping(address => bool)) private _operator;
    // reverse index: operator => creator (single affiliation for simplicity)
    mapping(address => address) private _creatorOfOperator;

    event CreatorRegistered(address indexed creator, address indexed payout);
    event CreatorEnabled(address indexed creator, address indexed payout);
    event CreatorDisabled(address indexed creator);
    event PayoutUpdated(address indexed creator, address indexed payout);
    event CreatorAIUpdated(address indexed creator, bool isAI);
    event CreatorHandleUpdated(address indexed creator, string handle);
    event OperatorAdded(address indexed creator, address indexed operator);
    event OperatorRemoved(address indexed creator, address indexed operator);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function registerCreator(address creator, address payout) external onlyOwner {
        require(creator != address(0) && payout != address(0), "zero");
        require(!_isCreator[creator], "already creator");
        _isCreator[creator] = true;
        _payout[creator] = payout;
        emit CreatorRegistered(creator, payout);
        emit CreatorEnabled(creator, payout);
    }

    function enableCreator(address creator, address payout) external onlyOwner {
        require(creator != address(0) && payout != address(0), "zero");
        _isCreator[creator] = true;
        _payout[creator] = payout;
        emit CreatorEnabled(creator, payout);
    }

    function disableCreator(address creator) external onlyOwner {
        require(_isCreator[creator], "not creator");
        _isCreator[creator] = false;
        emit CreatorDisabled(creator);
    }

    function setPayoutAddress(address payout) external {
        require(_isCreator[msg.sender], "not creator");
        require(payout != address(0), "zero");
        _payout[msg.sender] = payout;
        emit PayoutUpdated(msg.sender, payout);
    }

    // --- Optional metadata setters ---
    function setAI(bool value) external {
        require(_isCreator[msg.sender], "not creator");
        _isAI[msg.sender] = value;
        emit CreatorAIUpdated(msg.sender, value);
    }

    function setAIFor(address creator, bool value) external onlyOwner {
        require(_isCreator[creator], "not creator");
        _isAI[creator] = value;
        emit CreatorAIUpdated(creator, value);
    }

    function setDisplayHandle(string calldata handle) external {
        require(_isCreator[msg.sender], "not creator");
        _displayHandle[msg.sender] = handle;
        emit CreatorHandleUpdated(msg.sender, handle);
    }

    function setDisplayHandleFor(address creator, string calldata handle) external onlyOwner {
        require(_isCreator[creator], "not creator");
        _displayHandle[creator] = handle;
        emit CreatorHandleUpdated(creator, handle);
    }

    function isCreator(address creator) external view returns (bool) {
        return _isCreator[creator];
    }

    function getPayoutAddress(address creator) external view returns (address) {
        return _payout[creator];
    }

    // --- Optional metadata getters ---
    function isAI(address creator) external view returns (bool) {
        return _isAI[creator];
    }

    function displayHandle(address creator) external view returns (string memory) {
        return _displayHandle[creator];
    }

    // --- Operator delegation APIs ---
    function addOperator(address operator) external {
        require(_isCreator[msg.sender], "not creator");
        require(operator != address(0), "zero");
        _setOperator(msg.sender, operator, true);
    }

    function removeOperator(address operator) external {
        require(_isCreator[msg.sender], "not creator");
        require(operator != address(0), "zero");
        _setOperator(msg.sender, operator, false);
    }

    // Owner can assign on behalf of a creator
    function addOperatorFor(address creator, address operator) external onlyOwner {
        require(_isCreator[creator], "not creator");
        require(operator != address(0), "zero");
        _setOperator(creator, operator, true);
    }

    function removeOperatorFor(address creator, address operator) external onlyOwner {
        require(_isCreator[creator], "not creator");
        require(operator != address(0), "zero");
        _setOperator(creator, operator, false);
    }

    function isOperator(address creator, address operator) external view returns (bool) {
        return _operator[creator][operator];
    }

    function getCreatorForOperator(address operator) external view returns (address) {
        return _creatorOfOperator[operator];
    }

    function _setOperator(address creator, address operator, bool allowed) internal {
        // single-affiliation policy: if operator already assigned to a different creator, remove previous link
        address prev = _creatorOfOperator[operator];
        if (prev != address(0) && prev != creator) {
            _operator[prev][operator] = false;
        }
        _operator[creator][operator] = allowed;
        _creatorOfOperator[operator] = allowed ? creator : address(0);
        if (allowed) emit OperatorAdded(creator, operator); else emit OperatorRemoved(creator, operator);
    }
}
