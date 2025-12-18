import puppeteer, { Browser, Page } from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { JobSource } from "./base";
import { NormalizedJob } from "../types/job";
import { logger } from "../utils/logger";

/**
 * Wuzzuf scraping adapter
 * Uses Puppeteer to handle React SPA dynamic content
 */
export class WuzzufSource implements JobSource {
  readonly name = "wuzzuf";
  private readonly baseUrl = "https://wuzzuf.net";

  async fetchJobs(since: Date): Promise<NormalizedJob[]> {
    let browser: Browser | null = null;

    try {
      logger.info(
        `Fetching jobs from ${this.name} since ${since.toISOString()}`
      );

      // Wuzzuf search URL for remote/backend jobs
      const searchUrl = `${this.baseUrl}/search/jobs?q=${encodeURIComponent(
        process.env.JOB_QUERY_KEYWORDS!.split(",").join("+")
      )}+remote&filters[country][]=Egypt`;

      // Launch browser with serverless-optimized settings
      browser = await this.launchBrowser();
      const page = await browser.newPage();

      // Set viewport and user agent
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
      );

      logger.info(`Navigating to ${searchUrl}`);
      await page.goto(searchUrl, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      // Wait for the React app to render job listings
      // Try multiple selectors that might indicate jobs are loaded
      logger.info("Waiting for job listings to load...");
      
      try {
        // Wait for any job-related element to appear
        await page.waitForSelector(
          'a[href*="/jobs/"], [data-testid*="job"], article, .css-1gatmva',
          { timeout: 15000 }
        );
      } catch (error) {
        logger.warn("Timeout waiting for job selectors, proceeding anyway");
      }

      // Give additional time for React to fully render
      await page.waitForTimeout(2000);

      // Extract job data from the rendered page
      const normalizedJobs = await this.extractJobsFromPage(page, since);

      logger.info(
        `Fetched ${normalizedJobs.length} jobs from ${this.name}`
      );

      return normalizedJobs;
    } catch (error) {
      logger.error(`Error fetching jobs from ${this.name}`, error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  private async launchBrowser(): Promise<Browser> {
    // Check if we're in a serverless environment (Vercel)
    const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;

    if (isServerless) {
      // Use serverless-optimized Chromium
      return await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
      });
    } else {
      // Local development - use system Chrome/Chromium
      return await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    }
  }

  private async extractJobsFromPage(
    page: Page,
    since: Date
  ): Promise<NormalizedJob[]> {
    const normalizedJobs: NormalizedJob[] = [];

    // Try multiple strategies to find job listings
    // Note: page.evaluate runs in browser context where DOM types are available
    const extractedJobs = await page.evaluate(() => {
      interface JobInfo {
        title: string;
        company: string;
        location: string;
        url: string;
        postedText: string;
      }

      const jobs: JobInfo[] = [];

      // Strategy 1: Find all links to job detail pages
      const allLinks = Array.from(
        document.querySelectorAll<HTMLAnchorElement>('a[href*="/jobs/"]')
      );
      const jobLinks = allLinks.filter((link) => {
        const href = link.getAttribute("href") || "";
        return href.includes("/jobs/") && !href.includes("/search");
      });

      for (const link of jobLinks.slice(0, 50)) {
        // Skip if we've already processed this job
        const href = link.getAttribute("href") || "";
        if (jobs.some((j) => j.url === href)) continue;

        // Find the parent container (job card)
        let container: Element | null = link;
        for (let i = 0; i < 5; i++) {
          container = container?.parentElement || null;
          if (!container) break;

          // Check if this looks like a job card container
          const hasJobIndicators =
            container.querySelector('[class*="company"]') ||
            container.querySelector('[class*="Company"]') ||
            container.querySelector('[class*="location"]') ||
            container.querySelector('[class*="Location"]');

          if (hasJobIndicators) break;
        }

        if (!container) continue;

        // Extract title
        const titleElement = link.querySelector("h2, h3, .title") as HTMLElement | null;
        const title =
          link.textContent?.trim() ||
          titleElement?.textContent?.trim() ||
          "";

        if (!title || title.length < 3) continue;

        // Extract company
        const companyElement =
          (container.querySelector('[class*="company"]') as HTMLElement) ||
          (container.querySelector('[class*="Company"]') as HTMLElement) ||
          Array.from(container.querySelectorAll("*")).find((el) => {
            const element = el as HTMLElement;
            return element.className?.toLowerCase().includes("company");
          }) as HTMLElement | undefined;
        const company =
          companyElement?.textContent?.trim() ||
          (container.querySelectorAll("*").item(1) as HTMLElement)
            ?.textContent?.trim()
            .split("\n")[0] ||
          "Unknown Company";

        // Extract location
        const locationElement =
          (container.querySelector('[class*="location"]') as HTMLElement) ||
          (container.querySelector('[class*="Location"]') as HTMLElement) ||
          Array.from(container.querySelectorAll("*")).find((el) => {
            const element = el as HTMLElement;
            return element.className?.toLowerCase().includes("location");
          }) as HTMLElement | undefined;
        const location =
          locationElement?.textContent?.trim() || "Egypt";

        // Extract posted date
        const dateElement =
          (container.querySelector('[class*="date"]') as HTMLElement) ||
          (container.querySelector('[class*="time"]') as HTMLElement) ||
          (container.querySelector('[class*="posted"]') as HTMLElement) ||
          Array.from(container.querySelectorAll("*")).find((el) => {
            const element = el as HTMLElement;
            const text = element.textContent?.toLowerCase() || "";
            return (
              text.includes("ago") ||
              text.includes("منذ") ||
              text.includes("today") ||
              text.includes("اليوم")
            );
          }) as HTMLElement | undefined;
        const postedText = dateElement?.textContent?.trim() || "";

        // Build full URL
        const url = href.startsWith("http") ? href : `https://wuzzuf.net${href}`;

        jobs.push({
          title,
          company: company.substring(0, 100), // Limit length
          location: location.substring(0, 100),
          url,
          postedText,
        });
      }

      return jobs;
    });

    // Normalize and filter jobs
    for (const jobInfo of extractedJobs) {
      try {
        const postedAt = this.parseDate(jobInfo.postedText, new Date());

        // Only include jobs posted after the 'since' date
        if (postedAt < since) {
          logger.debug(
            `Skipping job "${jobInfo.title}" - posted at ${postedAt.toISOString()}, since ${since.toISOString()}`
          );
          continue;
        }

        if (!jobInfo.title || jobInfo.title.length < 3) {
          continue;
        }

        const normalized: NormalizedJob = {
          title: jobInfo.title,
          company: jobInfo.company || "Unknown Company",
          location: jobInfo.location || "Egypt",
          platform: this.name,
          url: jobInfo.url,
          postedAt,
          seniority: this.extractSeniority(jobInfo.title),
          employmentType: "full-time",
        };

        normalizedJobs.push(normalized);
      } catch (error) {
        logger.warn(`Failed to normalize job from ${this.name}`, {
          error,
          jobInfo,
        });
      }
    }

    return normalizedJobs;
  }

  private parseDate(dateText: string, _fallback: Date): Date {
    if (!dateText) {
      // If no date text, assume it's recent (use current date to avoid filtering)
      return new Date();
    }

    const lower = dateText.toLowerCase();
    const now = new Date();

    if (lower.includes("today") || lower.includes("اليوم")) {
      return now;
    }
    if (lower.includes("yesterday") || lower.includes("أمس")) {
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
    if (lowerTitle.includes("senior")) return "senior";
    if (lowerTitle.includes("junior")) return "junior";
    if (lowerTitle.includes("mid") || lowerTitle.includes("middle"))
      return "mid";
    return undefined;
  }
}
