-- Jobs Table
-- Stores normalized jobs with global deduplication via hash primary key
CREATE TABLE IF NOT EXISTS jobs (
  hash VARCHAR(64) PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  company VARCHAR(255) NOT NULL,
  location VARCHAR(255) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  url TEXT NOT NULL,
  posted_at TIMESTAMP WITH TIME ZONE NOT NULL,
  seniority VARCHAR(50),
  tech_stack TEXT[],
  employment_type VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Job Notifications Table
-- Tracks which jobs were sent to which users
-- Composite primary key ensures no duplicate notifications
CREATE TABLE IF NOT EXISTS user_job_notifications (
  user_id BIGINT NOT NULL,
  job_hash VARCHAR(64) NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, job_hash),
  FOREIGN KEY (job_hash) REFERENCES jobs(hash) ON DELETE CASCADE
);

-- Users Table
-- Stores Telegram user information
CREATE TABLE IF NOT EXISTS users (
  telegram_id BIGINT PRIMARY KEY,
  username VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON jobs(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_platform ON jobs(platform);
CREATE INDEX IF NOT EXISTS idx_user_job_notifications_user_id ON user_job_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_job_notifications_job_hash ON user_job_notifications(job_hash);

