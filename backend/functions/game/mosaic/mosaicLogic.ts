import type { MosaicCell, MosaicTile, MosaicTilePlacement, MosaicPuzzle, MosaicPuzzleClient } from '../../../shared/types';

export type { MosaicCell, MosaicTile, MosaicTilePlacement, MosaicPuzzle, MosaicPuzzleClient };

const TILE_SHAPE_CELLS: Record<MosaicTile['shape'], MosaicCell[]> = {
  SQUARE:   [{col:0,row:0},{col:1,row:0},{col:0,row:1},{col:1,row:1}],
  BAR_3:    [{col:0,row:0},{col:1,row:0},{col:2,row:0}],
  BAR_4:    [{col:0,row:0},{col:1,row:0},{col:2,row:0},{col:3,row:0}],
  L:        [{col:0,row:0},{col:0,row:1},{col:0,row:2},{col:1,row:2}],
  L_MIRROR: [{col:1,row:0},{col:1,row:1},{col:0,row:2},{col:1,row:2}],
  T:        [{col:0,row:0},{col:1,row:0},{col:2,row:0},{col:1,row:1}],
  S:        [{col:1,row:0},{col:2,row:0},{col:0,row:1},{col:1,row:1}],
  PLUS:     [{col:1,row:0},{col:0,row:1},{col:1,row:1},{col:2,row:1},{col:1,row:2}],
};

export function getShapeCells(shape: MosaicTile['shape']): MosaicCell[] {
  return TILE_SHAPE_CELLS[shape];
}

/**
 * Rotate cells 90° CW `times` times, then normalize so min col/row = 0.
 */
export function rotateCells(cells: MosaicCell[], times: number): MosaicCell[] {
  const n = ((times % 4) + 4) % 4;
  let result = cells.map(c => ({ ...c }));

  for (let i = 0; i < n; i++) {
    result = result.map(({ col, row }) => ({ col: row, row: -col }));
  }

  // Normalize: shift so min col and min row are 0
  const minCol = Math.min(...result.map(c => c.col));
  const minRow = Math.min(...result.map(c => c.row));
  return result.map(c => ({ col: c.col - minCol, row: c.row - minRow }));
}

/**
 * Translate cells by origin offset.
 */
export function translateCells(cells: MosaicCell[], originCol: number, originRow: number): MosaicCell[] {
  return cells.map(c => ({ col: c.col + originCol, row: c.row + originRow }));
}

/**
 * Get absolute cells for a placed tile (rotate then translate).
 */
export function getPlacedCells(tile: MosaicTile, placement: MosaicTilePlacement): MosaicCell[] {
  const baseCells = TILE_SHAPE_CELLS[tile.shape];
  const rotated = rotateCells(baseCells, placement.rotation / 90);
  return translateCells(rotated, placement.originCol, placement.originRow);
}

/**
 * Compute the state of all cells given current placements.
 */
export function computePlacementState(
  puzzle: MosaicPuzzleClient,
  placements: MosaicTilePlacement[],
): {
  cellStates: Map<string, 'target' | 'filled' | 'overlap' | 'empty'>;
  isComplete: boolean;
  hasOverlap: boolean;
} {
  const targetSet = new Set(puzzle.targetCells.map(c => `${c.col},${c.row}`));
  const cellStates = new Map<string, 'target' | 'filled' | 'overlap' | 'empty'>();

  // Initialize target cells
  for (const key of targetSet) {
    cellStates.set(key, 'target');
  }

  // Track coverage counts
  const coverCount = new Map<string, number>();
  let hasOverlap = false;
  let allOutOfBounds = false;

  for (const placement of placements) {
    const tile = puzzle.tiles.find(t => t.tileId === placement.tileId);
    if (!tile) continue;

    const cells = getPlacedCells(tile, placement);
    for (const cell of cells) {
      const key = `${cell.col},${cell.row}`;
      const count = (coverCount.get(key) || 0) + 1;
      coverCount.set(key, count);

      if (count > 1) {
        hasOverlap = true;
        cellStates.set(key, 'overlap');
      } else if (cell.col < 0 || cell.row < 0 || cell.col >= puzzle.gridCols || cell.row >= puzzle.gridRows) {
        allOutOfBounds = true;
      } else {
        cellStates.set(key, 'filled');
      }
    }
  }

  // Check completeness: every target cell is filled (count == 1), no overlaps, no cells outside target
  let isComplete = !hasOverlap && !allOutOfBounds;
  if (isComplete) {
    // Every target cell must be covered exactly once
    for (const key of targetSet) {
      if ((coverCount.get(key) || 0) !== 1) {
        isComplete = false;
        break;
      }
    }
    // No cell outside of target should be covered
    if (isComplete) {
      for (const [key] of coverCount) {
        if (!targetSet.has(key)) {
          isComplete = false;
          break;
        }
      }
    }
  }

  return { cellStates, isComplete, hasOverlap };
}

/**
 * Server-side validation: submitted placements must cover exactly the target cells
 * with no overlaps and no out-of-bounds cells.
 */
export function validateSolution(puzzle: MosaicPuzzle, submission: MosaicTilePlacement[]): boolean {
  const targetSet = new Set(puzzle.targetCells.map(c => `${c.col},${c.row}`));
  const coveredSet = new Set<string>();

  for (const placement of submission) {
    const tile = puzzle.tiles.find(t => t.tileId === placement.tileId);
    if (!tile) return false;

    const cells = getPlacedCells(tile, placement);
    for (const cell of cells) {
      const key = `${cell.col},${cell.row}`;

      // Out of bounds
      if (cell.col < 0 || cell.row < 0 || cell.col >= puzzle.gridCols || cell.row >= puzzle.gridRows) {
        return false;
      }

      // Overlap
      if (coveredSet.has(key)) return false;

      coveredSet.add(key);
    }
  }

  // Must cover exactly the target cells
  if (coveredSet.size !== targetSet.size) return false;
  for (const key of coveredSet) {
    if (!targetSet.has(key)) return false;
  }
  return true;
}
