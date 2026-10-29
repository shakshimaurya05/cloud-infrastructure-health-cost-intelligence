import {
  DescribeInstancesCommand,
  DescribeVolumesCommand,
  DescribeAddressesCommand
} from '@aws-sdk/client-ec2';
import { ec2Client, getExecutionMode, checkAwsConfigured } from '../config/aws.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseTags(tags = [], fallbackId = '') {
  const tagsMap = {};
  let name = fallbackId;
  for (const tag of tags) {
    if (tag.Key) {
      tagsMap[tag.Key] = tag.Value;
      if (tag.Key.toLowerCase() === 'name' && tag.Value) name = tag.Value;
    }
  }
  return { name, tagsMap };
}

function isPermissionError(err) {
  return (
    err.name === 'UnauthorizedOperation' ||
    err.name === 'AccessDeniedException' ||
    err.Code === 'UnauthorizedOperation' ||
    (err.$metadata?.httpStatusCode === 403)
  );
}

function buildLiveError(err) {
  const e = new Error(`AWS Error: ${err.message}`);
  e.code = err.name || 'AWS_ERROR';
  e.statusCode = err.$metadata?.httpStatusCode || 500;
  e.permissionDenied = isPermissionError(err);
  return e;
}


export async function getInventoryInstances() {
  const isConfigured = await checkAwsConfigured();
  const mode = getExecutionMode(isConfigured);

  if (mode === 'demo') {
    return { instances: getDemoInventoryInstances(), mode: 'demo' };
  }

  try {
    const instances = [];
    let nextToken;

    do {
      const command = new DescribeInstancesCommand({
        MaxResults: 100,
        ...(nextToken ? { NextToken: nextToken } : {})
      });
      const response = await ec2Client.send(command);
      nextToken = response.NextToken;

      for (const reservation of response.Reservations || []) {
        for (const inst of reservation.Instances || []) {
          const { name, tagsMap } = parseTags(inst.Tags, inst.InstanceId);
          const az = inst.Placement?.AvailabilityZone || 'unknown';
          const region = az.length > 1 ? az.slice(0, -1) : 'unknown';

          instances.push({
            instanceId: inst.InstanceId,
            name,
            state: inst.State?.Name || 'unknown',
            instanceType: inst.InstanceType || 'unknown',
            region,
            availabilityZone: az,
            launchTime: inst.LaunchTime ? new Date(inst.LaunchTime).toISOString() : null,
            publicIp: inst.PublicIpAddress || null,
            privateIp: inst.PrivateIpAddress || null,
            platform: inst.Platform || 'linux',
            vpcId: inst.VpcId || null,
            subnetId: inst.SubnetId || null,
            imageId: inst.ImageId || null,
            keyName: inst.KeyName || null,
            monitoring: inst.Monitoring?.State || 'disabled',
            tags: tagsMap
          });
        }
      }
    } while (nextToken);

    return { instances, mode: 'live' };
  } catch (error) {
    console.warn(`[Inventory] EC2 instances query failed: ${error.message}`);

    if (process.env.DEMO_MODE === 'live' || process.env.DEMO_MODE === 'false') {
      throw buildLiveError(error);
    }

    return {
      instances: getDemoInventoryInstances(),
      mode: 'demo',
      warning: `AWS live query unavailable (${error.name}). Showing demo data.`
    };
  }
}


export async function getInventoryVolumes() {
  const isConfigured = await checkAwsConfigured();
  const mode = getExecutionMode(isConfigured);

  if (mode === 'demo') {
    return { volumes: getDemoInventoryVolumes(), mode: 'demo' };
  }

  try {
    const volumes = [];
    let nextToken;

    do {
      const command = new DescribeVolumesCommand({
        MaxResults: 100,
        ...(nextToken ? { NextToken: nextToken } : {})
      });
      const response = await ec2Client.send(command);
      nextToken = response.NextToken;

      for (const vol of response.Volumes || []) {
        const { name, tagsMap } = parseTags(vol.Tags, vol.VolumeId);
        const attachment = (vol.Attachments || [])[0] || null;

        volumes.push({
          volumeId: vol.VolumeId,
          name,
          size: vol.Size,
          volumeType: vol.VolumeType || 'unknown',
          state: vol.State || 'unknown',
          availabilityZone: vol.AvailabilityZone || 'unknown',
          encrypted: vol.Encrypted === true,
          iops: vol.Iops || null,
          throughput: vol.Throughput || null,
          createTime: vol.CreateTime ? new Date(vol.CreateTime).toISOString() : null,
          snapshotId: vol.SnapshotId || null,
          attachedInstanceId: attachment?.InstanceId || null,
          attachmentDevice: attachment?.Device || null,
          attachmentState: attachment?.State || null,
          deleteOnTermination: attachment?.DeleteOnTermination ?? null,
          tags: tagsMap
        });
      }
    } while (nextToken);

    return { volumes, mode: 'live' };
  } catch (error) {
    console.warn(`[Inventory] EBS volumes query failed: ${error.message}`);

    if (process.env.DEMO_MODE === 'live' || process.env.DEMO_MODE === 'false') {
      throw buildLiveError(error);
    }

    return {
      volumes: getDemoInventoryVolumes(),
      mode: 'demo',
      warning: `AWS live query unavailable (${error.name}). Showing demo data.`
    };
  }
}

