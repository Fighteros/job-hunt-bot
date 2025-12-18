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
        item: ['pubDate', 'region', 'category'],
      },
    });
  }

  async fetchJobs(since: Date): Promise<NormalizedJob[]> {
    try {
      logger.info(`Fetching jobs from ${this.name} since ${since.toISOString()}`);
      
      const feed = await this.parser.parseURL(this.rssUrl);
      
      logger.info(`RSS feed parsed, found ${feed.items?.length || 0} items`);
      
      const normalizedJobs: NormalizedJob[] = [];
      let skippedBeforeSince = 0;
      let skippedInvalid = 0;

      for (const item of feed.items || []) {
        try {
          if (!item.title || !item.link) {
            skippedInvalid++;
            logger.debug(`Skipping item with missing title or link`, { 
              hasTitle: !!item.title,
              hasLink: !!item.link 
            });
            continue;
          }

          const postedAt = item.pubDate ? new Date(item.pubDate) : new Date();
          
          // Validate date
          if (isNaN(postedAt.getTime())) {
            skippedInvalid++;
            logger.debug(`Invalid date for item: ${item.title}`, { pubDate: item.pubDate });
            continue;
          }
          
          // Only include jobs posted after the 'since' date
          if (postedAt < since) {
            skippedBeforeSince++;
            continue;
          }

          // Parse title format: "Company Name: Job Title" (colon format)
          // Also handle "Job Title - Company Name" (dash format) as fallback
          let title: string;
          let company: string;
          
          const colonMatch = item.title.match(/^(.+?):\s*(.+)$/);
          const dashMatch = item.title.match(/^(.+?)\s*-\s*(.+)$/);
          
          if (colonMatch) {
            // Format: "Company: Job Title"
            company = colonMatch[1].trim();
            title = colonMatch[2].trim();
          } else if (dashMatch) {
            // Format: "Job Title - Company Name" (fallback)
            title = dashMatch[1].trim();
            company = dashMatch[2].trim();
          } else {
            // No separator found, use entire title as job title
            title = item.title.trim();
            company = 'Unknown Company';
          }

          const normalized: NormalizedJob = {
            title,
            company,
            location: 'Remote',
            platform: this.name,
            url: item.link,
            postedAt,
            seniority: this.extractSeniority(title),
            employmentType: 'full-time',
          };

          normalizedJobs.push(normalized);
        } catch (error) {
          logger.warn(`Failed to normalize job from ${this.name}`, { 
            error: error instanceof Error ? error.message : String(error),
            title: item.title,
            link: item.link 
          });
        }
      }

      logger.info(`Fetched ${normalizedJobs.length} jobs from ${this.name}`, {
        totalItems: feed.items?.length || 0,
        normalized: normalizedJobs.length,
        skippedBeforeSince,
        skippedInvalid,
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
}

