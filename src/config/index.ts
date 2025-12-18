/**
 * Configuration management
 * All behavior is driven by environment variables
 */

export interface Config {
  // Telegram
  telegram: {
    botToken: string;
    webhookSecret: string;
  };

  // Database
  databaseUrl: string;

  // Cron Behavior
  jobFetchLookbackHours: number;
  cronExecutionTimezone: string;

  // Job Filtering
  jobQueryKeywords: string[];
  jobExcludedKeywords: string[];
  jobLocations: string[];
  jobSeniority: string[];

  // Platform Toggles
  enableRemoteOK: boolean;
  enableWWR: boolean;
  enableWuzzuf: boolean;
  enableLinkedIn: boolean;

  // Safety Limits
  maxJobsPerSource: number;
  maxNotificationsPerUser: number;
}

function parseStringArray(value: string | undefined, defaultValue: string[] = []): string[] {
  if (!value) return defaultValue;
  return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

function parseBoolean(value: string | undefined, defaultValue: boolean = false): boolean {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

function parseNumber(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

export function loadConfig(): Config {
  const requiredEnvVars = [
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_WEBHOOK_SECRET',
    'DATABASE_URL',
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  return {
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN!,
      webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET!,
    },
    databaseUrl: process.env.DATABASE_URL!,
    jobFetchLookbackHours: parseNumber(process.env.JOB_FETCH_LOOKBACK_HOURS, 24),
    cronExecutionTimezone: process.env.CRON_EXECUTION_TIMEZONE || 'UTC',
    jobQueryKeywords: parseStringArray(process.env.JOB_QUERY_KEYWORDS),
    jobExcludedKeywords: parseStringArray(process.env.JOB_EXCLUDED_KEYWORDS),
    jobLocations: parseStringArray(process.env.JOB_LOCATIONS),
    jobSeniority: parseStringArray(process.env.JOB_SENIORITY),
    enableRemoteOK: parseBoolean(process.env.ENABLE_REMOTEOK, true),
    enableWWR: parseBoolean(process.env.ENABLE_WWR, true),
    enableWuzzuf: parseBoolean(process.env.ENABLE_WUZZUF, true),
    enableLinkedIn: parseBoolean(process.env.ENABLE_LINKEDIN, false),
    maxJobsPerSource: parseNumber(process.env.MAX_JOBS_PER_SOURCE, 50),
    maxNotificationsPerUser: parseNumber(process.env.MAX_NOTIFICATIONS_PER_USER, 10),
  };
}

