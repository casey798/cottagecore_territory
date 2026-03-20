import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { Phase1Cluster } from '../shared/types';

const stage = process.argv.includes('--stage')
  ? process.argv[process.argv.indexOf('--stage') + 1]
  : 'dev';

const usersTable = process.env.USERS_TABLE || `grovewars-${stage}-users`;

// Phase 1 confirmed cluster assignments — writes both phase1Cluster and computedCluster
const CLUSTER_DATA: Array<{ email: string; cluster: Phase1Cluster }> = [
  { email: "ajan@student.tce.edu", cluster: "disengaged" },
  { email: "firdose@student.tce.edu", cluster: "disengaged" },
  { email: "prajothana@student.tce.edu", cluster: "disengaged" },
  { email: "premkumaragasthia@student.tce.edu", cluster: "disengaged" },
  { email: "reshmadevi@student.tce.edu", cluster: "disengaged" },
  { email: "anupamaa@student.tce.edu", cluster: "drifter" },
  { email: "aruthra@student.tce.edu", cluster: "drifter" },
  { email: "ashath@student.tce.edu", cluster: "drifter" },
  { email: "cathrine@student.tce.edu", cluster: "drifter" },
  { email: "elamathik@student.tce.edu", cluster: "drifter" },
  { email: "hariss@student.tce.edu", cluster: "drifter" },
  { email: "jeevanantham@student.tce.edu", cluster: "drifter" },
  { email: "jeyavarshini@student.tce.edu", cluster: "drifter" },
  { email: "karthim@student.tce.edu", cluster: "drifter" },
  { email: "krithik@student.tce.edu", cluster: "drifter" },
  { email: "monishaa@student.tce.edu", cluster: "drifter" },
  { email: "nandhanaharini@student.tce.edu", cluster: "drifter" },
  { email: "naya@student.tce.edu", cluster: "drifter" },
  { email: "pandiraj@student.tce.edu", cluster: "drifter" },
  { email: "pavadharani@student.tce.edu", cluster: "drifter" },
  { email: "prabhakaranm@student.tce.edu", cluster: "drifter" },
  { email: "priyadarsini@student.tce.edu", cluster: "drifter" },
  { email: "rakkshanaa@student.tce.edu", cluster: "drifter" },
  { email: "rathiarputha@student.tce.edu", cluster: "drifter" },
  { email: "rethanyas@student.tce.edu", cluster: "drifter" },
  { email: "sabarinathanm@student.tce.edu", cluster: "drifter" },
  { email: "sandrea@student.tce.edu", cluster: "drifter" },
  { email: "sdhivya@student.tce.edu", cluster: "drifter" },
  { email: "sherenerenee@student.tce.edu", cluster: "drifter" },
  { email: "sherin@student.tce.edu", cluster: "drifter" },
  { email: "shreyam@student.tce.edu", cluster: "drifter" },
  { email: "subhiksha@student.tce.edu", cluster: "drifter" },
  { email: "yamini@student.tce.edu", cluster: "drifter" },
  { email: "ameen@student.tce.edu", cluster: "forced" },
  { email: "amirthavarshinips@student.tce.edu", cluster: "forced" },
  { email: "amrishkarthik@student.tce.edu", cluster: "forced" },
  { email: "avantikap@student.tce.edu", cluster: "forced" },
  { email: "baratkumar@student.tce.edu", cluster: "forced" },
  { email: "crajalakshmi@student.tce.edu", cluster: "forced" },
  { email: "deeshithaa@student.tce.edu", cluster: "forced" },
  { email: "dharanidharan@student.tce.edu", cluster: "forced" },
  { email: "hariharanjd@student.tce.edu", cluster: "forced" },
  { email: "harinisri@student.tce.edu", cluster: "forced" },
  { email: "harinisrik@student.tce.edu", cluster: "forced" },
  { email: "jayarahul@student.tce.edu", cluster: "forced" },
  { email: "kavinanand@student.tce.edu", cluster: "forced" },
  { email: "kavinrajr@student.tce.edu", cluster: "forced" },
  { email: "keerthanak1@student.tce.edu", cluster: "forced" },
  { email: "meenal@student.tce.edu", cluster: "forced" },
  { email: "mroshini1@student.tce.edu", cluster: "forced" },
  { email: "paavendhan@student.tce.edu", cluster: "forced" },
  { email: "prajin@student.tce.edu", cluster: "forced" },
  { email: "ragavir@student.tce.edu", cluster: "forced" },
  { email: "rahulml@student.tce.edu", cluster: "forced" },
  { email: "rajashrism@student.tce.edu", cluster: "forced" },
  { email: "ranjithrajan@student.tce.edu", cluster: "forced" },
  { email: "rayhan@student.tce.edu", cluster: "forced" },
  { email: "rohithr1@student.tce.edu", cluster: "forced" },
  { email: "saishwarya1@student.tce.edu", cluster: "forced" },
  { email: "sajini@student.tce.edu", cluster: "forced" },
  { email: "satheshg@student.tce.edu", cluster: "forced" },
  { email: "seenivasanb@student.tce.edu", cluster: "forced" },
  { email: "shahanabenezeer@student.tce.edu", cluster: "forced" },
  { email: "shivanandhanna@student.tce.edu", cluster: "forced" },
  { email: "sindhujaj@student.tce.edu", cluster: "forced" },
  { email: "skarthika1@student.tce.edu", cluster: "forced" },
  { email: "subikshaac@student.tce.edu", cluster: "forced" },
  { email: "sugisivam@student.tce.edu", cluster: "forced" },
  { email: "swathiga@student.tce.edu", cluster: "forced" },
  { email: "thaiya@student.tce.edu", cluster: "forced" },
  { email: "thanishavarthini@student.tce.edu", cluster: "forced" },
  { email: "varsithasri@student.tce.edu", cluster: "forced" },
  { email: "yashtika@student.tce.edu", cluster: "forced" },
  { email: "jeromy@student.tce.edu", cluster: "nomad" },
  { email: "kerthanasri@student.tce.edu", cluster: "nomad" },
  { email: "madhumithak1@student.tce.edu", cluster: "nomad" },
  { email: "saitapasya@student.tce.edu", cluster: "nomad" },
  { email: "senarch@tce.edu", cluster: "nomad" },
  { email: "shruthirajalakshmi@student.tce.edu", cluster: "nomad" },
  { email: "svarshini2@student.tce.edu", cluster: "nomad" },
  { email: "bairavim@student.tce.edu", cluster: "seeker" },
  { email: "gviarch@tce.edu", cluster: "seeker" },
  { email: "harinisoundharya@student.tce.edu", cluster: "seeker" },
  { email: "jegadharani@student.tce.edu", cluster: "seeker" },
  { email: "mthirumurugan@student.tce.edu", cluster: "seeker" },
  { email: "ppharch@tce.edu", cluster: "seeker" },
  { email: "renusritha@student.tce.edu", cluster: "seeker" },
  { email: "sairakshana@student.tce.edu", cluster: "seeker" },
  { email: "sanjeeth@student.tce.edu", cluster: "seeker" },
  { email: "sararch@tce.edu", cluster: "seeker" },
  { email: "shanjai@student.tce.edu", cluster: "seeker" },
];

