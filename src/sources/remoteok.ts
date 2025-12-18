import fetch from 'node-fetch';
import { JobSource } from './base';
import { NormalizedJob } from '../types/job';
import { logger } from '../utils/logger';

/**
 * RemoteOK API adapter
 * API Documentation: https://remoteok.io/api
 */
export class RemoteOKSource implements JobSource {
  readonly name = 'remoteok';
  private readonly apiUrl = 'https://remoteok.io/api';

  async fetchJobs(since: Date): Promise<NormalizedJob[]> {
    try {
      logger.info(`Fetching jobs from ${this.name} since ${since.toISOString()}`);
      
      const response = await fetch(this.apiUrl);
      if (!response.ok) {
        throw new Error(`RemoteOK API returned ${response.status}`);
      }

      const data = await response.json() as Array<Record<string, unknown>>;
      
      // Filter out the first element if it's metadata
      const jobs = Array.isArray(data) ? data.filter(item => item.id) : [];
      
      const normalizedJobs: NormalizedJob[] = [];

      for (const job of jobs) {
        try {
          const postedAt = new Date(job.date as string);
          
          // Only include jobs posted after the 'since' date
          if (postedAt < since) {
            continue;
          }

          const normalized: NormalizedJob = {
            title: String(job.position || job.title || 'Untitled'),
            company: String(job.company || 'Unknown Company'),
            location: String(job.location || 'Remote'),
            platform: this.name,
            url: String(job.url || `https://remoteok.io/remote-jobs/${job.id}`),
            postedAt,
            seniority: this.extractSeniority(String(job.position || '')),
            techStack: this.extractTechStack(job),
            employmentType: 'full-time', // RemoteOK typically has full-time positions
          };

          normalizedJobs.push(normalized);
        } catch (error) {
          logger.warn(`Failed to normalize job from ${this.name}`, { error, job });
        }
      }

      logger.info(`Fetched ${normalizedJobs.length} jobs from ${this.name}`);
      return normalizedJobs;
    } catch (error) {
      logger.error(`Error fetching jobs from ${this.name}`, error);
      throw error;
    }
  }

  private extractSeniority(title: string): string | undefined {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('senior')) return 'senior';
    if (lowerTitle.includes('junior')) return 'junior';
    if (lowerTitle.includes('mid') || lowerTitle.includes('middle')) return 'mid';
    return undefined;
  }

  private extractTechStack(job: Record<string, unknown>): string[] | undefined {
    const tags = job.tags as string[] | undefined;
    if (Array.isArray(tags) && tags.length > 0) {
      return tags;
    }
    return undefined;
  }
}

