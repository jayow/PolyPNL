# Poly PNL - Polymarket Realized PnL Tracker

A Next.js web application that tracks your realized profit and loss from Polymarket trades. This tool fetches real trade data from Polymarket APIs and computes realized PnL using FIFO (First In First Out) accounting.

## Features

- **Proxy Wallet Resolution**: Automatically resolves Polymarket proxy wallets
- **Real Trade Data**: Fetches live data from Polymarket APIs
- **FIFO PnL Calculation**: Computes realized PnL using FIFO lot matching
- **Comprehensive Table**: Shows entry, exit, size, PnL, and market details
- **Summary Statistics**: Total PnL, win rate, average PnL, biggest wins/losses
- **Filters**: Search by event/market title, filter by positive/negative PnL
- **CSV Export**: Download position data as CSV
- **Date Range Selection**: Analyze trades for any date range (defaults to last 90 days)

## Prerequisites

- Node.js 18+ and npm
- A Polymarket wallet address

## Installation

1. Clone or download this repository

2. Install dependencies:
```bash
npm install
```

## Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Enter Wallet Address**: Input your Ethereum wallet address on the home page
2. **Select Date Range**: Choose start and end dates (defaults to last 90 days)
3. **Load Trades**: Click "Load Trades" to fetch and compute PnL
4. **View Results**: See your realized PnL table with summary statistics
5. **Filter & Export**: Use search/filters and export to CSV if needed

### How It Works

1. **Proxy Wallet Resolution**: The app queries the Gamma API to check if your wallet has a Polymarket proxy wallet
2. **Trade Fetching**: Fetches all trades for the resolved wallet from the Polymarket Data API (with pagination)
3. **Market Metadata**: Enriches trades with event/market titles from the Gamma API
4. **PnL Computation**: Processes trades in chronological order using FIFO to match buys with sells
5. **Position Tracking**: Tracks closed positions and calculates realized PnL, entry/exit VWAPs, and statistics

## Testing

Run unit tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

### Test Coverage

The test suite includes:
- Simple buy-then-sell scenarios
- Partial position closes
- Multiple lot management
- Invalid sell scenarios (handled gracefully)
- Multiple partial closes aggregation

## API Routes

### `GET /api/resolve?wallet=<wallet>`

Resolves proxy wallet for a given address.

**Response:**
```json
{
  "inputWallet": "0x...",
  "userAddressUsed": "0x...",
  "proxyWalletFound": true,
  "proxyWallet": "0x..."
}
```

### `GET /api/trades?wallet=<wallet>&start=<iso>&end=<iso>`

Fetches and normalizes all trades for a wallet.

**Response:**
```json
{
  "trades": [...],
  "resolveResult": {...},
  "count": 100
}
```

### `GET /api/pnl?wallet=<wallet>&start=<iso>&end=<iso>&method=fifo`

Computes realized PnL for a wallet.

**Response:**
```json
{
  "positions": [...],
  "summary": {
    "totalRealizedPnL": 1234.56,
    "winrate": 65.5,
    "avgPnLPerPosition": 12.34,
    "totalPositionsClosed": 100,
    "biggestWin": 500.00,
    "biggestLoss": -200.00
  },
  "resolveResult": {...},
  "tradesCount": 500,
  "method": "fifo"
}
```

## Security

This application implements comprehensive security measures:

- **Input Validation**: All API inputs validated using Zod schemas
- **Rate Limiting**: Per-endpoint rate limits to prevent abuse
- **HTML Sanitization**: All HTML content sanitized to prevent XSS
- **Domain Restrictions**: Image proxy restricted to allowed domains
- **Secure Logging**: Sensitive data automatically redacted from logs
- **Error Handling**: Generic error messages, detailed logs server-side only

See [SECURITY.md](./SECURITY.md) for detailed security documentation.

### Environment Variables

For production deployment, configure:

```bash
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
ALLOWED_ORIGIN=https://yourdomain.com
```

## External APIs Used

- **Gamma API** (`https://gamma-api.polymarket.com`): Proxy wallet resolution and market metadata
- **Polymarket Data API** (`https://data-api.polymarket.com`): Trade data

All APIs are public and require no authentication.

## Project Structure

```
poly-pnl/
├── app/
│   ├── api/
│   │   ├── resolve/       # Proxy wallet resolution
│   │   ├── trades/        # Trade fetching
│   │   └── pnl/           # PnL computation
│   ├── results/           # Results page
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── lib/
│   ├── api-client.ts      # API client utilities
│   ├── pnl-engine.ts      # FIFO PnL calculation engine
│   └── __tests__/         # Unit tests
├── types/
│   └── index.ts           # TypeScript type definitions
└── package.json
```

## Data Model

### NormalizedTrade

```typescript
{
  trade_id: string;
  timestamp: string;
  user: string;
  conditionId: string;
  outcome: string;
  side: 'BUY' | 'SELL';
  price: number;
  size: number;
  notional: number;
  fees: number;
  eventTitle?: string;
  marketTitle?: string;
  outcomeName?: string;
}
```

### ClosedPosition

```typescript
{
  conditionId: string;
  outcome: string;
  eventTitle?: string;
  marketTitle?: string;
  outcomeName?: string;
  side: 'Long YES' | 'Long NO';
  openedAt: string;
  closedAt: string | null;
  entryVWAP: number;
  exitVWAP: number;
  size: number;
  realizedPnL: number;
  realizedPnLPercent: number;
  tradesCount: number;
  open_qty_remaining?: number;      // For future open PnL
  avg_entry_price_open?: number;    // For future open PnL
}
```

## Future Enhancements

The data model is designed to support future features:
- **Open PnL**: Track unrealized PnL for open positions using `open_qty_remaining` and `avg_entry_price_open`
- **Average Cost Method**: Alternative to FIFO (currently only FIFO is implemented)
- **Additional Filters**: Filter by event, outcome, date ranges
- **Charts**: Visualize PnL over time

## Troubleshooting

**No trades found:**
- Verify the wallet address is correct
- Check if the wallet has trades in the selected date range
- Some wallets may use proxy wallets - the app should handle this automatically

**API errors:**
- Ensure you have an internet connection
- The Polymarket APIs may be rate-limited - try again after a moment

**Incorrect PnL:**
- Verify the date range includes all relevant trades
- Check if trades span across multiple proxy wallets (not currently supported)

## License

MIT

## Contributing

Contributions welcome! Please feel free to submit a Pull Request.