// ─── Elastic IPs ─────────────────────────────────────────────────────────────

/**
 * Fetches ALL Elastic IPs. DescribeAddresses has no pagination token.
 */
export async function getInventoryElasticIps() {
  const isConfigured = await checkAwsConfigured();
  const mode = getExecutionMode(isConfigured);

  if (mode === 'demo') {
    return { elasticIps: getDemoInventoryElasticIps(), mode: 'demo' };
  }

  try {
    const command = new DescribeAddressesCommand({});
    const response = await ec2Client.send(command);

    const elasticIps = (response.Addresses || []).map((addr) => {
      const { name, tagsMap } = parseTags(addr.Tags, addr.AllocationId);
      return {
        allocationId: addr.AllocationId,
        publicIp: addr.PublicIp,
        name,
        domain: addr.Domain || 'vpc',
        associated: !!addr.AssociationId,
        associationId: addr.AssociationId || null,
        associatedInstanceId: addr.InstanceId || null,
        associatedNetworkInterfaceId: addr.NetworkInterfaceId || null,
        privateIpAddress: addr.PrivateIpAddress || null,
        publicIpv4Pool: addr.PublicIpv4Pool || null,
        networkBorderGroup: addr.NetworkBorderGroup || null,
        tags: tagsMap
      };
    });

    return { elasticIps, mode: 'live' };
  } catch (error) {
    console.warn(`[Inventory] Elastic IPs query failed: ${error.message}`);

    if (process.env.DEMO_MODE === 'live' || process.env.DEMO_MODE === 'false') {
      throw buildLiveError(error);
    }

    return {
      elasticIps: getDemoInventoryElasticIps(),
      mode: 'demo',
      warning: `AWS live query unavailable (${error.name}). Showing demo data.`
    };
  }
}

// ─── Demo Data ────────────────────────────────────────────────────────────────

