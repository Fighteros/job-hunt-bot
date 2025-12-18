import { JobSource } from './base';
import { RemoteOKSource } from './remoteok';
import { WeWorkRemotelySource } from './weworkremotely';
import { WuzzufSource } from './wuzzuf';
import { Config } from '../config';

/**
 * Factory function to create enabled job sources based on configuration
 */
export function createJobSources(config: Config): JobSource[] {
  const sources: JobSource[] = [];

  if (config.enableRemoteOK) {
    sources.push(new RemoteOKSource());
  }

  if (config.enableWWR) {
    sources.push(new WeWorkRemotelySource());
  }

  if (config.enableWuzzuf) {
    sources.push(new WuzzufSource());
  }

  // LinkedIn can be added in future phases
  // if (config.enableLinkedIn) {
  //   sources.push(new LinkedInSource());
  // }

  return sources;
}

