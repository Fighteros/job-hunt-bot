import type { VercelRequest, VercelResponse } from '@vercel/node';
import { loadConfig } from '../../src/config';
import { createJobSources } from '../../src/sources';
import { JobFetcherService } from '../../src/services/job-fetcher';
import { DeduplicationEngine } from '../../src/services/deduplication';
import { JobsRepository } from '../../src/db/jobs';
import { UsersRepository } from '../../src/db/users';
import { NotificationsRepository } from '../../src/db/notifications';
import { NotificationDispatcher } from '../../src/services/notification-dispatcher';
import { logger } from '../../src/utils/logger';

/**
 * Daily job fetch cron endpoint
 * Runs once per day via Vercel Cron
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Verify this is a cron request (optional but recommended)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    logger.warn('Unauthorized cron request', { authHeader: authHeader ? 'present' : 'missing' });
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const startTime = Date.now();
  logger.info('Daily job fetch cron started');

  try {
    // Load configuration
    const config = loadConfig();

    // Calculate lookback window
    const since = new Date();
    since.setHours(since.getHours() - config.jobFetchLookbackHours);

    logger.info(`Fetching jobs posted since ${since.toISOString()}`);

    // Initialize services
    const sources = createJobSources(config);
    const jobFetcher = new JobFetcherService(sources, config);
    const jobsRepo = new JobsRepository();
    const deduplicationEngine = new DeduplicationEngine(jobsRepo);
    const usersRepo = new UsersRepository();
    const notificationsRepo = new NotificationsRepository();
    const notificationDispatcher = new NotificationDispatcher(config, notificationsRepo);

    // Step 1: Fetch jobs from all sources
    const { jobs, stats } = await jobFetcher.fetchAllJobs(since);
    logger.info(`Fetched ${jobs.length} jobs total`, { stats });

    // Step 2: Deduplicate and store jobs
    const { stored, duplicates, storedHashes } = await deduplicationEngine.deduplicateAndStore(jobs);
    logger.info(`Stored ${stored} new jobs, ${duplicates} duplicates`);

    // Step 3: Get all users
    const { getPool } = await import('../../src/db/client');
    const pool = getPool();
    const client = await pool.connect();
    
    try {
      const users = await usersRepo.getAllUsers(client);
      logger.info(`Found ${users.length} registered users`);

      // Step 4: Send notifications to each user
      let totalNotificationsSent = 0;
      for (const user of users) {
        try {
          // Get unsent jobs for this user
          const unsentJobs = await jobsRepo.getUnsentJobsForUser(
            client,
            user.telegramId,
            config.maxNotificationsPerUser
          );

          if (unsentJobs.length > 0) {
            const sent = await notificationDispatcher.sendNotificationsToUser(
              user,
              unsentJobs
            );
            totalNotificationsSent += sent;
          }
        } catch (error) {
          logger.error(`Failed to send notifications to user`, error, {
            userId: user.telegramId,
          });
          // Continue with other users - isolated failures
        }
      }

      const duration = Date.now() - startTime;
      logger.info('Daily job fetch cron completed', {
        duration: `${duration}ms`,
        jobsFetched: jobs.length,
        jobsStored: stored,
        duplicates: duplicates,
        notificationsSent: totalNotificationsSent,
      });

      res.status(200).json({
        success: true,
        stats: {
          jobsFetched: jobs.length,
          jobsStored: stored,
          duplicates,
          notificationsSent: totalNotificationsSent,
          duration: `${duration}ms`,
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Daily job fetch cron failed', error, { duration: `${duration}ms` });
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

