import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { success, error, ErrorCode } from '../../shared/response';

const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
const ASSETS_BUCKET = process.env.ASSETS_BUCKET || '';

function adminCheck(event: APIGatewayProxyEvent): APIGatewayProxyResult | null {
  const claims = event.requestContext.authorizer?.claims;
  if (!claims) return error(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
  const groups: string[] = (claims['cognito:groups'] as string || '').split(',').filter(Boolean);
  if (!groups.some((g) => g.toLowerCase() === 'admin')) {
    return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
  }
  return null;
}

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const denied = adminCheck(event);
    if (denied) return denied;

    const body = JSON.parse(event.body || '{}') as Record<string, unknown>;
    const filename = body.filename;

    if (typeof filename !== 'string' || filename.trim().length === 0) {
      return error(ErrorCode.VALIDATION_ERROR, 'filename is required', 400);
    }

    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `maps/${Date.now()}-${sanitized}`;

    const command = new PutObjectCommand({
      Bucket: ASSETS_BUCKET,
      Key: key,
      ContentType: 'image/png',
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

    return success({ uploadUrl, key });
  } catch (err) {
    console.error('mapUploadUrl error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
