import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { JobSource } from './base';
import { NormalizedJob } from '../types/job';
import { logger } from '../utils/logger';

/**
 * Wuzzuf scraping adapter
 * Note: This is a lightweight scraper. Respect robots.txt and rate limits.
 */
export class WuzzufSource implements JobSource {
  readonly name = 'wuzzuf';
  private readonly baseUrl = 'https://wuzzuf.net';

  async fetchJobs(since: Date): Promise<NormalizedJob[]> {
    try {
      logger.info(`Fetching jobs from ${this.name} since ${since.toISOString()}`);
      
      // Wuzzuf search URL for remote/backend jobs
      const searchUrl = `${this.baseUrl}/search/jobs?q=backend+remote&filters[country][]=Egypt`;
      
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        throw new Error(`Wuzzuf returned ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      
      const normalizedJobs: NormalizedJob[] = [];
      
      // Debug: Log HTML length and try to find job containers
      logger.info(`HTML received: ${html.length} characters`);
      
      // Try multiple selector strategies for job listings
      // Wuzzuf uses various class names, try common patterns
      const jobSelectors = [
        '[data-testid*="job"]',
        '.css-1gatmva',
        '.css-1gatmva-e',
        'article[class*="job"]',
        'div[class*="job-card"]',
        'div[class*="JobCard"]',
        'a[href*="/jobs/"]',
        '.css-1gatmva-e1qvo2ff0',
      ];
      
      let jobElements: cheerio.Cheerio<cheerio.Element> | null = null;
      let usedSelector = '';
      
      for (const selector of jobSelectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          jobElements = elements;
          usedSelector = selector;
          logger.info(`Found ${elements.length} job elements using selector: ${selector}`);
          break;
        }
      }
      
      if (!jobElements || jobElements.length === 0) {
        // Fallback: try to find any links that look like job links
        const jobLinks = $('a[href*="/jobs/"]').not('a[href*="/search"]');
        logger.warn(`No job containers found. Found ${jobLinks.length} potential job links. Trying alternative approach...`);
        
        // Try to find parent containers of job links
        jobLinks.slice(0, 20).each((_idx: number, linkElement: cheerio.Element) => {
          try {
            const $link = $(linkElement);
            const $container = $link.closest('div, article, li');
            
            if ($container.length === 0) return;
            
            const title = $link.text().trim() || $link.find('h2, h3, .title').first().text().trim();
            const url = $link.attr('href') || '';
            const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
            
            // Try to find company name in nearby elements
            const company = $container.find('[class*="company"], [class*="Company"]').first().text().trim() 
              || $container.text().split('\n').find((line: string) => line.trim().length > 0 && !line.includes(title))?.trim() 
              || 'Unknown Company';
            
            const location = $container.find('[class*="location"], [class*="Location"]').first().text().trim() || 'Egypt';
            
            // Try to find date
            const postedText = $container.find('[class*="date"], [class*="time"], [class*="posted"]').first().text().trim();
            const postedAt = this.parseDate(postedText, new Date()); // Use current date as fallback to avoid filtering
            
            if (!title || title.length < 3) {
              return;
            }
            
            // Only include jobs posted after the 'since' date
            if (postedAt < since) {
              logger.debug(`Skipping job "${title}" - posted at ${postedAt.toISOString()}, since ${since.toISOString()}`);
              return;
            }
            
            const normalized: NormalizedJob = {
              title,
              company: company || 'Unknown Company',
              location: location || 'Egypt',
              platform: this.name,
              url: fullUrl,
              postedAt,
              seniority: this.extractSeniority(title),
              employmentType: 'full-time',
            };
            
            normalizedJobs.push(normalized);
          } catch (error) {
            logger.warn(`Failed to normalize job from ${this.name} (fallback)`, { error });
          }
        });
      } else {
        // Use the found selector
        jobElements.each((_idx: number, element: cheerio.Element) => {
          try {
            const $job = $(element);
            
            // Try multiple strategies to find title
            const title = $job.find('h2 a, h3 a, a[href*="/jobs/"]').first().text().trim()
              || $job.find('h2, h3, [class*="title"], [class*="Title"]').first().text().trim();
            
            // Try multiple strategies to find company
            const company = $job.find('[class*="company"], [class*="Company"], .css-17s97q8').first().text().trim();
            
            // Try multiple strategies to find location
            const location = $job.find('[class*="location"], [class*="Location"], .css-5wys0k').first().text().trim() || 'Egypt';
            
            // Try multiple strategies to find URL
            const url = $job.find('h2 a, h3 a, a[href*="/jobs/"]').first().attr('href') || '';
            const fullUrl = url.startsWith('http') ? url : url ? `${this.baseUrl}${url}` : '';
            
            // Try to extract posted date from the job card
            const postedText = $job.find('[class*="date"], [class*="time"], [class*="posted"], .css-4x4xq').first().text().trim();
            const postedAt = this.parseDate(postedText, new Date()); // Use current date as fallback
            
            if (!title || title.length < 3) {
              logger.debug(`Skipping job - missing title. Company: ${company}`);
              return;
            }
            
            if (!company || company.length < 2) {
              logger.debug(`Skipping job "${title}" - missing company`);
              return;
            }
            
            // Only include jobs posted after the 'since' date
            if (postedAt < since) {
              logger.debug(`Skipping job "${title}" - posted at ${postedAt.toISOString()}, since ${since.toISOString()}`);
              return;
            }
            
            const normalized: NormalizedJob = {
              title,
              company,
              location: location || 'Egypt',
              platform: this.name,
              url: fullUrl,
              postedAt,
              seniority: this.extractSeniority(title),
              employmentType: 'full-time',
            };
            
            normalizedJobs.push(normalized);
          } catch (error) {
            logger.warn(`Failed to normalize job from ${this.name}`, { error });
          }
        });
      }

      logger.info(`Fetched ${normalizedJobs.length} jobs from ${this.name} (used selector: ${usedSelector || 'fallback'})`);
      return normalizedJobs;
    } catch (error) {
      logger.error(`Error fetching jobs from ${this.name}`, error);
      throw error;
    }
  }

  private parseDate(dateText: string, _fallback: Date): Date {
    if (!dateText) {
      // If no date text, assume it's recent (use current date to avoid filtering)
      return new Date();
    }

    const lower = dateText.toLowerCase();
    const now = new Date();

    if (lower.includes('today') || lower.includes('اليوم')) {
      return now;
    }
    if (lower.includes('yesterday') || lower.includes('أمس')) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday;
    }

    // Try to parse relative dates like "2 days ago", "منذ يومين"
    const daysAgoMatch = dateText.match(/(\d+)\s*(?:days?|أيام|يوم)/);
    if (daysAgoMatch) {
      const daysAgo = parseInt(daysAgoMatch[1], 10);
      const date = new Date(now);
      date.setDate(date.getDate() - daysAgo);
      return date;
    }

    // Try to parse "hours ago", "منذ ساعات"
    const hoursAgoMatch = dateText.match(/(\d+)\s*(?:hours?|ساعات?|ساعة)/);
    if (hoursAgoMatch) {
      const hoursAgo = parseInt(hoursAgoMatch[1], 10);
      const date = new Date(now);
      date.setHours(date.getHours() - hoursAgo);
      return date;
    }

    // Try to parse absolute date
    const parsed = new Date(dateText);
    if (!isNaN(parsed.getTime()) && parsed <= now) {
      return parsed;
    }

    // If we can't parse, assume it's recent (use current date)
    // This is safer than using fallback which might filter out jobs
    logger.debug(`Could not parse date: "${dateText}", using current date`);
    return new Date();
  }

  private extractSeniority(title: string): string | undefined {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('senior')) return 'senior';
    if (lowerTitle.includes('junior')) return 'junior';
    if (lowerTitle.includes('mid') || lowerTitle.includes('middle')) return 'mid';
    return undefined;
  }
}

