import dotenv from 'dotenv';
import { EC2Client } from '@aws-sdk/client-ec2';
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';
import { CostExplorerClient } from '@aws-sdk/client-cost-explorer';

dotenv.config();

const region = process.env.AWS_REGION || 'us-east-1';

// AWS SDK v3 client configuration
// If AWS_ACCESS_KEY_ID & AWS_SECRET_ACCESS_KEY are provided in env, use them;
// otherwise fall back automatically to the standard default credential provider chain:
// (Local ~/.aws/credentials, AWS_PROFILE, IAM Roles, ECS Task Roles, etc.)
const clientConfig = {
  region
};

if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  clientConfig.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    ...(process.env.AWS_SESSION_TOKEN ? { sessionToken: process.env.AWS_SESSION_TOKEN } : {})
  };
}

export const ec2Client = new EC2Client(clientConfig);
export const cloudWatchClient = new CloudWatchClient(clientConfig);
export const costExplorerClient = new CostExplorerClient(clientConfig);

let cachedConfigStatus = null;
let lastCheckTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

/**
 * Checks if valid AWS credentials can be resolved via the provider chain.
 * @returns {Promise<boolean>}
 */
export async function checkAwsConfigured() {
  const now = Date.now();
  if (cachedConfigStatus !== null && (now - lastCheckTime < CACHE_TTL_MS)) {
    return cachedConfigStatus;
  }

  try {
    const creds = await ec2Client.config.credentials();
    if (creds && creds.accessKeyId) {
      cachedConfigStatus = true;
      lastCheckTime = now;
      return true;
    }
    cachedConfigStatus = false;
    lastCheckTime = now;
    return false;
  } catch (error) {
    cachedConfigStatus = false;
    lastCheckTime = now;
    return false;
  }
}

/**
 * Determines whether the system should run in 'live' or 'demo' mode.
 * @param {boolean} awsAvailable - Whether AWS credentials resolved successfully.
 * @returns {'live' | 'demo'}
 */
export function getExecutionMode(awsAvailable = false) {
  const envMode = (process.env.DEMO_MODE || 'auto').toLowerCase();

  if (envMode === 'demo' || envMode === 'true') {
    return 'demo';
  }

  if (envMode === 'live' || envMode === 'false') {
    return 'live';
  }

  // 'auto' mode: prefer live if credentials exist, otherwise demo
  return awsAvailable ? 'live' : 'demo';
}

export const awsConfig = {
  region,
  configured: checkAwsConfigured
};
