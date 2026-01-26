// Test script to debug wallet 0xd8c4d45000b7976d897ab79c21780e46faaa848d
// Run with: node test-wallet-debug.js

const wallet = '0xd8c4d45000b7976d897ab79c21780e46faaa848d';
const DATA_API_V1_BASE = 'https://data-api.polymarket.com/v1';

async function testClosedPositions() {
  console.log(`\n=== Testing Closed Positions API ===`);
  console.log(`Wallet: ${wallet}\n`);
  
  let offset = 0;
  const pageSize = 50;
  let totalPositions = 0;
  let allPositions = [];
  
  while (offset < 10000) { // Check up to 10000 positions to find high-value wins
    try {
      const params = new URLSearchParams({
        user: wallet.toLowerCase(),
        limit: pageSize.toString(),
        offset: offset.toString(),
        sortBy: 'TIMESTAMP',
        sortDirection: 'DESC',
      });
      
      const response = await fetch(`${DATA_API_V1_BASE}/closed-positions?${params.toString()}`, {
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        console.error(`Error at offset ${offset}: ${response.status} ${response.statusText}`);
        break;
      }
      
      const data = await response.json();
      console.log(`Offset ${offset}: Found ${data.length} positions`);
      
      if (data.length === 0) {
        break;
      }
      
      // Log first few positions for debugging
      if (offset === 0 && data.length > 0) {
        console.log(`\n=== Sample Position (first one) ===`);
        console.log(JSON.stringify(data[0], null, 2));
        console.log(`\n=== Position Summary ===`);
        data.slice(0, 5).forEach((pos, i) => {
          console.log(`${i + 1}. ${pos.title || pos.slug || 'Unknown'}`);
          console.log(`   Realized PnL: $${pos.realizedPnl?.toFixed(2) || 'N/A'}`);
          console.log(`   Total Bought: ${pos.totalBought || 'N/A'}`);
          console.log(`   Avg Price: $${pos.avgPrice?.toFixed(4) || 'N/A'}`);
          console.log(`   Current Price: $${pos.curPrice?.toFixed(4) || 'N/A'}`);
          console.log(`   Timestamp: ${new Date(pos.timestamp * 1000).toISOString()}`);
          console.log('');
        });
      }
      
      allPositions = allPositions.concat(data);
      totalPositions += data.length;
      
      if (data.length < pageSize) {
        break;
      }
      
      offset += pageSize;
    } catch (error) {
      console.error(`Error at offset ${offset}:`, error.message);
      break;
    }
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Total positions found: ${totalPositions}`);
  console.log(`Total realized PnL: $${allPositions.reduce((sum, p) => sum + (p.realizedPnl || 0), 0).toFixed(2)}`);
  console.log(`Winning positions: ${allPositions.filter(p => p.realizedPnl > 0).length}`);
  console.log(`Losing positions: ${allPositions.filter(p => p.realizedPnl < 0).length}`);
  
  // Check for high-value wins (like in the image - $5k-$11k range)
  const highWins = allPositions.filter(p => p.realizedPnl > 5000);
  console.log(`\nHigh-value wins (>$5000): ${highWins.length}`);
  if (highWins.length > 0) {
    console.log('\nTop wins:');
    highWins
      .sort((a, b) => b.realizedPnl - a.realizedPnl)
      .slice(0, 20)
      .forEach((pos, i) => {
        const date = new Date(pos.timestamp * 1000).toISOString().split('T')[0];
        console.log(`${i + 1}. $${pos.realizedPnl.toFixed(2)} - ${date} - ${pos.title || pos.slug}`);
      });
  } else {
    console.log('\n⚠️  NO high-value wins found! This suggests:');
    console.log('   1. They might be beyond the current offset');
    console.log('   2. They might be in a different proxy wallet');
    console.log('   3. The API might not be returning them');
    
    // Check for any wins at all
    const allWins = allPositions.filter(p => p.realizedPnl > 0).sort((a, b) => b.realizedPnl - a.realizedPnl);
    console.log(`\nTop 10 wins (any value):`);
    allWins.slice(0, 10).forEach((pos, i) => {
      const date = new Date(pos.timestamp * 1000).toISOString().split('T')[0];
      console.log(`${i + 1}. $${pos.realizedPnl.toFixed(2)} - ${date} - ${pos.title || pos.slug}`);
    });
  }
  
  // Also check proxy wallet from first position
  if (allPositions.length > 0 && allPositions[0].proxyWallet) {
    console.log(`\n⚠️  Proxy wallet detected: ${allPositions[0].proxyWallet}`);
    console.log(`   Input wallet: ${wallet}`);
    if (allPositions[0].proxyWallet.toLowerCase() !== wallet.toLowerCase()) {
      console.log(`   ⚠️  WALLET MISMATCH! Should check proxy wallet too.`);
    }
  }
}

// Also test trades API to see if we're missing anything
async function testTradesAPI() {
  console.log(`\n=== Testing Trades API ===`);
  console.log(`Wallet: ${wallet}\n`);
  
  try {
    const params = new URLSearchParams({
      maker: wallet.toLowerCase(),
      limit: '100',
    });
    
    const response = await fetch(`https://data-api.polymarket.com/trades?${params.toString()}`, {
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error(`Error: ${response.status} ${response.statusText}`);
      return;
    }
    
    const data = await response.json();
    console.log(`Total trades found: ${data.length}`);
    
    if (data.length > 0) {
      console.log(`\n=== Sample Trade ===`);
      console.log(JSON.stringify(data[0], null, 2));
    }
  } catch (error) {
    console.error(`Error:`, error.message);
  }
}

// Run tests
(async () => {
  await testClosedPositions();
  await testTradesAPI();
})();
