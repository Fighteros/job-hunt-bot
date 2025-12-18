import { NormalizedJob } from '../types/job';
import { Config } from '../config';
import { logger } from '../utils/logger';

/**
 * Filters jobs based on configuration
 * All filtering logic is driven by environment variables
 */
export class JobFilter {
  constructor(private config: Config) {}

  /**
   * Checks if a job matches the configured filters
   */
  matches(job: NormalizedJob): boolean {
    // Check query keywords (at least one must match)
    if (this.config.jobQueryKeywords.length > 0) {
      const jobText = `${job.title} ${job.company} ${job.location}`.toLowerCase();
      const hasKeyword = this.config.jobQueryKeywords.some(keyword =>
        jobText.includes(keyword.toLowerCase())
      );
      if (!hasKeyword) {
        logger.debug(`Job filtered out: no matching keywords`, { job: job.title });
        return false;
      }
    }

    // Check excluded keywords (none should match)
    if (this.config.jobExcludedKeywords.length > 0) {
      const jobText = `${job.title} ${job.company}`.toLowerCase();
      const hasExcluded = this.config.jobExcludedKeywords.some(keyword =>
        jobText.includes(keyword.toLowerCase())
      );
      if (hasExcluded) {
        logger.debug(`Job filtered out: contains excluded keyword`, { job: job.title });
        return false;
      }
    }

    // Check location filter
    if (this.config.jobLocations.length > 0) {
      const jobLocation = job.location.toLowerCase();
      const matchesLocation = this.config.jobLocations.some(location =>
        jobLocation.includes(location.toLowerCase())
      );
      if (!matchesLocation) {
        logger.debug(`Job filtered out: location mismatch`, { job: job.location });
        return false;
      }
    }

    // Check seniority filter
    if (this.config.jobSeniority.length > 0 && job.seniority) {
      const matchesSeniority = this.config.jobSeniority.some(seniority =>
        job.seniority?.toLowerCase() === seniority.toLowerCase()
      );
      if (!matchesSeniority) {
        logger.debug(`Job filtered out: seniority mismatch`, { job: job.seniority });
        return false;
      }
    }

    return true;
  }

  /**
   * Filters an array of jobs
   */
  filter(jobs: NormalizedJob[]): NormalizedJob[] {
    return jobs.filter(job => this.matches(job));
  }
}

