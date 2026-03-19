import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { Phase1Cluster } from '../shared/types';

const stage = process.argv.includes('--stage')
  ? process.argv[process.argv.indexOf('--stage') + 1]
  : 'dev';

const usersTable = process.env.USERS_TABLE || `grovewars-${stage}-users`;

const CLUSTER_DATA: Array<{ email: string; cluster: Phase1Cluster }> = [
  { email: "madhumithak1@student.tce.edu", cluster: "nomad" },
  { email: "kerthanasri@student.tce.edu", cluster: "nomad" },
  { email: "svarshini2@student.tce.edu", cluster: "nomad" },
  { email: "aafreen.mbm@gmail.com", cluster: "nomad" },
  { email: "sindhujaj@student.tce.edu", cluster: "forced" },
  { email: "deeshithaa@student.tce.edu", cluster: "forced" },
  { email: "dharshithamano@gmail.com", cluster: "forced" },
  { email: "meenumaha96@gmail.com", cluster: "drifter" },
  { email: "kirthivasansenthilkumar@gmail.com", cluster: "drifter" },
  { email: "pranavam2504@gmail.com", cluster: "nomad" },
  { email: "rajashrism@student.tce.edu", cluster: "forced" },
  { email: "ameen@student.tce.edu", cluster: "forced" },
  { email: "shruthirajalakshmi@student.tce.edu", cluster: "nomad" },
  { email: "archideastuff@gmail.com", cluster: "drifter" },
  { email: "bhuvanika527@gmail.com", cluster: "drifter" },
  { email: "reka1103itsme@gmail.com", cluster: "nomad" },
  { email: "dasssherin@gmail.com", cluster: "drifter" },
  { email: "karthim@student.tce.edu", cluster: "drifter" },
  { email: "pavadharanivelu@gmail.com", cluster: "drifter" },
  { email: "rakkshanaa@student.tce.edu", cluster: "drifter" },
  { email: "rathiarputha@student.tce.edu", cluster: "drifter" },
  { email: "senarch@tce.edu", cluster: "nomad" },
  { email: "shivanandhanna@student.tce.edu", cluster: "forced" },
  { email: "saitapasya@student.tce.edu", cluster: "nomad" },
  { email: "kkarthikraja798@gmail.com", cluster: "drifter" },
  { email: "geethamohandas308@gmail.com", cluster: "nomad" },
  { email: "ashrrutha2004@gmail.com", cluster: "drifter" },
  { email: "sherin@student.tce.edu", cluster: "drifter" },
  { email: "rraarch@tce.edu", cluster: "nomad" },
  { email: "sivmey.nata22@gmail.com", cluster: "forced" },
  { email: "priyadarsini@student.tce.edu", cluster: "drifter" },
  { email: "monishaa@student.tce.edu", cluster: "drifter" },
  { email: "ragavir@student.tce.edu", cluster: "forced" },
  { email: "harinisrik@student.tce.edu", cluster: "forced" },
  { email: "crajalakshmi@student.tce.edu", cluster: "forced" },
  { email: "yashtika@student.tce.edu", cluster: "forced" },
  { email: "danishamahendran73@gmail.com", cluster: "drifter" },
  { email: "sanjeeth@student.tce.edu", cluster: "seeker" },
  { email: "jeromy@student.tce.edu", cluster: "nomad" },
  { email: "amrishkarthik@student.tce.edu", cluster: "forced" },
  { email: "satheshg@student.tce.edu", cluster: "forced" },
  { email: "anupamaa@student.tce.edu", cluster: "drifter" },
  { email: "ashath@student.tce.edu", cluster: "drifter" },
  { email: "matheshnagaraj.131@gmail.com", cluster: "forced" },
  { email: "niranjany2424@gmail.com", cluster: "drifter" },
  { email: "bhakyasrimaran@gmail.com", cluster: "drifter" },
  { email: "mahalakshmiomk@gmail.com", cluster: "seeker" },
  { email: "elamathik@student.tce.edu", cluster: "drifter" },
  { email: "mohanlewa5@gmail.com", cluster: "drifter" },
  { email: "yamini@student.tce.edu", cluster: "drifter" },
  { email: "kaarthikroshan03@gmail.com", cluster: "drifter" },
  { email: "premkumaragasthia@student.tce.edu", cluster: "disengaged" },
  { email: "thenalagu05@gmail.com", cluster: "forced" },
  { email: "muvvishal@gmail.com", cluster: "drifter" },
  { email: "narthanapriya20@gmail.com", cluster: "drifter" },
  { email: "renusritha@student.tce.edu", cluster: "seeker" },
  { email: "manhamahasin2007@gmail.com", cluster: "drifter" },
  { email: "ritishajiesh0704@gmail.com", cluster: "drifter" },
  { email: "varsithasri@student.tce.edu", cluster: "forced" },
  { email: "rayhan@student.tce.edu", cluster: "forced" },
  { email: "jainiteesh0123@gmail.com", cluster: "nomad" },
  { email: "sangxx0204@gmail.com", cluster: "forced" },
  { email: "jeyavarshini@student.tce.edu", cluster: "drifter" },
  { email: "sherenerenee@student.tce.edu", cluster: "drifter" },
  { email: "jayarahul@student.tce.edu", cluster: "forced" },
  { email: "mroshini1@student.tce.edu", cluster: "forced" },
  { email: "firdose@student.tce.edu", cluster: "disengaged" },
  { email: "rvijetha2005@gmail.com", cluster: "drifter" },
  { email: "thaiya@student.tce.edu", cluster: "forced" },
  { email: "monesh@student.tce.edu", cluster: "seeker" },
  { email: "rethanyas@student.tce.edu", cluster: "drifter" },
  { email: "jeevanantham@student.tce.edu", cluster: "drifter" },
  { email: "meenal@student.tce.edu", cluster: "forced" },
  { email: "crcmagdalin07@gmail.com", cluster: "drifter" },
  { email: "ranjithrajan@student.tce.edu", cluster: "forced" },
  { email: "skarthika1@student.tce.edu", cluster: "forced" },
  { email: "pandiraj@student.tce.edu", cluster: "drifter" },
  { email: "kavinrajr@student.tce.edu", cluster: "forced" },
  { email: "harinisri@student.tce.edu", cluster: "forced" },
  { email: "reshmadevi@student.tce.edu", cluster: "disengaged" },
  { email: "shanjai@student.tce.edu", cluster: "seeker" },
  { email: "bairavim@student.tce.edu", cluster: "seeker" },
  { email: "paavendhan@student.tce.edu", cluster: "forced" },
  { email: "seenivasanb@student.tce.edu", cluster: "forced" },
  { email: "keerthanak1@student.tce.edu", cluster: "forced" },
  { email: "prabhakaranm@student.tce.edu", cluster: "drifter" },
  { email: "tharunkpm12@gmail.com", cluster: "seeker" },
  { email: "baratkumar@student.tce.edu", cluster: "forced" },
  { email: "ajan@student.tce.edu", cluster: "disengaged" },
  { email: "rahith@student.tce.edu", cluster: "seeker" },
  { email: "jefferyallan2007@gmail.com", cluster: "forced" },
  { email: "subikshaac@student.tce.edu", cluster: "forced" },
  { email: "prajin@student.tce.edu", cluster: "forced" },
  { email: "rishi1999ent@gmail.com", cluster: "forced" },
  { email: "subhiksha@student.tce.edu", cluster: "drifter" },
  { email: "gviarch@tce.edu", cluster: "seeker" },
  { email: "harinisoundharya@student.tce.edu", cluster: "seeker" },
  { email: "gowthambaaskar9105@gmail.com", cluster: "forced" },
  { email: "aruthra@student.tce.edu", cluster: "drifter" },
  { email: "v.nithesh2006@gmail.com", cluster: "seeker" },
  { email: "dharanidharan@student.tce.edu", cluster: "forced" },
  { email: "sabarinathanm@student.tce.edu", cluster: "drifter" },
  { email: "naya@student.tce.edu", cluster: "drifter" },
  { email: "swathiga@student.tce.edu", cluster: "forced" },
  { email: "sugisivam@student.tce.edu", cluster: "forced" },
  { email: "aarthibhavana2007@gmail.com", cluster: "drifter" },
  { email: "vikashni24606@gmail.com", cluster: "disengaged" },
  { email: "stardust779393@gmail.com", cluster: "forced" },
  { email: "thanishavarthini@student.tce.edu", cluster: "forced" },
  { email: "ronaldzwx@gmail.com", cluster: "seeker" },
  { email: "avantikap@student.tce.edu", cluster: "forced" },
  { email: "pioletvishal2007@gmail.com", cluster: "seeker" },
  { email: "sairakshana@student.tce.edu", cluster: "seeker" },
  { email: "cathrine@student.tce.edu", cluster: "drifter" },
  { email: "sajini@student.tce.edu", cluster: "forced" },
  { email: "msabbas075886@gmail.com", cluster: "forced" },
  { email: "amirthavarshinips@student.tce.edu", cluster: "forced" },
  { email: "sandrea@student.tce.edu", cluster: "drifter" },
  { email: "krithik@student.tce.edu", cluster: "drifter" },
  { email: "vpsanjana24@gmail.com", cluster: "drifter" },
  { email: "sdhivya@student.tce.edu", cluster: "drifter" },
  { email: "sararch@tce.edu", cluster: "seeker" },
  { email: "prajothana@student.tce.edu", cluster: "disengaged" },
  { email: "kavinanand@student.tce.edu", cluster: "forced" },
  { email: "shahanabenezeer@student.tce.edu", cluster: "forced" },
  { email: "nandhanaharini@student.tce.edu", cluster: "drifter" },
  { email: "rohithr1@student.tce.edu", cluster: "forced" },
  { email: "hariss@student.tce.edu", cluster: "drifter" },
  { email: "kmeghashyam2005@gmail.com", cluster: "drifter" },
  { email: "saishwarya1@student.tce.edu", cluster: "forced" },
  { email: "naraayanisankara@gmail.com", cluster: "forced" },
  { email: "shreyam@student.tce.edu", cluster: "drifter" },
  { email: "hariharanjd@student.tce.edu", cluster: "forced" },
  { email: "jegadharani@student.tce.edu", cluster: "seeker" },
  { email: "habeebrahmanhr08@gmail.com", cluster: "forced" },
  { email: "pavadharani@student.tce.edu", cluster: "drifter" },
  { email: "krithik1023@gmail.com", cluster: "seeker" },
  { email: "rahulml@student.tce.edu", cluster: "forced" },
  { email: "ppharch@tce.edu", cluster: "seeker" },
  { email: "mthirumurugan@student.tce.edu", cluster: "seeker" },
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

          await docClient.send(
            new UpdateCommand({
              TableName: usersTable,
              Key: { userId },
              UpdateExpression: 'SET phase1Cluster = :cluster',
              ExpressionAttributeValues: { ':cluster': entry.cluster },
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
