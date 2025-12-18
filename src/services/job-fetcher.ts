import { JobSource } from '../sources/base';
import { NormalizedJob } from '../types/job';
import { Config } from '../config';
import { JobFilter } from '../filters/job-filter';
import { logger } from '../utils/logger';

/**
 * Orchestrates job fetching from all sources
 */
export class JobFetcherService {
  private filter: JobFilter;

  constructor(
    private sources: JobSource[],
    private config: Config
  ) {
    this.filter = new JobFilter(config);
  }

  /**
   * Fetches jobs from all enabled sources
   * Returns normalized and filtered jobs
   */
  async fetchAllJobs(since: Date): Promise<{
    jobs: NormalizedJob[];
    stats: Record<string, { fetched: number; filtered: number; errors: number }>;
  }> {
    const stats: Record<string, { fetched: number; filtered: number; errors: number }> = {};
    const allJobs: NormalizedJob[] = [];

    for (const source of this.sources) {
      const sourceStats = { fetched: 0, filtered: 0, errors: 0 };

      try {
        logger.info(`Fetching from source: ${source.name}`);
        
        const rawJobs = await source.fetchJobs(since);
        sourceStats.fetched = rawJobs.length;

        // Apply source-level limit
        const limitedJobs = rawJobs.slice(0, this.config.maxJobsPerSource);

        // Filter jobs
        const filteredJobs = this.filter.filter(limitedJobs);
        sourceStats.filtered = filteredJobs.length;
        const filteredOut = limitedJobs.length - filteredJobs.length;

        allJobs.push(...filteredJobs);

        logger.info(`Source ${source.name} completed`, {
          fetched: sourceStats.fetched,
          afterLimit: limitedJobs.length,
          filtered: sourceStats.filtered,
          filteredOut,
        });
      } catch (error) {
        sourceStats.errors = 1;
        logger.error(`Source ${source.name} failed`, error);
        // Continue with other sources - isolated failures
      }

      stats[source.name] = sourceStats;
    }

    return { jobs: allJobs, stats };
  }
}