export function getDemoInventoryInstances() {
  return [
    {
      instanceId: 'i-09a8b7c6d5e4f3a21',
      name: 'production-api-01',
      state: 'running',
      instanceType: 't3.xlarge',
      region: 'us-east-1',
      availabilityZone: 'us-east-1a',
      launchTime: '2026-08-15T08:30:00.000Z',
      publicIp: '54.210.45.12',
      privateIp: '10.0.1.15',
      platform: 'linux',
      vpcId: 'vpc-0abc12345',
      subnetId: 'subnet-0def67890',
      imageId: 'ami-0123456789abcdef0',
      keyName: 'prod-keypair',
      monitoring: 'enabled',
      tags: { Environment: 'Production', Project: 'Core-API', Owner: 'DevOps' }
    },
    {
      instanceId: 'i-07b6c5d4e3f2a1b90',
      name: 'production-worker-01',
      state: 'running',
      instanceType: 'm5.large',
      region: 'us-east-1',
      availabilityZone: 'us-east-1b',
      launchTime: '2026-08-20T11:15:00.000Z',
      publicIp: '54.210.78.33',
      privateIp: '10.0.2.24',
      platform: 'linux',
      vpcId: 'vpc-0abc12345',
      subnetId: 'subnet-0bcd56789',
      imageId: 'ami-0123456789abcdef0',
      keyName: 'prod-keypair',
      monitoring: 'disabled',
      tags: { Environment: 'Production', Project: 'Queue-Worker', Owner: 'Backend' }
    },
    {
      instanceId: 'i-03e2f1a0b9c8d7e65',
      name: 'staging-api-01',
      state: 'running',
      instanceType: 't3.medium',
      region: 'us-east-1',
      availabilityZone: 'us-east-1a',
      launchTime: '2026-09-01T14:00:00.000Z',
      publicIp: '34.201.12.90',
      privateIp: '10.0.1.88',
      platform: 'linux',
      vpcId: 'vpc-0abc12345',
      subnetId: 'subnet-0def67890',
      imageId: 'ami-0123456789abcdef0',
      keyName: 'staging-keypair',
      monitoring: 'disabled',
      tags: { Environment: 'Staging', Project: 'Core-API', Owner: 'QA' }
    },
    {
      instanceId: 'i-05c4d3e2f1a0b9c87',
      name: 'analytics-db-replica',
      state: 'stopped',
      instanceType: 'r5.xlarge',
      region: 'us-east-1',
      availabilityZone: 'us-east-1c',
      launchTime: '2026-07-10T09:00:00.000Z',
      publicIp: null,
      privateIp: '10.0.3.50',
      platform: 'linux',
      vpcId: 'vpc-0abc12345',
      subnetId: 'subnet-0efd98765',
      imageId: 'ami-0fedcba9876543210',
      keyName: 'data-keypair',
      monitoring: 'disabled',
      tags: { Environment: 'Production', Project: 'Analytics', Owner: 'DataTeam' }
    },
    {
      instanceId: 'i-01f2e3d4c5b6a7980',
      name: 'dev-bastion-host',
      state: 'stopped',
      instanceType: 't3.nano',
      region: 'us-east-1',
      availabilityZone: 'us-east-1a',
      launchTime: '2026-09-15T16:45:00.000Z',
      publicIp: null,
      privateIp: '10.0.1.200',
      platform: 'linux',
      vpcId: 'vpc-0abc12345',
      subnetId: 'subnet-0def67890',
      imageId: 'ami-0123456789abcdef0',
      keyName: 'bastion-keypair',
      monitoring: 'disabled',
      tags: { Environment: 'Development', Project: 'Bastion', Owner: 'Security' }
    },
    {
      instanceId: 'i-0a1b2c3d4e5f6a7b8',
      name: 'ml-training-node-01',
      state: 'terminated',
      instanceType: 'p3.2xlarge',
      region: 'us-east-1',
      availabilityZone: 'us-east-1b',
      launchTime: '2026-10-01T06:00:00.000Z',
      publicIp: null,
      privateIp: null,
      platform: 'linux',
      vpcId: null,
      subnetId: null,
      imageId: 'ami-0abcdef1234567890',
      keyName: null,
      monitoring: 'disabled',
      tags: { Environment: 'Development', Project: 'ML-Research', Owner: 'DataScience' }
    }
  ];
}

export function getDemoInventoryVolumes() {
  return [
    {
      volumeId: 'vol-01a2b3c4d5e6f7891',
      name: 'prod-api-root',
      size: 50,
      volumeType: 'gp3',
      state: 'in-use',
      availabilityZone: 'us-east-1a',
      encrypted: true,
      iops: 3000,
      throughput: 125,
      createTime: '2026-08-15T08:25:00.000Z',
      snapshotId: 'snap-0abc123456789def0',
      attachedInstanceId: 'i-09a8b7c6d5e4f3a21',
      attachmentDevice: '/dev/xvda',
      attachmentState: 'attached',
      deleteOnTermination: true,
      tags: { Environment: 'Production', Project: 'Core-API' }
    },
    {
      volumeId: 'vol-02b3c4d5e6f7a8902',
      name: 'prod-api-data',
      size: 200,
      volumeType: 'gp3',
      state: 'in-use',
      availabilityZone: 'us-east-1a',
      encrypted: true,
      iops: 6000,
      throughput: 250,
      createTime: '2026-08-15T08:26:00.000Z',
      snapshotId: null,
      attachedInstanceId: 'i-09a8b7c6d5e4f3a21',
      attachmentDevice: '/dev/xvdb',
      attachmentState: 'attached',
      deleteOnTermination: false,
      tags: { Environment: 'Production', Project: 'Core-API' }
    },
    {
      volumeId: 'vol-03c4d5e6f7a8b9013',
      name: 'prod-worker-root',
      size: 30,
      volumeType: 'gp3',
      state: 'in-use',
      availabilityZone: 'us-east-1b',
      encrypted: true,
      iops: 3000,
      throughput: 125,
      createTime: '2026-08-20T11:10:00.000Z',
      snapshotId: 'snap-0def456789abc0123',
      attachedInstanceId: 'i-07b6c5d4e3f2a1b90',
      attachmentDevice: '/dev/xvda',
      attachmentState: 'attached',
      deleteOnTermination: true,
      tags: { Environment: 'Production', Project: 'Queue-Worker' }
    },
    {
      volumeId: 'vol-04d5e6f7a8b9c0124',
      name: 'analytics-db-data',
      size: 500,
      volumeType: 'io1',
      state: 'in-use',
      availabilityZone: 'us-east-1c',
      encrypted: true,
      iops: 10000,
      throughput: null,
      createTime: '2026-07-10T08:55:00.000Z',
      snapshotId: 'snap-0ghi789012def3456',
      attachedInstanceId: 'i-05c4d3e2f1a0b9c87',
      attachmentDevice: '/dev/xvdb',
      attachmentState: 'attached',
      deleteOnTermination: false,
      tags: { Environment: 'Production', Project: 'Analytics', Owner: 'DataTeam' }
    },
    {
      volumeId: 'vol-05e6f7a8b9c0d1235',
      name: 'orphaned-snapshot-backup',
      size: 100,
      volumeType: 'gp2',
      state: 'available',
      availabilityZone: 'us-east-1a',
      encrypted: false,
      iops: 300,
      throughput: null,
      createTime: '2026-06-01T12:00:00.000Z',
      snapshotId: 'snap-0jkl012345ghi6789',
      attachedInstanceId: null,
      attachmentDevice: null,
      attachmentState: null,
      deleteOnTermination: null,
      tags: { Project: 'Legacy-Backup' }
    },
    {
      volumeId: 'vol-06f7a8b9c0d1e2346',
      name: 'staging-api-root',
      size: 30,
      volumeType: 'gp3',
      state: 'in-use',
      availabilityZone: 'us-east-1a',
      encrypted: true,
      iops: 3000,
      throughput: 125,
      createTime: '2026-09-01T13:55:00.000Z',
      snapshotId: null,
      attachedInstanceId: 'i-03e2f1a0b9c8d7e65',
      attachmentDevice: '/dev/xvda',
      attachmentState: 'attached',
      deleteOnTermination: true,
      tags: { Environment: 'Staging', Project: 'Core-API' }
    }
  ];
}

