// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract EduAccessControl is AccessControl, ERC721, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant EXAM_CENTER_ROLE = keccak256("EXAM_CENTER_ROLE");

    // Legacy aliases to keep backward compatibility with existing scripts/frontends.
    bytes32 public constant TEACHER_ROLE = ADMIN_ROLE;
    bytes32 public constant STUDENT_ROLE = EXAM_CENTER_ROLE;

    struct PendingContent {
        string ipfsHash;
        uint256 approvals;
        uint256 releaseTime;
        bool released;
    }

    uint256 public nextTokenId;
    uint256 private _contentNonce;

    mapping(uint256 => PendingContent) private _contents;
    mapping(uint256 => bool) public contentExists;
    uint256[] private _contentIds;

    mapping(uint256 => uint256) public tokenToContentId;
    mapping(uint256 => mapping(address => bool)) public hasContentAccess;

    event ContentUploaded(
        uint256 indexed contentId,
        address indexed uploadedBy,
        string ipfsHash,
        uint256 releaseTime
    );
    event ContentApproved(uint256 indexed contentId, address indexed approvedBy, uint256 approvals);
    event ContentReleased(uint256 indexed contentId, uint256 releaseTime);
    event AccessGranted(uint256 indexed contentId, address indexed student, uint256 indexed tokenId);

    error InvalidAddress();
    error InvalidIpfsHash();
    error InvalidReleaseTime();
    error ContentNotFound(uint256 contentId);
    error ContentNotReleased(uint256 contentId);
    error AccessAlreadyGranted(uint256 contentId, address student);
    error ExamCenterRoleRequired(address account);
    error NoAccessNFT(uint256 contentId, address student);
    error ContentLocked(uint256 contentId, uint256 releaseTime, uint256 currentTime);

    constructor(address initialAdmin) ERC721("EduAccessPass", "EDUPASS") {
        if (initialAdmin == address(0)) revert InvalidAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(ADMIN_ROLE, initialAdmin);

        _setRoleAdmin(ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(EXAM_CENTER_ROLE, ADMIN_ROLE);
    }

    function uploadContent(
        string calldata ipfsHash,
        uint256 releaseTime
    ) external onlyRole(ADMIN_ROLE) returns (uint256 contentId) {
        if (bytes(ipfsHash).length == 0) revert InvalidIpfsHash();
        if (releaseTime <= block.timestamp) revert InvalidReleaseTime();

        // Pseudo-random, collision-resistant ID for operator-facing workflows.
        contentId = uint256(
            keccak256(
                abi.encodePacked(block.prevrandao, block.timestamp, msg.sender, ipfsHash, releaseTime, _contentNonce)
            )
        );

        while (contentExists[contentId]) {
            unchecked {
                _contentNonce += 1;
            }
            contentId = uint256(
                keccak256(
                    abi.encodePacked(
                        block.prevrandao,
                        block.timestamp,
                        msg.sender,
                        ipfsHash,
                        releaseTime,
                        _contentNonce
                    )
                )
            );
        }

        unchecked {
            _contentNonce += 1;
        }

        _contents[contentId] = PendingContent({
            ipfsHash: ipfsHash,
            approvals: 1,
            releaseTime: releaseTime,
            released: true
        });
        contentExists[contentId] = true;
        _contentIds.push(contentId);

        emit ContentUploaded(contentId, msg.sender, ipfsHash, releaseTime);
        emit ContentReleased(contentId, releaseTime);
    }

    // Kept for compatibility with old UI; no-op under one-step publish model.
    function approveContent(uint256 contentId) external onlyRole(ADMIN_ROLE) {
        PendingContent storage content = _getExistingContent(contentId);
        unchecked {
            content.approvals += 1;
        }
        emit ContentApproved(contentId, msg.sender, content.approvals);
    }

    // Kept for compatibility with old UI; content is already released at upload time.
    function finalizeContent(uint256 contentId) external onlyRole(ADMIN_ROLE) {
        PendingContent storage content = _getExistingContent(contentId);
        content.released = true;
        emit ContentReleased(contentId, content.releaseTime);
    }

    function mintAccessNFT(address student, uint256 contentId) external onlyRole(ADMIN_ROLE) nonReentrant {
        if (student == address(0)) revert InvalidAddress();
        if (!hasRole(EXAM_CENTER_ROLE, student)) revert ExamCenterRoleRequired(student);

        PendingContent storage content = _getExistingContent(contentId);
        if (!content.released) revert ContentNotReleased(contentId);
        if (hasContentAccess[contentId][student]) revert AccessAlreadyGranted(contentId, student);

        uint256 tokenId = nextTokenId;
        unchecked {
            nextTokenId = tokenId + 1;
        }

        hasContentAccess[contentId][student] = true;
        tokenToContentId[tokenId] = contentId;

        _safeMint(student, tokenId);

        emit AccessGranted(contentId, student, tokenId);
    }

    function getContent(
        uint256 contentId
    ) external view onlyRole(EXAM_CENTER_ROLE) returns (string memory ipfsHash, uint256 releaseTime) {
        PendingContent storage content = _getExistingContent(contentId);

        if (!content.released) revert ContentNotReleased(contentId);
        if (block.timestamp < content.releaseTime) {
            revert ContentLocked(contentId, content.releaseTime, block.timestamp);
        }
        if (!hasContentAccess[contentId][msg.sender]) revert NoAccessNFT(contentId, msg.sender);

        return (content.ipfsHash, content.releaseTime);
    }

    function getPendingContent(uint256 contentId) external view returns (PendingContent memory) {
        return _getExistingContent(contentId);
    }

    function getAllContentIds() external view returns (uint256[] memory) {
        return _contentIds;
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(AccessControl, ERC721) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _getExistingContent(uint256 contentId) internal view returns (PendingContent storage content) {
        if (!contentExists[contentId]) revert ContentNotFound(contentId);
        return _contents[contentId];
    }
}