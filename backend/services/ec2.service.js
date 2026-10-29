import { DescribeInstancesCommand } from '@aws-sdk/client-ec2';
import { ec2Client, getExecutionMode, checkAwsConfigured } from '../config/aws.js';
import { getDemoInstances } from './demo.data.js';

/**
 * Parses tags array from EC2 into a key-value object and extracts instance name.
 * @param {Array<{ Key: string, Value: string }>} tags
 * @param {string} fallbackId
 * @returns {{ name: string, tagsMap: Record<string, string> }}
 */
function parseTags(tags = [], fallbackId = '') {
  const tagsMap = {};
  let name = fallbackId;

  for (const tag of tags) {
    if (tag.Key) {
      tagsMap[tag.Key] = tag.Value;
      if (tag.Key.toLowerCase() === 'name' && tag.Value) {
        name = tag.Value;
      }
    }
  }

  return { name, tagsMap };
}

/**
 * Fetches EC2 instances from AWS or fallback demo dataset.
 * Handles empty resource lists and error conditions gracefully.
 * 
 * @returns {Promise<{ instances: Array<object>, mode: 'live' | 'demo', error?: string }>}
 */
export async function getEc2Instances() {
  const isConfigured = await checkAwsConfigured();
  const executionMode = getExecutionMode(isConfigured);

  // Forced Demo Mode
  if (executionMode === 'demo' && (process.env.DEMO_MODE === 'demo' || process.env.DEMO_MODE === 'true')) {
    return {
      instances: getDemoInstances(),
      mode: 'demo'
    };
  }

  try {
    const command = new DescribeInstancesCommand({});
    const response = await ec2Client.send(command);

    const instances = [];
    const reservations = response.Reservations || [];

    for (const reservation of reservations) {
      const reservationInstances = reservation.Instances || [];
      for (const inst of reservationInstances) {
        const { name, tagsMap } = parseTags(inst.Tags, inst.InstanceId);

        instances.push({
          instanceId: inst.InstanceId,
          name,
          state: inst.State?.Name || 'unknown',
          instanceType: inst.InstanceType || 'unknown',
          availabilityZone: inst.Placement?.AvailabilityZone || 'unknown',
          launchTime: inst.LaunchTime ? new Date(inst.LaunchTime).toISOString() : null,
          publicIp: inst.PublicIpAddress || null,
          privateIp: inst.PrivateIpAddress || null,
          tags: tagsMap
        });
      }
    }

    return {
      instances,
      mode: 'live'
    };
  } catch (error) {
    console.warn(`[EC2 Service] Live AWS EC2 query failed: ${error.message}`);

    // If strict live mode is requested, propagate the error
    if (process.env.DEMO_MODE === 'live' || process.env.DEMO_MODE === 'false') {
      const err = new Error(`AWS EC2 Error: ${error.message}`);
      err.code = error.name || 'AWS_EC2_ERROR';
      err.statusCode = error.$metadata?.httpStatusCode || 500;
      throw err;
    }

    // Auto mode fallback to explicitly labeled demo data
    return {
      instances: getDemoInstances(),
      mode: 'demo',
      warning: `AWS live query unavailable (${error.name || error.message}). Showing simulated demo data.`
    };
  }
}
