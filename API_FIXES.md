# API Fixes for Hanging and Missing Trades Issues

## Issues Fixed

### 1. **Hanging/Timeout Issues**
- ✅ Added **timeout handling** to all fetch requests:
  - Proxy wallet resolution: 10 second timeout
  - Trades fetching: 30 second timeout per page
  - Market metadata: 10 second timeout
  - Frontend requests: 60 second timeout total
- ✅ Requests will now abort instead of hanging indefinitely
- ✅ Better error messages for timeout scenarios

### 2. **Missing Trades/Proxy Wallet Issues**
- ✅ Added **comprehensive logging** throughout the API pipeline:
  - Logs when resolving proxy wallet
  - Logs when fetching trades (with page numbers)
  - Logs response formats and counts
  - Logs any errors or unexpected responses
- ✅ Better error handling with detailed error messages
- ✅ Proper handling of empty trade results with helpful messages

### 3. **Debugging Tools**
- ✅ Created `/api/debug` endpoint to test API responses:
  - `GET /api/debug?test=proxy&wallet=0x...` - Test proxy wallet API
  - `GET /api/debug?test=trades&wallet=0x...` - Test trades API
- ✅ Console logging enabled throughout for debugging

## How to Debug Issues

### Check Server Logs
When you run `npm run dev`, check the terminal for logs like:
```
[API] Resolving proxy wallet for: 0x...
[API] Proxy wallet response: { wallet: '0x...', proxyWallet: '0x...' }
[API] Fetching trades page 1 for user: 0x...
[API] Found 50 trades on page 1
```

### Test API Endpoints Directly

1. **Test Proxy Wallet Resolution:**
   ```
   http://localhost:3000/api/debug?test=proxy&wallet=0xYourWalletAddress
   ```
   This will show you the actual API response from Polymarket.

2. **Test Trades API:**
   ```
   http://localhost:3000/api/debug?test=trades&wallet=0xYourWalletAddress
   ```
   This will show you the actual trades API response format.

3. **Test Full PnL Endpoint:**
   ```
   http://localhost:3000/api/pnl?wallet=0xYourWalletAddress
   ```
   Check the browser console (F12) for detailed logs.

### Check Browser Console
Open browser DevTools (F12) and check the Console tab for:
- Frontend logs showing wallet resolution
- API response details
- Any error messages

## Common Issues and Solutions

### Issue: "No trades found"
**Possible causes:**
1. Wallet has no trades in Polymarket
2. Date range doesn't include any trades
3. Wallet uses a proxy that wasn't resolved correctly
4. API endpoint format may be incorrect

**Debug steps:**
1. Check server logs for proxy wallet resolution
2. Use `/api/debug` endpoint to test APIs directly
3. Try a known active Polymarket wallet address
4. Expand the date range (try last 365 days)

### Issue: Request hangs/times out
**Fixed by:**
- Timeouts are now in place (10-30 seconds)
- Requests will abort and show an error instead of hanging
- Check server logs to see which API call is slow

### Issue: Proxy wallet not found
**Possible causes:**
1. Wallet doesn't use a proxy wallet (normal for some wallets)
2. Gamma API endpoint may have changed
3. API may require authentication

**Debug steps:**
1. Test with `/api/debug?test=proxy&wallet=0x...`
2. Check if the API response format matches what we expect
3. The app will fall back to using the input wallet directly

## Next Steps

1. **Test with a known wallet:**
   - Use a wallet address that you know has Polymarket trades
   - Check server logs to see what's happening

2. **Check API endpoints:**
   - The Polymarket APIs may have changed
   - Use the debug endpoint to verify the actual API responses

3. **Review logs:**
   - All API calls now log their progress
   - Check terminal output when making requests

4. **If APIs are wrong:**
   - The debug endpoint will show the actual API responses
   - We may need to update the API endpoints or response parsing

## Files Modified

- `lib/api-client.ts` - Added timeouts, logging, better error handling
- `app/api/pnl/route.ts` - Added logging, better empty result handling
- `app/results/page.tsx` - Added timeout, better error messages, progress info
- `app/api/debug/route.ts` - NEW: Debug endpoint for testing APIs

## Testing

To test the fixes:
1. Start the server: `npm run dev`
2. Enter a wallet address in the UI
3. Watch the terminal for detailed logs
4. Check browser console (F12) for frontend logs
5. Use `/api/debug` to test APIs directly
