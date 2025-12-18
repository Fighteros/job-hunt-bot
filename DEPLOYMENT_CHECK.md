# Deployment Verification Guide

## 1. Check Vercel Dashboard

- Go to your Vercel project dashboard
- Verify the deployment status shows "Ready" (green checkmark)
- Check the "Functions" tab to see if your API routes are listed:
  - `/api/cron/daily-job-fetch`
  - `/api/webhook/telegram`

## 2. Test API Endpoints

### Test the Cron Endpoint (Manual Trigger)

Replace `YOUR_DEPLOYMENT_URL` with your actual Vercel deployment URL:

```bash
# Test the cron endpoint (will return 401 if CRON_SECRET is set, or run if not)
curl https://YOUR_DEPLOYMENT_URL/api/cron/daily-job-fetch

# If you have CRON_SECRET set, test with auth:
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://YOUR_DEPLOYMENT_URL/api/cron/daily-job-fetch
```

**Expected responses:**
- `200 OK` with JSON response containing `success: true` and stats
- `401 Unauthorized` if CRON_SECRET is set and not provided
- `500` if there are configuration/database issues

### Test the Telegram Webhook Endpoint

```bash
# Test with a sample Telegram update (should return 405 for GET, 200 for POST)
curl https://YOUR_DEPLOYMENT_URL/api/webhook/telegram
# Should return: {"error":"Method not allowed"}

# Test with POST (requires valid Telegram webhook payload)
curl -X POST https://YOUR_DEPLOYMENT_URL/api/webhook/telegram \
  -H "Content-Type: application/json" \
  -d '{"message":{"chat":{"id":123},"from":{"id":123,"first_name":"Test"},"text":"/start"}}'
```

## 3. Check Function Logs

1. In Vercel dashboard, go to your deployment
2. Click on "Functions" tab
3. Click on a function name (e.g., `api/cron/daily-job-fetch`)
4. View the "Logs" tab to see runtime logs
5. Check for any errors or warnings

## 4. Verify Cron Job Configuration

1. In Vercel dashboard, go to your project
2. Navigate to "Settings" → "Cron Jobs"
3. Verify that "Daily Job Fetch" cron is listed with schedule: `0 9 * * *` (9 AM daily)
4. Check the status - it should show when it last ran and when it will run next

## 5. Check Environment Variables

1. In Vercel dashboard, go to "Settings" → "Environment Variables"
2. Verify all required variables are set:
   - Database connection strings
   - Telegram bot token
   - Any other config from `env.example`

## 6. Test Database Connection

The cron job will attempt to connect to your database. Check the logs after triggering to ensure:
- Database connection is successful
- Jobs are being fetched and stored
- No connection errors appear

## 7. Monitor First Cron Run

- Wait for the scheduled time (9 AM daily) or trigger manually
- Check the function logs after execution
- Verify jobs were fetched and stored
- Check if notifications were sent (if users are registered)

## Common Issues to Check

1. **Function not found**: Verify files are in `api/` directory (not `src/api/`)
2. **Import errors**: Check that all dependencies are in `package.json`
3. **Database errors**: Verify connection strings and database is accessible
4. **Environment variables**: Ensure all required vars are set in Vercel
5. **Build errors**: Check build logs in Vercel dashboard

## Quick Health Check Script

You can create a simple health check endpoint or use:

```bash
# Check if deployment is live
curl -I https://YOUR_DEPLOYMENT_URL/api/cron/daily-job-fetch

# Should return HTTP status (200, 401, or 500 - all indicate the function exists)
```