export function getDemoInventoryElasticIps() {
  return [
    {
      allocationId: 'eipalloc-0abc1234567890001',
      publicIp: '54.210.45.12',
      name: 'prod-api-eip',
      domain: 'vpc',
      associated: true,
      associationId: 'eipassoc-0abc1234567890001',
      associatedInstanceId: 'i-09a8b7c6d5e4f3a21',
      associatedNetworkInterfaceId: 'eni-0abc1234567890001',
      privateIpAddress: '10.0.1.15',
      publicIpv4Pool: 'amazon',
      networkBorderGroup: 'us-east-1',
      tags: { Environment: 'Production', Project: 'Core-API', Name: 'prod-api-eip' }
    },
    {
      allocationId: 'eipalloc-0def4567890abcd02',
      publicIp: '54.210.78.33',
      name: 'prod-worker-eip',
      domain: 'vpc',
      associated: true,
      associationId: 'eipassoc-0def4567890abcd02',
      associatedInstanceId: 'i-07b6c5d4e3f2a1b90',
      associatedNetworkInterfaceId: 'eni-0def4567890abcd02',
      privateIpAddress: '10.0.2.24',
      publicIpv4Pool: 'amazon',
      networkBorderGroup: 'us-east-1',
      tags: { Environment: 'Production', Project: 'Queue-Worker', Name: 'prod-worker-eip' }
    },
    {
      allocationId: 'eipalloc-0ghi7890bcdef1203',
      publicIp: '34.201.12.90',
      name: 'staging-api-eip',
      domain: 'vpc',
      associated: true,
      associationId: 'eipassoc-0ghi7890bcdef1203',
      associatedInstanceId: 'i-03e2f1a0b9c8d7e65',
      associatedNetworkInterfaceId: 'eni-0ghi7890bcdef1203',
      privateIpAddress: '10.0.1.88',
      publicIpv4Pool: 'amazon',
      networkBorderGroup: 'us-east-1',
      tags: { Environment: 'Staging', Name: 'staging-api-eip' }
    },
    {
      allocationId: 'eipalloc-0jkl1234abcde5604',
      publicIp: '18.204.33.77',
      name: 'unassociated-reserved-eip',
      domain: 'vpc',
      associated: false,
      associationId: null,
      associatedInstanceId: null,
      associatedNetworkInterfaceId: null,
      privateIpAddress: null,
      publicIpv4Pool: 'amazon',
      networkBorderGroup: 'us-east-1',
      tags: { Note: 'Reserved for DR', Name: 'unassociated-reserved-eip' }
    }
  ];
}
