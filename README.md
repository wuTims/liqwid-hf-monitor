# Liqwid Health Factor Monitor

A Cloudflare Worker that monitors Liqwid Finance loans for a specified Cardano wallet address and sends alerts when health factors drop below configured thresholds. It also updates a Notion database with current asset prices.

## Features

- **Health Factor Monitoring**: Tracks loan health factors and sends alerts when they fall below warning or critical thresholds
- **Telegram Notifications**: Sends alerts to a configured Telegram chat
- **Notion Integration**: Updates a Notion database with current asset prices and exchange rates
- **Scheduled Execution**: Runs automatically on a configurable schedule (default: every 2 minutes)

## Prerequisites

- Node.js 18+ and pnpm
- Cloudflare Workers account
- Telegram Bot Token and Chat ID (for notifications)
- Notion API Token and Database ID (optional, for price tracking)
- Cardano wallet address to monitor

## Setup

1. Clone this repository
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Copy `.env.example` to `.dev.vars` and fill in your values:
   ```bash
   cp .env.example .dev.vars
   ```
4. Configure your environment variables (see Configuration section below)

## Configuration

The following environment variables are required:

```
# Liqwid API
LIQWID_GRAPHQL_URL=https://v2.api.liqwid.finance/graphql

# Health factor thresholds
HF_WARN=1.7  # Warning threshold
HF_CRIT=1.5  # Critical threshold

# Telegram notifications
TELEGRAM_TOKEN=your_telegram_bot_token
CHATID=your_telegram_chat_id

# Cardano wallet to monitor (NOTE: this is the payment address, not the wallet address)
PAYMENT_ADDRESS=your_cardano_payment_address
```

Optional configuration for Notion integration:

```
# Notion integration
NOTION_API_TOKEN=your_notion_api_token
NOTION_PRICES_DB_ID=your_notion_database_id
```

## Development

```bash
# Run tests
pnpm test

# Run locally
pnpm dev

# Build for production
pnpm build
```

## Deployment

Deploy to Cloudflare Workers:

```bash
pnpm deploy
```

Or use wrangler directly:

```bash
wrangler deploy
```

Make sure to set up your secrets in Cloudflare:

```bash
wrangler secret put TELEGRAM_TOKEN
wrangler secret put CHATID
wrangler secret put NOTION_API_TOKEN
```

## Testing

The application includes unit and integration tests:

```bash
# Run all tests
pnpm test

# Run unit tests only
pnpm test:unit

# Run integration tests only
pnpm test:integration
```

## License

MIT License - See [LICENSE](./LICENSE) for details.