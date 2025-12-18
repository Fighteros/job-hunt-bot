/**
 * Normalized job schema
 * All job sources must be normalized to this structure
 */
export interface NormalizedJob {
  title: string;
  company: string;
  location: string;
  platform: string;
  url: string;
  postedAt: Date;
  seniority?: string;
  techStack?: string[];
  employmentType?: string;
}

/**
 * Job with hash for deduplication
 */
export interface JobWithHash extends NormalizedJob {
  hash: string;
}

/**
 * Raw job data from a source (before normalization)
 */
export interface RawJobData {
  [key: string]: unknown;
}

