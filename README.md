# Daily Job Hunt Telegram Bot

A serverless job aggregation and notification system deployed on Vercel. The bot runs once per day, fetches newly posted jobs from multiple platforms, deduplicates them globally, and delivers non-duplicated, relevant job notifications to users via Telegram.

## Features

- ✅ **Multi-platform job aggregation** (RemoteOK, WeWorkRemotely, Wuzzuf)
- ✅ **Global deduplication** at the database level
- ✅ **Idempotent execution** - safe to retry
- ✅ **Environment-driven configuration** - no code changes needed
- ✅ **Daily automated job fetching** via Vercel Cron
- ✅ **Telegram bot integration** for user notifications
- ✅ **Comprehensive logging** and error handling

## Architecture

```
Vercel Daily Cron
    |
    v
/api/cron/daily-job-fetch
    |
    v
Job Source Adapters
    |
    v
Normalization Layer
    |
    v
Global Deduplication Engine
    |
    v
Jobs Database
    |
    v
Notification Dispatcher
    |
    v
Telegram Bot API
```

## Prerequisites

- Node.js 18+ 
- PostgreSQL database
- Telegram Bot Token (from [@BotFather](https://t.me/botfather))
- Vercel account

## Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd job-hunt-bot
npm install
```

### 2. Database Setup

1. Create a PostgreSQL database
2. Copy `.env.example` to `.env` and fill in your `DATABASE_URL`
3. Run the migration:

```bash
npm run build
npm run db:migrate
```

This will create the necessary tables:
- `jobs` - Stores normalized jobs with hash-based deduplication
- `user_job_notifications` - Tracks sent notifications per user
- `users` - Stores Telegram user information

### 3. Telegram Bot Setup

1. Create a bot via [@BotFather](https://t.me/botfather) on Telegram
2. Get your bot token
3. Set up a webhook secret (generate a random string)
4. Add both to your `.env` file

### 4. Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Required
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret
DATABASE_URL=postgresql://user:pass@host:port/db

# Optional (with defaults)
JOB_FETCH_LOOKBACK_HOURS=24
JOB_QUERY_KEYWORDS=backend,nodejs,typescript
JOB_EXCLUDED_KEYWORDS=intern,manager
JOB_LOCATIONS=remote,egypt
JOB_SENIORITY=junior,mid,senior
ENABLE_REMOTEOK=true
ENABLE_WWR=true
ENABLE_WUZZUF=true
MAX_JOBS_PER_SOURCE=50
MAX_NOTIFICATIONS_PER_USER=10
```

### 5. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
# Or use: vercel env add TELEGRAM_BOT_TOKEN
```

### 6. Configure Telegram Webhook

After deployment, set your Telegram webhook:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -d "url=https://your-app.vercel.app/api/webhook/telegram" \
  -d "secret_token=<YOUR_WEBHOOK_SECRET>"
```

### 7. Test the Bot

1. Start a chat with your bot on Telegram
2. Send `/start` command
3. Wait for the daily cron (or trigger manually via Vercel dashboard)

## Project Structure

```
src/
├── api/
│   ├── cron/
│   │   └── daily-job-fetch.ts    # Main cron endpoint
│   └── webhook/
│       └── telegram.ts            # Telegram webhook handler
├── config/
│   └── index.ts                   # Configuration management
├── db/
│   ├── client.ts                  # Database connection
│   ├── jobs.ts                    # Jobs repository
│   ├── users.ts                   # Users repository
│   ├── notifications.ts           # Notifications repository
│   └── schema.sql                 # Database schema
├── filters/
│   └── job-filter.ts              # Job filtering logic
├── services/
│   ├── job-fetcher.ts             # Job fetching orchestration
│   ├── deduplication.ts           # Global deduplication engine
│   ├── notification-dispatcher.ts # Telegram notification sender
│   └── telegram-bot.ts            # Bot command handlers
├── sources/
│   ├── base.ts                    # Source interface
│   ├── remoteok.ts                # RemoteOK adapter
│   ├── weworkremotely.ts          # WeWorkRemotely adapter
│   ├── wuzzuf.ts                  # Wuzzuf adapter
│   └── index.ts                   # Source factory
├── types/
│   ├── job.ts                     # Job type definitions
│   └── user.ts                    # User type definitions
├── utils/
│   ├── hash.ts                    # Hash generation
│   └── logger.ts                  # Logging utility
└── scripts/
    └── migrate.ts                 # Database migration script
```

## How It Works

### Daily Execution Flow

1. **Cron Trigger**: Vercel Cron calls `/api/cron/daily-job-fetch` daily at 9:00 AM UTC
2. **Job Fetching**: Fetches jobs from all enabled sources (last 24 hours)
3. **Normalization**: Converts all jobs to a canonical format
4. **Filtering**: Applies keyword, location, and seniority filters
5. **Deduplication**: Stores jobs in database (hash-based uniqueness enforced)
6. **Notification**: Sends new jobs to registered users via Telegram

### Deduplication Strategy

Jobs are deduplicated using a deterministic hash based on:
- `title` (lowercase, trimmed)
- `company` (lowercase, trimmed)
- `location` (lowercase, trimmed)

The hash is used as the primary key in the database, ensuring:
- Same job from multiple platforms = stored once
- Same job fetched on multiple days = stored once
- Cron retries = no duplicates

### Notification Delivery

- Each user receives only jobs they haven't seen before
- Delivery is tracked in `user_job_notifications` table
- Composite primary key ensures no duplicate notifications
- Maximum notifications per user per day is configurable

## Development

### Local Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run type checking
npm run type-check

# Run linter
npm run lint

# Run Vercel dev server
npm run dev
```

### Testing the Cron Endpoint

You can manually trigger the cron endpoint:

```bash
curl -X POST https://your-app.vercel.app/api/cron/daily-job-fetch \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Configuration

All behavior is controlled via environment variables. No code changes needed to:
- Enable/disable job sources
- Adjust filtering criteria
- Change notification limits
- Modify lookback windows

See `.env.example` for all available options.

## Monitoring

The bot logs comprehensive information:
- Jobs fetched per source
- Jobs stored vs duplicates
- Notifications sent per user
- Errors per source (isolated failures)

Check Vercel function logs for execution details.

## Security

- ✅ No secrets in code
- ✅ Environment variables for all credentials
- ✅ Webhook secret validation
- ✅ Cron secret authentication (optional)
- ✅ Database-level uniqueness enforcement
- ✅ Idempotent operations

## Limitations

- Runs once per day (not real-time)
- Limited to configured job sources
- Filtering is keyword-based (not AI-powered)
- No user-managed preferences (Phase 1)

## Future Enhancements

- User-managed filters via Telegram UI
- Daily job summaries instead of individual messages
- AI-based relevance scoring
- Email notifications
- Admin dashboard
- Analytics and reporting

## License

MIT

## Support

For issues or questions, please open an issue in the repository.

