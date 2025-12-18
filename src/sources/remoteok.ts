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
      
      if (!Array.isArray(data)) {
        logger.warn(`RemoteOK API returned non-array data: ${typeof data}`);
        return [];
      }
      
      // Filter out metadata objects (those without 'id' field) and get valid job objects
      const jobs = data.filter(item => {
        // Check if it's a valid job object (has id and position/company)
        return item.id && (item.position || item.company);
      });
      
      logger.info(`RemoteOK API returned ${data.length} items, ${jobs.length} valid jobs`);
      
      const normalizedJobs: NormalizedJob[] = [];
      let skippedBeforeSince = 0;
      let skippedInvalidDate = 0;

      for (const job of jobs) {
        try {
          // Parse the date - RemoteOK uses ISO date strings
          const dateStr = job.date as string;
          if (!dateStr) {
            logger.warn(`Job missing date field, skipping`, { jobId: job.id });
            continue;
          }
          
          const postedAt = new Date(dateStr);
          
          // Check if date is valid
          if (isNaN(postedAt.getTime())) {
            skippedInvalidDate++;
            logger.warn(`Invalid date format for job, skipping`, { jobId: job.id, date: dateStr });
            continue;
          }
          
          // Only include jobs posted after the 'since' date
          if (postedAt < since) {
            skippedBeforeSince++;
            continue;
          }

          const normalized: NormalizedJob = {
            title: String(job.position || job.title || 'Untitled'),
            company: String(job.company || 'Unknown Company'),
            location: String(job.location || 'Remote'),
            platform: this.name,
            url: String(job.url || job.apply_url || `https://remoteok.io/remote-jobs/${job.id}`),
            postedAt,
            seniority: this.extractSeniority(String(job.position || '')),
            techStack: this.extractTechStack(job),
            employmentType: 'full-time', // RemoteOK typically has full-time positions
          };

          normalizedJobs.push(normalized);
        } catch (error) {
          logger.warn(`Failed to normalize job from ${this.name}`, { error, jobId: job.id });
        }
      }

      logger.info(`Fetched ${normalizedJobs.length} jobs from ${this.name}`, {
        totalItems: data.length,
        validJobs: jobs.length,
        normalized: normalizedJobs.length,
        skippedBeforeSince,
        skippedInvalidDate,
        sinceDate: since.toISOString(),
      });
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

