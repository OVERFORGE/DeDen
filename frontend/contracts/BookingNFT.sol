// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract BookingNFT is ERC721, ERC721URIStorage, Ownable, EIP712 {
    uint256 private _tokenIdCounter;

    // Mapping from booking ID to token ID
    mapping(string => uint256) public bookingToToken;
    // Mapping from token ID to booking ID
    mapping(uint256 => string) public tokenToBooking;

    // The backend key that authorizes self-service claims by SIGNING a
    // voucher off-chain (free) rather than broadcasting the mint tx itself
    // (which costs the platform gas on every single booking). Rotatable by
    // the owner without redeploying, in case the signing key is ever
    // replaced.
    address public trustedSigner;

    bytes32 private constant CLAIM_TYPEHASH = keccak256(
        "ClaimVoucher(address recipient,string bookingId,string metadataURI,string stayTitle,uint256 expiry)"
    );

    // Event emitted when NFT is minted for a booking
    event BookingNFTMinted(
        address indexed recipient,
        uint256 indexed tokenId,
        string bookingId,
        string stayTitle
    );

    event TrustedSignerUpdated(address indexed previousSigner, address indexed newSigner);

    // ✅ FIX: Pass msg.sender to Ownable constructor
    constructor()
        ERC721("Decentralized Den Ticket", "DEDEN")
        Ownable(msg.sender)
        EIP712("Decentralized Den Ticket", "1")
    {
        _tokenIdCounter = 1; // Start from 1 instead of 0
        trustedSigner = msg.sender; // sensible default; rotate via setTrustedSigner if needed
    }

    function setTrustedSigner(address newSigner) public onlyOwner {
        require(newSigner != address(0), "Invalid signer address");
        emit TrustedSignerUpdated(trustedSigner, newSigner);
        trustedSigner = newSigner;
    }

    /**
     * @dev Mint NFT for a confirmed booking
     * @param recipient Address of the guest
     * @param bookingId Unique booking identifier
     * @param metadataURI IPFS URI with booking metadata (✅ RENAMED to avoid shadowing)
     * @param stayTitle Title of the stay
     */
    function mintBookingNFT(
        address recipient,
        string memory bookingId,
        string memory metadataURI, // ✅ RENAMED from tokenURI
        string memory stayTitle
    ) public onlyOwner returns (uint256) {
        require(bookingToToken[bookingId] == 0, "NFT already minted for this booking");
        require(recipient != address(0), "Invalid recipient address");

        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;

        _safeMint(recipient, tokenId);
        _setTokenURI(tokenId, metadataURI); // ✅ Using renamed parameter

        bookingToToken[bookingId] = tokenId;
        tokenToBooking[tokenId] = bookingId;

        emit BookingNFTMinted(recipient, tokenId, bookingId, stayTitle);

        return tokenId;
    }

    /**
     * @dev Self-service mint: the GUEST calls this directly with their own
     * wallet and pays their own gas, instead of the platform broadcasting
     * (and paying for) `mintBookingNFT`. Authorization comes from an
     * off-chain EIP-712 signature the backend produces for free once a
     * booking is confirmed — signing costs no gas, only the eventual claim
     * transaction does, and that cost falls on whoever calls this function.
     * @param recipient Address of the guest — must be msg.sender, so a
     *   leaked voucher can't be claimed into a stranger's wallet.
     * @param expiry Unix timestamp after which this voucher can no longer
     *   be claimed, so a voucher isn't usable forever if leaked.
     * @param signature EIP-712 signature over this exact claim, from `trustedSigner`.
     */
    function claimNFT(
        address recipient,
        string memory bookingId,
        string memory metadataURI,
        string memory stayTitle,
        uint256 expiry,
        bytes memory signature
    ) public returns (uint256) {
        require(block.timestamp <= expiry, "Claim voucher expired");
        require(recipient == msg.sender, "Only the recipient can claim their own NFT");
        require(bookingToToken[bookingId] == 0, "NFT already minted for this booking");

        bytes32 structHash = keccak256(
            abi.encode(
                CLAIM_TYPEHASH,
                recipient,
                keccak256(bytes(bookingId)),
                keccak256(bytes(metadataURI)),
                keccak256(bytes(stayTitle)),
                expiry
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        require(signer == trustedSigner, "Invalid or unauthorized claim voucher");

        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;

        _safeMint(recipient, tokenId);
        _setTokenURI(tokenId, metadataURI);

        bookingToToken[bookingId] = tokenId;
        tokenToBooking[tokenId] = bookingId;

        emit BookingNFTMinted(recipient, tokenId, bookingId, stayTitle);

        return tokenId;
    }

    /**
     * @dev Check if booking has an NFT
     */
    function hasBookingNFT(string memory bookingId) public view returns (bool) {
        return bookingToToken[bookingId] != 0;
    }

    /**
     * @dev Get token ID for a booking
     */
    function getTokenIdForBooking(string memory bookingId) public view returns (uint256) {
        require(bookingToToken[bookingId] != 0, "No NFT for this booking");
        return bookingToToken[bookingId];
    }

    /**
     * @dev Get booking ID for a token
     */
    function getBookingIdForToken(uint256 tokenId) public view returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return tokenToBooking[tokenId];
    }

    /**
     * @dev Get total number of NFTs minted
     */
    function totalSupply() public view returns (uint256) {
        return _tokenIdCounter - 1;
    }

    // ✅ FIX: Removed _burn override (not needed for this use case)
    // If you need burn functionality later, we can add it differently

    // ✅ FIX: Correct override for tokenURI
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    // ✅ FIX: Correct override for supportsInterface
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}