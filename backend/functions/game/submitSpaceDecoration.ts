import crypto from 'crypto';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { extractUserId } from '../../shared/auth';
import { getItem, putItem, updateItem, scan } from '../../shared/db';
import { success, error, ErrorCode } from '../../shared/response';
import { getTodayISTString } from '../../shared/time';
import {
  Space,
  SpaceAssignment,
  SpaceDecorationSubmission,
  PlacedDecorationAsset,
  DecorationSurvey,
  DecorationPackCategory,
  User,
} from '../../shared/types';

const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
const ASSETS_BUCKET = process.env.ASSETS_BUCKET || '';
const XP_PER_DECORATION = 25;

interface SubmitBody {
  spaceId: string;
  layout: { placedAssets: PlacedDecorationAsset[] };
  survey: DecorationSurvey;
  screenshotBase64: string;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const userId = extractUserId(event);
    const body = JSON.parse(event.body || '{}') as SubmitBody;

    // Validate required fields
    if (!body.spaceId || !body.layout?.placedAssets || !body.survey || !body.screenshotBase64) {
      return error(ErrorCode.VALIDATION_ERROR, 'Missing required fields: spaceId, layout, survey, screenshotBase64', 400);
    }

    if (!Array.isArray(body.layout.placedAssets) || body.layout.placedAssets.length === 0) {
      return error(ErrorCode.VALIDATION_ERROR, 'At least one placed asset is required', 400);
    }

    // Validate survey fields
    const { wantSpaceToBe, whyChoseItems, wouldVisitMore } = body.survey;
    if (!wantSpaceToBe || !whyChoseItems || !['yes', 'maybe', 'no'].includes(wouldVisitMore)) {
      return error(ErrorCode.VALIDATION_ERROR, 'Invalid survey data', 400);
    }

    // Validate each placed asset
    for (const asset of body.layout.placedAssets) {
      if (!asset.assetId || !asset.packCategory || typeof asset.x !== 'number' || typeof asset.y !== 'number') {
        return error(ErrorCode.VALIDATION_ERROR, 'Invalid placed asset data', 400);
      }
    }

    const today = getTodayISTString();
    const now = new Date().toISOString();

    // 1. Verify space exists and is active
    const space = await getItem<Space>('spaces', { spaceId: body.spaceId });
    if (!space) {
      return error(ErrorCode.NOT_FOUND, 'Space not found', 404);
    }
    if (!space.active) {
      return error(ErrorCode.GAME_INACTIVE, 'This space is not currently active', 400);
    }

    // 2. Verify space is in user's assignment and not already completed
    const dateUserId = `${today}#${userId}`;
    const assignment = await getItem<SpaceAssignment>('space-assignments', { dateUserId });
    if (!assignment) {
      return error(ErrorCode.NOT_ASSIGNED, 'No space assignment found for today', 400);
    }
    if (!assignment.assignedSpaceIds.includes(body.spaceId)) {
      return error(ErrorCode.NOT_ASSIGNED, 'Space not assigned to you today', 400);
    }
    // Allow re-decoration — XP only awarded on first submission
    const isReDecoration = assignment.completedSpaceIds.includes(body.spaceId);

    // 3. Fetch user for clan info and XP check
    const user = await getItem<User>('users', { userId });
    if (!user) {
      return error(ErrorCode.NOT_FOUND, 'User not found', 400);
    }

    // 4. Upload screenshot to S3
    const s3Key = `decorations/${today}/${userId}/${body.spaceId}.png`;
    try {
      const imageBuffer = Buffer.from(body.screenshotBase64, 'base64');
      await s3.send(new PutObjectCommand({
        Bucket: ASSETS_BUCKET,
        Key: s3Key,
        Body: imageBuffer,
        ContentType: 'image/png',
      }));
    } catch (s3Err) {
      console.error('Screenshot upload failed (non-fatal):', s3Err);
      // Continue — decoration data is more important than the screenshot
    }

    // 5. Build pack usage summary
    const packUsageSummary: Record<DecorationPackCategory, number> = {
      furniture: 0,
      aesthetics: 0,
      nature: 0,
    };
    for (const asset of body.layout.placedAssets) {
      if (asset.packCategory in packUsageSummary) {
        packUsageSummary[asset.packCategory]++;
      }
    }

    // 6. Award XP only on first decoration (skip on re-decoration)
    let xpAwarded = 0;
    if (!isReDecoration) {
      await updateItem(
        'users',
        { userId },
        'ADD todayXp :xp, seasonXp :xp',
        { ':xp': XP_PER_DECORATION }
      );
      xpAwarded = XP_PER_DECORATION;
    }

    // 7. Atomic clan XP (non-fatal)
    if (xpAwarded > 0 && user.clan) {
      try {
        await updateItem(
          'clans',
          { clanId: user.clan },
          'ADD todayXp :xp, seasonXp :xp',
          { ':xp': xpAwarded }
        );
      } catch (clanErr) {
        console.error('Clan XP update failed (non-fatal):', clanErr);
      }
    }

    // 8. Write SpaceDecorationSubmission record
    const userSpaceId = `${userId}#${body.spaceId}`;
    const submission: SpaceDecorationSubmission = {
      userSpaceId,
      date: today,
      layout: { placedAssets: body.layout.placedAssets },
      survey: body.survey,
      screenshotS3Key: s3Key,
      packUsageSummary,
      xpAwarded,
      submittedAt: now,
      userId,
      spaceId: body.spaceId,
      clan: user.clan,
    };
    await putItem('space-decorations', submission as unknown as Record<string, unknown>);

    // 9. Mark space as completed in assignment (only if first time)
    const updatedCompleted = isReDecoration
      ? assignment.completedSpaceIds
      : [...assignment.completedSpaceIds, body.spaceId];
    if (!isReDecoration) {
      await updateItem(
        'space-assignments',
        { dateUserId },
        'SET completedSpaceIds = :completed',
        { ':completed': updatedCompleted }
      );
    }

    return success({
      xpAwarded,
      spaceId: body.spaceId,
      submittedAt: now,
      spacesCompleted: updatedCompleted.length,
      spacesRemaining: assignment.assignedSpaceIds.length - updatedCompleted.length,
    });
  } catch (err) {
    console.error('submitSpaceDecoration error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
};
