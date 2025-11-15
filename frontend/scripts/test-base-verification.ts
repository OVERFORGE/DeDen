// File: scripts/test-base-verification.ts
// Diagnostic script to test Base network transaction verification
// Run with: npx tsx scripts/test-base-verification.ts <txHash>

import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

// Your Base USDC configuration
const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const TREASURY_ADDRESS = '0x317914bc4db3f61c0cba933a3e00d7a8bed124a5';
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

async function diagnoseBaseTransaction(txHash: string) {
  console.log('\n🔍 Base Network Transaction Diagnostic Tool');
  console.log('='.repeat(60));
  console.log(`Transaction Hash: ${txHash}`);
  console.log('='.repeat(60));

  // Get Base API key from environment
  const baseApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY_BASE;
  if (!baseApiKey) {
    console.error('\n❌ ERROR: NEXT_PUBLIC_ALCHEMY_API_KEY_BASE not found in environment');
    console.log('Add it to your .env file:');
    console.log('NEXT_PUBLIC_ALCHEMY_API_KEY_BASE=your_key_here\n');
    process.exit(1);
  }

  const rpcUrl = `https://base-mainnet.g.alchemy.com/v2/${baseApiKey}`;
  console.log(`\n📡 RPC URL: ${rpcUrl.substring(0, 50)}...`);

  // Create Base client
  const client = createPublicClient({
    chain: base,
    transport: http(rpcUrl, {
      timeout: 30_000,
      retryCount: 3,
    }),
  });

  try {
    // Test connection
    console.log('\n✅ Testing Base network connection...');
    const blockNumber = await client.getBlockNumber();
    console.log(`   Latest block: ${blockNumber}`);

    // Get transaction receipt
    console.log('\n📥 Fetching transaction receipt...');
    const receipt = await client.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

    if (!receipt) {
      console.error('❌ Transaction not found!');
      return;
    }

    console.log('\n📊 Transaction Details:');
    console.log(`   Status: ${receipt.status}`);
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   From: ${receipt.from}`);
    console.log(`   To: ${receipt.to}`);
    console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
    console.log(`   Total Logs: ${receipt.logs.length}`);

    // Get transaction
    const tx = await client.getTransaction({
      hash: txHash as `0x${string}`,
    });

    console.log(`   Value: ${tx.value} wei`);
    console.log(`   Gas Price: ${tx.gasPrice?.toString()} wei`);

    // Analyze all logs
    console.log('\n📋 Analyzing ALL logs:');
    console.log('='.repeat(60));

    receipt.logs.forEach((log, index) => {
      console.log(`\nLog #${index}:`);
      console.log(`  Address: ${log.address}`);
      console.log(`  Address (lowercase): ${log.address.toLowerCase()}`);
      console.log(`  Is USDC contract: ${log.address.toLowerCase() === BASE_USDC_ADDRESS.toLowerCase()}`);
      console.log(`  Topics (${log.topics.length}):`);
      
      log.topics.forEach((topic, i) => {
        console.log(`    [${i}]: ${topic}`);
        if (i === 0) {
          console.log(`         Is Transfer: ${topic === TRANSFER_TOPIC}`);
        } else if (i === 1) {
          const from = `0x${topic.slice(26)}`;
          console.log(`         From: ${from}`);
        } else if (i === 2) {
          const to = `0x${topic.slice(26)}`;
          console.log(`         To: ${to}`);
          console.log(`         Is Treasury: ${to.toLowerCase() === TREASURY_ADDRESS.toLowerCase()}`);
        }
      });
      
      console.log(`  Data: ${log.data}`);
      
      if (log.data && log.data !== '0x') {
        try {
          const amount = BigInt(log.data);
          console.log(`  Amount (base units): ${amount.toString()}`);
          console.log(`  Amount (USDC): ${Number(amount) / 1e6}`);
        } catch (e) {
          console.log(`  Could not decode amount`);
        }
      }
    });

    // Filter for Transfer events
    console.log('\n\n🎯 Filtering for Transfer Events:');
    console.log('='.repeat(60));

    const transferLogs = receipt.logs.filter((log) => {
      const addressMatch = log.address.toLowerCase() === BASE_USDC_ADDRESS.toLowerCase();
      const topicMatch = log.topics[0] === TRANSFER_TOPIC;
      return addressMatch && topicMatch;
    });

    console.log(`Found ${transferLogs.length} Transfer event(s) from USDC token`);

    if (transferLogs.length === 0) {
      console.log('\n❌ NO TRANSFER EVENTS FOUND!');
      console.log('\nPossible reasons:');
      console.log('  1. Wrong token contract was called');
      console.log('  2. Transaction is not a token transfer');
      console.log('  3. Token address mismatch');
      
      // Check if any logs are from similar addresses
      const similarAddresses = receipt.logs.filter(log => 
        log.address.toLowerCase().includes('833589') || 
        log.topics[0] === TRANSFER_TOPIC
      );
      
      if (similarAddresses.length > 0) {
        console.log('\n🔍 Found similar logs:');
        similarAddresses.forEach((log, i) => {
          console.log(`  ${i}: ${log.address} - ${log.topics[0]}`);
        });
      }
    } else {
      // Analyze each transfer
      transferLogs.forEach((log, index) => {
        console.log(`\n✅ Transfer Event #${index + 1}:`);
        
        const from = `0x${log.topics[1]?.slice(26)}`;
        const to = `0x${log.topics[2]?.slice(26)}`;
        const amount = BigInt(log.data);
        
        console.log(`   From: ${from}`);
        console.log(`   To: ${to}`);
        console.log(`   Amount: ${amount.toString()} base units`);
        console.log(`   Amount: ${Number(amount) / 1e6} USDC`);
        console.log(`   To Treasury: ${to.toLowerCase() === TREASURY_ADDRESS.toLowerCase() ? '✅ YES' : '❌ NO'}`);
        
        if (to.toLowerCase() === TREASURY_ADDRESS.toLowerCase()) {
          console.log('\n   🎉 VALID PAYMENT TO TREASURY!');
        } else {
          console.log(`\n   ⚠️  Payment went to different address`);
          console.log(`   Expected: ${TREASURY_ADDRESS.toLowerCase()}`);
          console.log(`   Actual:   ${to.toLowerCase()}`);
        }
      });
    }

    // Summary
    console.log('\n\n📝 SUMMARY:');
    console.log('='.repeat(60));
    console.log(`Transaction Status: ${receipt.status === 'success' ? '✅ Success' : '❌ Failed'}`);
    console.log(`Total Logs: ${receipt.logs.length}`);
    console.log(`Transfer Events: ${transferLogs.length}`);
    
    const validTransfers = transferLogs.filter(log => {
      const to = `0x${log.topics[2]?.slice(26)}`;
      return to.toLowerCase() === TREASURY_ADDRESS.toLowerCase();
    });
    
    console.log(`Valid Payments to Treasury: ${validTransfers.length}`);
    
    if (validTransfers.length > 0) {
      console.log('\n✅✅✅ VERIFICATION SHOULD PASS ✅✅✅');
    } else {
      console.log('\n❌ VERIFICATION WILL FAIL');
      console.log('\nCheck:');
      console.log('  1. Token address in config matches actual token');
      console.log('  2. Treasury address is correct');
      console.log('  3. User sent to correct address');
    }
    
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    }
  }
}

// Get txHash from command line
const txHash = process.argv[2];

if (!txHash) {
  console.log('\nUsage: npx tsx scripts/test-base-verification.ts <txHash>');
  console.log('\nExample:');
  console.log('npx tsx scripts/test-base-verification.ts 0x1a9ac034b1a0684fd8175017cb4db2b554dbb30036af1ab4f288c4f100718be7');
  process.exit(1);
}

if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
  console.error('\n❌ Invalid transaction hash format');
  console.log('Expected: 0x followed by 64 hexadecimal characters');
  process.exit(1);
}

// Run diagnostic
diagnoseBaseTransaction(txHash).catch(console.error);