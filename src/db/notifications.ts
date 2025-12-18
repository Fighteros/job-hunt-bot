import { PoolClient } from 'pg';
import { logger } from '../utils/logger';

/**
 * Database operations for notifications
 * Ensures idempotent notification delivery
 */
export class NotificationsRepository {
  /**
   * Marks a job as sent to a user
   * Composite primary key ensures no duplicates
   */
  async markAsSent(
    client: PoolClient,
    userId: number,
    jobHash: string
  ): Promise<boolean> {
    try {
      const result = await client.query(
        `INSERT INTO user_job_notifications (user_id, job_hash)
         VALUES ($1, $2)
         ON CONFLICT (user_id, job_hash) DO NOTHING
         RETURNING user_id`,
        [userId, jobHash]
      );

      return result.rows.length > 0;
    } catch (error) {
      logger.error(`Error marking notification as sent`, error, { userId, jobHash });
      throw error;
    }
  }

  /**
   * Batch mark jobs as sent to a user
   */
  async markMultipleAsSent(
    client: PoolClient,
    userId: number,
    jobHashes: string[]
  ): Promise<number> {
    if (jobHashes.length === 0) return 0;

    let inserted = 0;
    for (const hash of jobHashes) {
      const wasInserted = await this.markAsSent(client, userId, hash);
      if (wasInserted) {
        inserted++;
      }
    }

    return inserted;
  }
}

