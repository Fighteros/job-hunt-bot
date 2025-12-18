import { NormalizedJob } from '../types/job';
import { generateJobHash } from '../utils/hash';
import { JobsRepository } from '../db/jobs';
import { withTransaction } from '../db/client';
import { logger } from '../utils/logger';

/**
 * Global deduplication engine
 * Ensures database-level uniqueness
 */
export class DeduplicationEngine {
  constructor(private jobsRepo: JobsRepository) {}

  /**
   * Deduplicates and stores jobs
   * Returns statistics about the operation
   */
  async deduplicateAndStore(jobs: NormalizedJob[]): Promise<{
    stored: number;
    duplicates: number;
    storedHashes: string[];
  }> {
    if (jobs.length === 0) {
      return { stored: 0, duplicates: 0, storedHashes: [] };
    }

    return await withTransaction(async (client) => {
      const { inserted, duplicates } = await this.jobsRepo.insertJobsIfNotExists(
        client,
        jobs
      );

      logger.info(`Deduplication complete`, {
        total: jobs.length,
        stored: inserted.length,
        duplicates: duplicates.length,
      });

      return {
        stored: inserted.length,
        duplicates: duplicates.length,
        storedHashes: inserted,
      };
    });
  }

  /**
   * Generates hash for a job (for testing/debugging)
   */
  static generateHash(job: NormalizedJob): string {
    return generateJobHash(job);
  }
}

