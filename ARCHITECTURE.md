# Architecture Documentation

## System Overview

The Daily Job Hunt Telegram Bot is a serverless application designed with the following principles:

1. **Idempotency**: All operations are safe to retry
2. **Database-enforced correctness**: Deduplication happens at the database level
3. **Environment-driven configuration**: No code changes needed for behavior changes
4. **Isolated failures**: Source failures don't break the entire system
5. **Stateless execution**: Each cron run is independent

## Data Flow

```
┌─────────────────┐
│  Vercel Cron    │ (Daily at 9:00 AM UTC)
└────────┬────────┘
         │
         v
┌─────────────────┐
│ /api/cron/      │
│ daily-job-fetch │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Job Sources     │ (RemoteOK, WeWorkRemotely, Wuzzuf)
│ - Fetch jobs    │
│ - Last 24 hours │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Normalization   │ (Convert to canonical format)
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Filtering       │ (Keywords, locations, seniority)
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Deduplication   │ (Hash-based, DB-enforced)
│ - Generate hash │
│ - Insert if new │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Notification    │ (Per user, unsent jobs only)
│ - Get users     │
│ - Get unsent    │
│ - Send via bot  │
└─────────────────┘
```

## Database Schema

### Jobs Table
- **Primary Key**: `hash` (SHA-256 of title+company+location)
- **Purpose**: Global deduplication
- **Uniqueness**: Enforced at database level via PRIMARY KEY constraint

### User Job Notifications Table
- **Primary Key**: Composite (`user_id`, `job_hash`)
- **Purpose**: Track which jobs were sent to which users
- **Uniqueness**: Enforced at database level via PRIMARY KEY constraint

### Users Table
- **Primary Key**: `telegram_id`
- **Purpose**: Store Telegram user information

## Deduplication Strategy

### Hash Generation
```typescript
hash = SHA256(
  title.toLowerCase().trim() + "|" +
  company.toLowerCase().trim() + "|" +
  location.toLowerCase().trim()
)
```

### Why This Works
1. **Platform-independent**: Same job from different platforms gets same hash
2. **Deterministic**: Same job always generates same hash
3. **Database-enforced**: PRIMARY KEY constraint prevents duplicates
4. **Idempotent**: Re-running cron doesn't create duplicates

## Error Handling

### Source-Level Failures
- Each source adapter is isolated
- Failures in one source don't affect others
- Errors are logged but execution continues

### Database Failures
- Transactions ensure atomicity
- Rollback on errors
- Partial failures are logged

### Notification Failures
- Per-user failures are isolated
- Failed notifications don't block others
- Delivery state is tracked transactionally

## Configuration

All behavior is controlled via environment variables:

- **Job Sources**: Enable/disable via `ENABLE_*` flags
- **Filtering**: Keywords, locations, seniority via `JOB_*` variables
- **Limits**: Per-source and per-user limits via `MAX_*` variables
- **Timing**: Lookback window via `JOB_FETCH_LOOKBACK_HOURS`

## Security

1. **Secrets**: All credentials in environment variables
2. **Webhook**: Secret token validation
3. **Cron**: Optional Bearer token authentication
4. **Database**: Connection string from environment
5. **Idempotency**: Prevents duplicate operations

## Scalability Considerations

1. **Stateless**: Each execution is independent
2. **Database pooling**: Connection reuse
3. **Batch operations**: Efficient database writes
4. **Rate limiting**: Per-source and per-user limits
5. **Isolation**: Source failures don't cascade

## Monitoring

The system logs:
- Jobs fetched per source
- Jobs stored vs duplicates
- Notifications sent per user
- Errors with context
- Execution duration

Check Vercel function logs for execution details.

