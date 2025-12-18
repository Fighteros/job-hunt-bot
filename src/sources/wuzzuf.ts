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

      // Wuzzuf job listing structure (adjust selectors as needed)
      $('.css-1gatmva, .css-1gatmva-e').each((_, element) => {
        try {
          const $job = $(element);
          const title = $job.find('h2 a, .css-1gatmva-e a').first().text().trim();
          const company = $job.find('.css-17s97q8, .css-1gatmva-e .css-17s97q8').first().text().trim();
          const location = $job.find('.css-5wys0k, .css-1gatmva-e .css-5wys0k').first().text().trim() || 'Egypt';
          const url = $job.find('h2 a, .css-1gatmva-e a').first().attr('href') || '';
          const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
          
          // Try to extract posted date from the job card
          const postedText = $job.find('.css-1gatmva-e .css-4x4xq, .css-4x4xq').first().text().trim();
          const postedAt = this.parseDate(postedText, since);

          if (!title || !company) {
            return; // Skip invalid entries
          }

          // Only include jobs posted after the 'since' date
          if (postedAt < since) {
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

      logger.info(`Fetched ${normalizedJobs.length} jobs from ${this.name}`);
      return normalizedJobs;
    } catch (error) {
      logger.error(`Error fetching jobs from ${this.name}`, error);
      throw error;
    }
  }

  private parseDate(dateText: string, fallback: Date): Date {
    if (!dateText) return fallback;

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

    // Try to parse relative dates like "2 days ago"
    const daysAgoMatch = dateText.match(/(\d+)\s*(?:days?|أيام)/);
    if (daysAgoMatch) {
      const daysAgo = parseInt(daysAgoMatch[1], 10);
      const date = new Date(now);
      date.setDate(date.getDate() - daysAgo);
      return date;
    }

    // Try to parse absolute date
    const parsed = new Date(dateText);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }

    return fallback;
  }

  private extractSeniority(title: string): string | undefined {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('senior')) return 'senior';
    if (lowerTitle.includes('junior')) return 'junior';
    if (lowerTitle.includes('mid') || lowerTitle.includes('middle')) return 'mid';
    return undefined;
  }
}

