import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { scan } from '../shared/db';
import { success, error, ErrorCode } from '../shared/response';
import { MapCalibration } from '../shared/types';

const ASSETS_BUCKET = process.env.ASSETS_BUCKET || '';
const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';

export const handler = async (
  _event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const { items } = await scan<MapCalibration>('map-calibration', {
      filterExpression: 'active = :active',
      expressionValues: { ':active': true },
    });

    if (items.length === 0) {
      return error(ErrorCode.NOT_FOUND, 'No active map calibration found', 404);
    }

    const calibration = items[0];

    const mapImageUrl = `https://${ASSETS_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${calibration.mapImageKey}`;

    return success({
      mapImageUrl,
      mapWidth: calibration.mapWidth,
      mapHeight: calibration.mapHeight,
      tileSize: calibration.tileSize,
      transformMatrix: calibration.transformMatrix,
    });
  } catch (err) {
    console.error('getMapConfig error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to get map config', 500);
  }
};
