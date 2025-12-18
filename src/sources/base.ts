import { NormalizedJob } from '../types/job';

/**
 * Base interface for all job sources
 * Each source adapter must implement this interface
 */
export interface JobSource {
  /**
   * Unique identifier for the source
   */
  readonly name: string;

  /**
   * Fetches jobs posted since the given date
   * @param since - Only fetch jobs posted after this date
   * @returns Array of normalized jobs
   */
  fetchJobs(since: Date): Promise<NormalizedJob[]>;
}

