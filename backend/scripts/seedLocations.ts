import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { v5 as uuidv5 } from 'uuid';
import { LocationMasterConfig } from '../shared/types';

const UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

function locationId(qrNumber: number): string {
  return uuidv5(`grovewars-location-${qrNumber}`, UUID_NAMESPACE);
}

const stage = process.argv.includes('--stage')
  ? process.argv[process.argv.indexOf('--stage') + 1]
  : 'dev';

const tableName =
  process.env.LOCATION_MASTER_CONFIG_TABLE || `grovewars-${stage}-location-master-config`;

interface LocationSeed {
  qrNumber: number;
  name: string;
  classification: LocationMasterConfig['classification'];
  sdtDeficit: number;
  priorityTier: LocationMasterConfig['priorityTier'];
  phase1Visits: number;
  phase1Satisfaction: number | null;
  phase1DominantCluster: string | null;
  isNewSpace: boolean;
  active: boolean;
  chestDropModifier: number;
  firstVisitBonus: boolean;
  coopOnly: boolean;
  bonusXP: boolean;
  spaceFact?: string;
  notes?: string;
}

const LOCATIONS: LocationSeed[] = [
  { qrNumber: 1,  name: 'Computer lab corridor',      classification: 'Transit / Forced Stay', sdtDeficit: 6, priorityTier: 'P2-High',     phase1Visits: 45, phase1Satisfaction: 0.62, phase1DominantCluster: 'forced',  isNewSpace: false, active: true,  chestDropModifier: 1.0, firstVisitBonus: false, coopOnly: false, bonusXP: false },
  { qrNumber: 2,  name: '1st yr studio B corridor',   classification: 'Transit / Forced Stay', sdtDeficit: 5, priorityTier: 'P2-High',     phase1Visits: 38, phase1Satisfaction: 0.58, phase1DominantCluster: 'forced',  isNewSpace: false, active: true,  chestDropModifier: 1.0, firstVisitBonus: false, coopOnly: false, bonusXP: false },
  { qrNumber: 3,  name: 'Main lobby',                 classification: 'Social Hub',            sdtDeficit: 2, priorityTier: 'P1-Seed',     phase1Visits: 0,  phase1Satisfaction: null,  phase1DominantCluster: null,      isNewSpace: true,  active: true,  chestDropModifier: 1.0, firstVisitBonus: false, coopOnly: false, bonusXP: false },
  { qrNumber: 4,  name: '1st yr studio A corridor',   classification: 'Transit / Forced Stay', sdtDeficit: 5, priorityTier: 'P2-High',     phase1Visits: 42, phase1Satisfaction: 0.60, phase1DominantCluster: 'forced',  isNewSpace: false, active: true,  chestDropModifier: 1.0, firstVisitBonus: false, coopOnly: false, bonusXP: false },
  { qrNumber: 5,  name: 'Office room corridor',       classification: 'Social Hub',            sdtDeficit: 3, priorityTier: 'P3-Medium',   phase1Visits: 28, phase1Satisfaction: 0.71, phase1DominantCluster: 'drifter', isNewSpace: false, active: true,  chestDropModifier: 1.0, firstVisitBonus: false, coopOnly: false, bonusXP: false },
  { qrNumber: 6,  name: 'Seminar hall corridor',      classification: 'Social Hub',            sdtDeficit: 3, priorityTier: 'P3-Medium',   phase1Visits: 31, phase1Satisfaction: 0.68, phase1DominantCluster: 'drifter', isNewSpace: false, active: true,  chestDropModifier: 1.0, firstVisitBonus: false, coopOnly: false, bonusXP: false },
  { qrNumber: 7,  name: 'PG computer lab corridor',   classification: 'Social Hub',            sdtDeficit: 4, priorityTier: 'P2-High',     phase1Visits: 22, phase1Satisfaction: 0.65, phase1DominantCluster: 'seeker',  isNewSpace: false, active: true,  chestDropModifier: 1.0, firstVisitBonus: false, coopOnly: false, bonusXP: false },
  { qrNumber: 8,  name: 'Workshop lobby (north end)', classification: 'Social Hub',            sdtDeficit: 3, priorityTier: 'P1-Seed',     phase1Visits: 55, phase1Satisfaction: 0.74, phase1DominantCluster: 'drifter', isNewSpace: false, active: true,  chestDropModifier: 1.0, firstVisitBonus: false, coopOnly: false, bonusXP: false },
  { qrNumber: 9,  name: 'Workshop ramp',              classification: 'Hidden Gem',            sdtDeficit: 5, priorityTier: 'P1-Seed',     phase1Visits: 0,  phase1Satisfaction: null,  phase1DominantCluster: null,      isNewSpace: true,  active: true,  chestDropModifier: 1.5, firstVisitBonus: true,  coopOnly: false, bonusXP: false, spaceFact: 'This ramp connects the main building to the workshop block \u2014 one of the most atmospheric spots on campus.' },
  { qrNumber: 10, name: 'Courtyard 2',                classification: 'Dead Zone',             sdtDeficit: 8, priorityTier: 'P1-Critical', phase1Visits: 12, phase1Satisfaction: 0.40, phase1DominantCluster: 'nomad',   isNewSpace: false, active: true,  chestDropModifier: 1.5, firstVisitBonus: true,  coopOnly: false, bonusXP: false },
  { qrNumber: 11, name: 'Staff room 11 corridor',     classification: 'Transit / Forced Stay', sdtDeficit: 5, priorityTier: 'P3-Medium',   phase1Visits: 0,  phase1Satisfaction: null,  phase1DominantCluster: null,      isNewSpace: false, active: false, chestDropModifier: 1.0, firstVisitBonus: false, coopOnly: false, bonusXP: false },
  { qrNumber: 12, name: 'HoD room corridor',          classification: 'Hidden Gem',            sdtDeficit: 6, priorityTier: 'P2-High',     phase1Visits: 18, phase1Satisfaction: 0.78, phase1DominantCluster: 'seeker',  isNewSpace: false, active: true,  chestDropModifier: 1.0, firstVisitBonus: false, coopOnly: false, bonusXP: false, spaceFact: "The corridor outside the Head of Department's office \u2014 quieter than you'd expect." },
  { qrNumber: 13, name: '3D modeling lab corridor',   classification: 'Hidden Gem',            sdtDeficit: 6, priorityTier: 'P2-High',     phase1Visits: 15, phase1Satisfaction: 0.80, phase1DominantCluster: 'seeker',  isNewSpace: false, active: true,  chestDropModifier: 1.0, firstVisitBonus: false, coopOnly: false, bonusXP: false, spaceFact: 'Students here work with some of the most advanced fabrication tools on campus.' },
  { qrNumber: 14, name: 'BDES studio corridor',       classification: 'Hidden Gem',            sdtDeficit: 6, priorityTier: 'P2-High',     phase1Visits: 14, phase1Satisfaction: 0.76, phase1DominantCluster: 'seeker',  isNewSpace: false, active: true,  chestDropModifier: 1.0, firstVisitBonus: false, coopOnly: false, bonusXP: false },
  { qrNumber: 15, name: 'Staff room 15 corridor',     classification: 'Transit / Forced Stay', sdtDeficit: 5, priorityTier: 'P3-Medium',   phase1Visits: 0,  phase1Satisfaction: null,  phase1DominantCluster: null,      isNewSpace: false, active: false, chestDropModifier: 1.0, firstVisitBonus: false, coopOnly: false, bonusXP: false },
  { qrNumber: 16, name: 'M1 lecture hall corridor',    classification: 'Hidden Gem',            sdtDeficit: 6, priorityTier: 'P2-High',     phase1Visits: 20, phase1Satisfaction: 0.72, phase1DominantCluster: 'seeker',  isNewSpace: false, active: true,  chestDropModifier: 1.0, firstVisitBonus: false, coopOnly: false, bonusXP: false },
  { qrNumber: 17, name: 'Workshop corridor',          classification: 'Hidden Gem',            sdtDeficit: 5, priorityTier: 'P2-High',     phase1Visits: 16, phase1Satisfaction: 0.75, phase1DominantCluster: 'seeker',  isNewSpace: false, active: true,  chestDropModifier: 1.0, firstVisitBonus: false, coopOnly: false, bonusXP: false },
  { qrNumber: 18, name: 'Workshop lobby (south end)', classification: 'Social Hub',            sdtDeficit: 3, priorityTier: 'P1-Seed',     phase1Visits: 55, phase1Satisfaction: 0.74, phase1DominantCluster: 'drifter', isNewSpace: false, active: true,  chestDropModifier: 1.0, firstVisitBonus: false, coopOnly: false, bonusXP: false },
  { qrNumber: 19, name: 'Climatology lab corridor',   classification: 'Dead Zone',             sdtDeficit: 8, priorityTier: 'P1-Critical', phase1Visits: 8,  phase1Satisfaction: 0.35, phase1DominantCluster: 'forced',  isNewSpace: false, active: true,  chestDropModifier: 1.5, firstVisitBonus: true,  coopOnly: false, bonusXP: false, spaceFact: "The climatology lab monitors real environmental data \u2014 ask a student what they're measuring." },
  { qrNumber: 20, name: 'Staff room 20 corridor',     classification: 'Dead Zone',             sdtDeficit: 7, priorityTier: 'P1-Critical', phase1Visits: 0,  phase1Satisfaction: null,  phase1DominantCluster: null,      isNewSpace: false, active: true,  chestDropModifier: 1.5, firstVisitBonus: true,  coopOnly: false, bonusXP: false },
  { qrNumber: 21, name: 'Courtyard 3',                classification: 'Hidden Gem',            sdtDeficit: 5, priorityTier: 'P1-Seed',     phase1Visits: 0,  phase1Satisfaction: null,  phase1DominantCluster: null,      isNewSpace: true,  active: true,  chestDropModifier: 1.5, firstVisitBonus: true,  coopOnly: false, bonusXP: false },
  { qrNumber: 22, name: 'Mezzanine',                  classification: 'Unvisited',             sdtDeficit: 9, priorityTier: 'P1-Critical', phase1Visits: 0,  phase1Satisfaction: null,  phase1DominantCluster: null,      isNewSpace: false, active: true,  chestDropModifier: 2.0, firstVisitBonus: true,  coopOnly: false, bonusXP: false },
  { qrNumber: 23, name: 'Lecture hall corridor',      classification: 'Transit / Forced Stay', sdtDeficit: 5, priorityTier: 'P2-High',     phase1Visits: 35, phase1Satisfaction: 0.61, phase1DominantCluster: 'forced',  isNewSpace: false, active: true,  chestDropModifier: 1.0, firstVisitBonus: false, coopOnly: false, bonusXP: false },
  { qrNumber: 24, name: 'Courtyard 1',                classification: 'Unvisited',             sdtDeficit: 9, priorityTier: 'P1-Critical', phase1Visits: 0,  phase1Satisfaction: null,  phase1DominantCluster: null,      isNewSpace: true,  active: true,  chestDropModifier: 2.0, firstVisitBonus: true,  coopOnly: false, bonusXP: false },
  { qrNumber: 25, name: 'Library',                    classification: 'Hidden Gem',            sdtDeficit: 5, priorityTier: 'P1-Seed',     phase1Visits: 24, phase1Satisfaction: 0.82, phase1DominantCluster: 'seeker',  isNewSpace: false, active: true,  chestDropModifier: 1.0, firstVisitBonus: false, coopOnly: false, bonusXP: false, spaceFact: 'The library has quiet corners that most students have never found.' },
  { qrNumber: 26, name: 'Mplan studio corridor',      classification: 'Unvisited',             sdtDeficit: 9, priorityTier: 'P1-Critical', phase1Visits: 0,  phase1Satisfaction: null,  phase1DominantCluster: null,      isNewSpace: false, active: true,  chestDropModifier: 2.0, firstVisitBonus: true,  coopOnly: false, bonusXP: false },
  { qrNumber: 27, name: 'M1 lecture hall stairs',     classification: 'Unvisited',             sdtDeficit: 9, priorityTier: 'P1-Critical', phase1Visits: 0,  phase1Satisfaction: null,  phase1DominantCluster: null,      isNewSpace: true,  active: false, chestDropModifier: 2.0, firstVisitBonus: true,  coopOnly: false, bonusXP: false, notes: 'No QR placed yet \u2014 verify physical location before enabling.' },
  { qrNumber: 28, name: 'Staff room 28 corridor',     classification: 'Hidden Gem',            sdtDeficit: 6, priorityTier: 'P2-High',     phase1Visits: 0,  phase1Satisfaction: null,  phase1DominantCluster: null,      isNewSpace: false, active: true,  chestDropModifier: 1.0, firstVisitBonus: false, coopOnly: false, bonusXP: false },
  { qrNumber: 29, name: 'Gents restroom area',        classification: 'Unvisited',             sdtDeficit: 8, priorityTier: 'P2-High',     phase1Visits: 2,  phase1Satisfaction: 0.50, phase1DominantCluster: null,      isNewSpace: false, active: false, chestDropModifier: 1.5, firstVisitBonus: true,  coopOnly: false, bonusXP: false, notes: 'Only 2 Phase 1 visits. Verify if appropriate as a game location.' },
  { qrNumber: 30, name: 'Parking',                    classification: 'TBD',                   sdtDeficit: 5, priorityTier: null,           phase1Visits: 0,  phase1Satisfaction: null,  phase1DominantCluster: null,      isNewSpace: true,  active: false, chestDropModifier: 1.0, firstVisitBonus: false, coopOnly: false, bonusXP: false, notes: 'Classification TBD. Admin to verify.' },
];

