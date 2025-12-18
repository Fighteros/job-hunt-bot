import { PoolClient } from 'pg';
import { JobWithHash, NormalizedJob } from '../types/job';
import { generateJobHash } from '../utils/hash';
import { logger } from '../utils/logger';

/**
 * Database operations for jobs
 * Enforces global deduplication at the database level
 */
export class JobsRepository {
  /**
   * Inserts a job if it doesn't already exist (based on hash)
   * Returns true if inserted, false if duplicate
   */
  async insertJobIfNotExists(
    client: PoolClient,
    job: NormalizedJob
  ): Promise<{ inserted: boolean; hash: string }> {
    const hash = generateJobHash(job);

    try {
      const result = await client.query(
        `INSERT INTO jobs (
          hash, title, company, location, platform, url, posted_at,
          seniority, tech_stack, employment_type
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (hash) DO NOTHING
        RETURNING hash`,
        [
          hash,
          job.title,
          job.company,
          job.location,
          job.platform,
          job.url,
          job.postedAt,
          job.seniority || null,
          job.techStack || null,
          job.employmentType || null,
        ]
      );

      const inserted = result.rows.length > 0;
      return { inserted, hash };
    } catch (error) {
      logger.error(`Error inserting job`, error, { hash, title: job.title });
      throw error;
    }
  }

  /**
   * Batch insert jobs with deduplication
   * Returns array of hashes for successfully inserted jobs
   */
  async insertJobsIfNotExists(
    client: PoolClient,
    jobs: NormalizedJob[]
  ): Promise<{ inserted: string[]; duplicates: string[] }> {
    const inserted: string[] = [];
    const duplicates: string[] = [];

    for (const job of jobs) {
      const { inserted: wasInserted, hash } = await this.insertJobIfNotExists(client, job);
      if (wasInserted) {
        inserted.push(hash);
      } else {
        duplicates.push(hash);
      }
    }

    return { inserted, duplicates };
  }

  /**
   * Gets jobs that haven't been sent to a user yet
   */
  async getUnsentJobsForUser(
    client: PoolClient,
    userId: number,
    limit: number
  ): Promise<JobWithHash[]> {
    const result = await client.query(
      `SELECT 
        j.hash, j.title, j.company, j.location, j.platform, j.url, j.posted_at,
        j.seniority, j.tech_stack, j.employment_type
      FROM jobs j
      WHERE j.posted_at >= NOW() - INTERVAL '24 hours'
        AND NOT EXISTS (
          SELECT 1 FROM user_job_notifications ujn
          WHERE ujn.user_id = $1 AND ujn.job_hash = j.hash
        )
      ORDER BY j.posted_at DESC
      LIMIT $2`,
      [userId, limit]
    );

    return result.rows.map(row => ({
      hash: row.hash,
      title: row.title,
      company: row.company,
      location: row.location,
      platform: row.platform,
      url: row.url,
      postedAt: new Date(row.posted_at),
      seniority: row.seniority,
      techStack: row.tech_stack,
      employmentType: row.employment_type,
    }));
  }
}

