import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { v5 as uuidv5 } from 'uuid';
import { ClusterWeightConfig } from '../shared/types';

const UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

function locationId(qrNumber: number): string {
  return uuidv5(`grovewars-location-${qrNumber}`, UUID_NAMESPACE);
}

const stage = process.argv.includes('--stage')
  ? process.argv[process.argv.indexOf('--stage') + 1]
  : 'dev';

const tableName =
  process.env.CLUSTER_WEIGHT_CONFIG_TABLE || `grovewars-${stage}-cluster-weight-config`;

// Confirmed k=5 cluster profiles:
// nomad: Campus Nomads — 13 users, high visits, high diversity, sat 0.70
// seeker: Hidden Gem Seekers — 19 users, 86% Hidden Gem, low sat 0.57
// drifter: Social Drifters — 50 users, 58% Social Hub
// forced: Forced Occupants — 52 users, 95% Transit, avg 87 min stays
// disengaged: Disengaged Visitors — 6 users, 82% Dead Zone, sat 0.47
const config: ClusterWeightConfig = {
  configId: 'current',
  weights: {
    nomad:      { 'Social Hub': 0.5, 'Transit / Forced Stay': 1.0, 'Hidden Gem': 3.0, 'Dead Zone': 3.0, 'Unvisited': 5.0 },
    seeker:     { 'Social Hub': 1.0, 'Transit / Forced Stay': 0.5, 'Hidden Gem': 5.0, 'Dead Zone': 1.0, 'Unvisited': 2.0 },
    drifter:    { 'Social Hub': 3.0, 'Transit / Forced Stay': 1.0, 'Hidden Gem': 1.0, 'Dead Zone': 0.5, 'Unvisited': 0.5 },
    forced:     { 'Social Hub': 1.5, 'Transit / Forced Stay': 3.0, 'Hidden Gem': 1.5, 'Dead Zone': 0.5, 'Unvisited': 0.3 },
    disengaged: { 'Social Hub': 2.0, 'Transit / Forced Stay': 1.0, 'Hidden Gem': 0.5, 'Dead Zone': 0.3, 'Unvisited': 0.3 },
    null:       { 'Social Hub': 1.0, 'Transit / Forced Stay': 1.0, 'Hidden Gem': 1.0, 'Dead Zone': 1.0, 'Unvisited': 1.0 },
  },
  badPairings: {
    nomad:      [],
    seeker:     [],
    drifter:    [],
    forced:     [],
    disengaged: [locationId(19)],
  },
  assignmentCounts: {
    nomad: 5,
    seeker: 5,
    drifter: 4,
    forced: 4,
    disengaged: 3,
    null: 4,
  },
  updatedAt: new Date().toISOString(),
  updatedBy: 'system-seed',
};

async function main() {
  const client = new DynamoDBClient({ region: 'ap-south-1' });
  const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });

  try {
    await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: config as unknown as Record<string, unknown>,
      })
    );
    console.log(`Cluster weight config written to ${tableName}`);
  } catch (err) {
    console.error('Failed to write cluster weight config:', err);
    process.exit(1);
  }
}

main().catch(console.error);