function buildItem(seed: LocationSeed): LocationMasterConfig {
  return {
    locationId: locationId(seed.qrNumber),
    qrNumber: seed.qrNumber,
    name: seed.name,
    gpsLat: 0.0,
    gpsLng: 0.0,
    geofenceRadius: 15,
    mapPixelX: 0.0,
    mapPixelY: 0.0,
    normalizedX: 0.0,
    normalizedY: 0.0,
    floor: 'GF',
    classification: seed.classification,
    sdtDeficit: seed.sdtDeficit,
    priorityTier: seed.priorityTier,
    phase1Visits: seed.phase1Visits,
    phase1Satisfaction: seed.phase1Satisfaction,
    phase1DominantCluster: seed.phase1DominantCluster,
    isNewSpace: seed.isNewSpace,
    active: seed.active,
    chestDropModifier: seed.chestDropModifier,
    firstVisitBonus: seed.firstVisitBonus,
    coopOnly: seed.coopOnly,
    bonusXP: seed.bonusXP,
    spaceFact: seed.spaceFact ?? null,
    minigameAffinity: null,
    linkedTo: null,
    notes: seed.notes ?? '',
    lastActiveDate: null,
    totalPhase2GameSessions: 0,
    totalPhase2FreeRoamCheckins: 0,
    avgPhase2Satisfaction: null,
    last3DaysVisits: [0, 0, 0],
  };
}

async function main() {
  const client = new DynamoDBClient({ region: 'ap-south-1' });
  const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });

  const items = LOCATIONS.map(buildItem);
  const BATCH_SIZE = 25;
  let success = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    try {
      await docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [tableName]: batch.map((item) => ({
              PutRequest: { Item: item as Record<string, unknown> },
            })),
          },
        })
      );
      success += batch.length;
      console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: wrote ${batch.length} items`);
    } catch (err) {
      failed += batch.length;
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, err);
    }
  }

  console.log(`\nDone. Success: ${success}, Failed: ${failed}`);
  console.log(`Table: ${tableName}`);
}

main().catch(console.error);
