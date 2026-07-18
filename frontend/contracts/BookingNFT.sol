// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract BookingNFT is ERC721, ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;

    // Mapping from booking ID to token ID
    mapping(string => uint256) public bookingToToken;
    // Mapping from token ID to booking ID
    mapping(uint256 => string) public tokenToBooking;

    // Event emitted when NFT is minted for a booking
    event BookingNFTMinted(
        address indexed recipient,
        uint256 indexed tokenId,
        string bookingId,
        string stayTitle
    );

    // ✅ FIX: Pass msg.sender to Ownable constructor
    constructor() ERC721("Decentralized Den Ticket", "DEDEN") Ownable(msg.sender) {
        _tokenIdCounter = 1; // Start from 1 instead of 0
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