const BATCH_SIZE = 25;
const BATCH_DELAY_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const client = new DynamoDBClient({ region: 'ap-south-1' });
  const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });

  const seasonStart = new Date().toISOString();
  let matched = 0;
  let unmatched = 0;

  for (let i = 0; i < CLUSTER_DATA.length; i += BATCH_SIZE) {
    const batch = CLUSTER_DATA.slice(i, i + BATCH_SIZE);

    for (const entry of batch) {
      try {
        // Look up user by email via EmailIndex GSI
        const queryResult = await docClient.send(
          new QueryCommand({
            TableName: usersTable,
            IndexName: 'EmailIndex',
            KeyConditionExpression: 'email = :email',
            ExpressionAttributeValues: { ':email': entry.email },
            Limit: 1,
          })
        );

        if (queryResult.Items && queryResult.Items.length > 0) {
          const userId = queryResult.Items[0].userId as string;

          // Write both phase1Cluster and computedCluster
          await docClient.send(
            new UpdateCommand({
              TableName: usersTable,
              Key: { userId },
              UpdateExpression:
                'SET phase1Cluster = :cluster, computedCluster = :cluster, ' +
                'clusterComputedAt = :at, clusterFeatureWindow = :window',
              ExpressionAttributeValues: {
                ':cluster': entry.cluster,
                ':at': seasonStart,
                ':window': 'phase1-seed',
              },
            })
          );
          matched++;
        } else {
          console.log(`Unmatched: ${entry.email}`);
          unmatched++;
        }
      } catch (err) {
        console.error(`Error processing ${entry.email}:`, err);
        unmatched++;
      }
    }

    // Rate limit between batches
    if (i + BATCH_SIZE < CLUSTER_DATA.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log(`\nDone. Matched: ${matched}, Unmatched: ${unmatched}`);
}

main().catch(console.error);
