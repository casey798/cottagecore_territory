import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { extractUserId } from '../../shared/auth';
import { scan, getItem } from '../../shared/db';
import { success, error, ErrorCode } from '../../shared/response';
import { Space } from '../../shared/types';

interface DecorationRecord {
  userSpaceId: string;
  spaceId: string;
  userId: string;
  date: string;
  layout: {
    placedAssets: Array<{
      assetId: string;
      packCategory: string;
      x: number;
      y: number;
      rotation: number;
      gridW: number;
      gridH: number;
    }>;
  };
  submittedAt: string;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const userId = extractUserId(event);

    // Scan space-decorations for this user (filter on userId field)
    const decorations: DecorationRecord[] = [];
    let lastKey: Record<string, unknown> | undefined;
    do {
      const result = await scan<DecorationRecord>('space-decorations', {
        filterExpression: 'userId = :uid',
        expressionValues: { ':uid': userId },
        exclusiveStartKey: lastKey,
      });
      decorations.push(...result.items);
      lastKey = result.lastEvaluatedKey;
    } while (lastKey);

    if (decorations.length === 0) {
      return success({ decorations: [] });
    }

    // Fetch space details in parallel for polygon/grid data
    const uniqueSpaceIds = [...new Set(decorations.map((d) => d.spaceId))];
    const spaceMap = new Map<string, Space>();
    await Promise.all(
      uniqueSpaceIds.map(async (spaceId) => {
        const space = await getItem<Space>('spaces', { spaceId });
        if (space) spaceMap.set(spaceId, space);
      })
    );

    // Build response items
    const items = decorations
      .filter((d) => spaceMap.has(d.spaceId))
      .map((d) => {
        const space = spaceMap.get(d.spaceId)!;
        return {
          spaceId: d.spaceId,
          spaceName: space.name,
          date: d.date,
          submittedAt: d.submittedAt,
          polygonPoints: space.polygonPoints,
          gridCells: space.gridCells,
          gridColumns: space.gridColumns,
          gridRows: space.gridRows,
          placedAssets: d.layout.placedAssets,
        };
      });

    return success({ decorations: items });
  } catch (err) {
    console.error('getMyDecorations error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
};
