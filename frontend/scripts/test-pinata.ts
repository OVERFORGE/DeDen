// File: scripts/test-nft-mint.ts
import 'dotenv/config';
import { mintBookingNFT } from '../lib/nft-service';

async function main() {
  console.log('🧪 Testing NFT Minting on Arbitrum Mainnet...\n');

  const testBooking = {
    bookingId: 'TEST-' + Date.now(),
    recipientAddress: '0x4fd528898ccFf0d73434f043745Dac511cfCa5dD', // Replace with your test wallet
    chainId: 42161, // Arbitrum One
    stayTitle: 'Luxury Beach Villa',
    location: 'Bali, Indonesia',
    checkInDate: new Date('2025-02-01'),
    checkOutDate: new Date('2025-02-05'),
    guestName: 'Test User',
    numberOfNights: 4,
  };

  console.log('Test Booking:', testBooking);
  console.log('\nMinting NFT...\n');

  const result = await mintBookingNFT(testBooking);

  if (result.success) {
    console.log('\n✅✅✅ NFT MINTED SUCCESSFULLY! ✅✅✅');
    console.log('\nDetails:');
    console.log('- Token ID:', result.tokenId);
    console.log('- Contract:', result.contractAddress);
    console.log('- TX Hash:', result.txHash);
    console.log('\nView on Arbiscan:');
    console.log(`https://arbiscan.io/tx/${result.txHash}`);
    console.log(`\nView NFT on OpenSea:`);
    console.log(`https://opensea.io/assets/arbitrum/${result.contractAddress}/${result.tokenId}`);
  } else {
    console.error('\n❌ NFT Minting Failed!');
    console.error('Error:', result.error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });