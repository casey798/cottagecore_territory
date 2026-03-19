import { z } from 'zod';

const clanIdSchema = z.enum(['ember', 'tide', 'bloom', 'gale', 'hearth']);
const notificationTypeSchema = z.enum(['event', 'alert', 'hype', 'info']);
const gameResultSchema = z.enum(['win', 'lose', 'timeout', 'abandoned']);

export const googleLoginSchema = z.object({
  idToken: z.string().min(1),
});

export const setClanSchema = z.object({
  clan: clanIdSchema,
});

export const avatarConfigSchema = z.object({
  hairStyle: z.number().int().min(0).max(7),
  hairColor: z.number().int().min(0).max(9),
  skinTone: z.number().int().min(0).max(7),
  outfit: z.number().int().min(0).max(7),
  accessory: z.number().int().min(0).max(9),
});

export const updateAvatarSchema = z.object({
  displayName: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9 ]+$/, 'Display name must be alphanumeric + spaces'),
  avatarConfig: avatarConfigSchema,
});

export const qrPayloadSchema = z.object({
  v: z.number(),
  l: z.string().uuid(),
  d: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  h: z.string(),
});

export const scanQrSchema = z.object({
  qrData: qrPayloadSchema,
  gpsLat: z.number().min(-90).max(90),
  gpsLng: z.number().min(-180).max(180),
});

export const startMinigameSchema = z.object({
  locationId: z.string().uuid(),
  minigameId: z.string(),
  coopPartnerId: z.string().uuid().nullable(),
});

export const completeMinigameSchema = z.object({
  sessionId: z.string().uuid(),
  result: gameResultSchema,
  completionHash: z.string(),
  timeTaken: z.number().int().min(0),
  solutionData: z.record(z.unknown()),
});

const pointSchema = z.object({ x: z.number(), y: z.number() });

export const targetSpaceSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  mapOverlayId: z.string().min(1),
  polygonPoints: z.array(pointSchema).optional(),
  gridCells: z.array(pointSchema).optional(),
});

export const setDailyConfigSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  activeLocationIds: z.array(z.string().uuid()).min(1).optional(),
  targetSpace: targetSpaceSchema.optional(),
  quietMode: z.boolean().optional(),
}).refine(
  (data) => data.quietMode === true || (data.activeLocationIds && data.activeLocationIds.length > 0 && data.targetSpace),
  { message: 'activeLocationIds and targetSpace are required when quietMode is not true' }
);

export const generateQrSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const sendNotificationSchema = z.object({
  message: z.string().min(1).max(140),
  target: z.union([z.literal('all'), clanIdSchema]),
  notificationType: notificationTypeSchema,
});

export const seasonResetSchema = z.object({
  resetTerritories: z.boolean(),
  newSeasonNumber: z.number().int().positive(),
});

export const placedAssetSchema = z.object({
  assetId: z.string(),
  x: z.number(),
  y: z.number(),
  rotation: z.number(),
});

export const saveDecorationSchema = z.object({
  layout: z.object({
    placedAssets: z.array(placedAssetSchema),
  }),
});
