import { createHash } from 'crypto';
import { NormalizedJob } from '../types/job';

/**
 * Generates a deterministic hash for a job based on:
 * - title
 * - company
 * - location
 * 
 * This ensures platform-independent deduplication
 */
export function generateJobHash(job: NormalizedJob): string {
  const hashInput = `${job.title.toLowerCase().trim()}|${job.company.toLowerCase().trim()}|${job.location.toLowerCase().trim()}`;
  return createHash('sha256').update(hashInput).digest('hex');
}

