import Parser from 'rss-parser';
import { JobSource } from './base';
import { NormalizedJob } from '../types/job';
import { logger } from '../utils/logger';

/**
 * WeWorkRemotely RSS adapter
 * RSS Feed: https://weworkremotely.com/categories/remote-programming-jobs.rss
 */
export class WeWorkRemotelySource implements JobSource {
  readonly name = 'weworkremotely';
  private readonly rssUrl = 'https://weworkremotely.com/categories/remote-programming-jobs.rss';
  private readonly parser: Parser;

  constructor() {
    this.parser = new Parser({
      customFields: {
        item: ['pubDate'],
      },
    });
  }

  async fetchJobs(since: Date): Promise<NormalizedJob[]> {
    try {
      logger.info(`Fetching jobs from ${this.name} since ${since.toISOString()}`);
      
      const feed = await this.parser.parseURL(this.rssUrl);
      
      const normalizedJobs: NormalizedJob[] = [];

      for (const item of feed.items || []) {
        try {
          const postedAt = item.pubDate ? new Date(item.pubDate) : new Date();
          
          // Only include jobs posted after the 'since' date
          if (postedAt < since) {
            continue;
          }

          // Parse title format: "Job Title - Company Name"
          const titleMatch = item.title?.match(/^(.+?)\s*-\s*(.+)$/);
          const title = titleMatch ? titleMatch[1].trim() : (item.title || 'Untitled');
          const company = titleMatch ? titleMatch[2].trim() : 'Unknown Company';

          const normalized: NormalizedJob = {
            title,
            company,
            location: 'Remote',
            platform: this.name,
            url: item.link || '',
            postedAt,
            seniority: this.extractSeniority(title),
            employmentType: 'full-time',
          };

          normalizedJobs.push(normalized);
        } catch (error) {
          logger.warn(`Failed to normalize job from ${this.name}`, { error, item });
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
}

