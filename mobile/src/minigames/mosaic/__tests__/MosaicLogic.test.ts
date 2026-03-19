import {
  rotateCells,
  translateCells,
  getPlacedCells,
  getShapeCells,
  computePlacementState,
  validateSolution,
  type MosaicCell,
  type MosaicTile,
  type MosaicTilePlacement,
  type MosaicPuzzle,
  type MosaicPuzzleClient,
} from '../MosaicLogic';

// Helper to sort cells for comparison
function sortCells(cells: MosaicCell[]): MosaicCell[] {
  return [...cells].sort((a, b) => a.row - b.row || a.col - b.col);
}

function cellsEqual(a: MosaicCell[], b: MosaicCell[]): boolean {
  const sa = sortCells(a);
  const sb = sortCells(b);
  if (sa.length !== sb.length) return false;
  return sa.every((c, i) => c.col === sb[i].col && c.row === sb[i].row);
}

describe('rotateCells', () => {
  it('L-shape at 90° gives correct normalized output', () => {
    // L: [{col:0,row:0},{col:0,row:1},{col:0,row:2},{col:1,row:2}]
    const lCells = getShapeCells('L');
    const rotated = rotateCells(lCells, 1);
    // L: [{col:0,row:0},{col:0,row:1},{col:0,row:2},{col:1,row:2}]
    // 90° CW: (col,row)→(row,-col) then normalize
    // (0,0)→(0,0) (0,1)→(1,0) (0,2)→(2,0) (1,2)→(2,-1) → normalize by minRow=-1:
    // (0,1),(1,1),(2,1),(2,0)
    expect(sortCells(rotated)).toEqual(sortCells([
      {col:0,row:1},{col:1,row:1},{col:2,row:1},{col:2,row:0},
    ]));
  });

  it('4 rotations of any shape returns to original', () => {
    const shapes: MosaicTile['shape'][] = ['SQUARE','BAR_3','BAR_4','L','L_MIRROR','T','S','PLUS'];
    for (const shape of shapes) {
      const original = getShapeCells(shape);
      const rotated4 = rotateCells(original, 4);
      expect(cellsEqual(rotated4, original)).toBe(true);
    }
  });
});

describe('translateCells', () => {
  it('correct offset application', () => {
    const cells: MosaicCell[] = [{col:0,row:0},{col:1,row:0}];
    const translated = translateCells(cells, 3, 2);
    expect(translated).toEqual([{col:3,row:2},{col:4,row:2}]);
  });
});

describe('getPlacedCells', () => {
  it('composed rotate+translate gives correct absolute positions', () => {
    const tile: MosaicTile = { tileId: 't1', shape: 'BAR_3', assetKey: 'mo_tile_leaf' };
    const placement: MosaicTilePlacement = { tileId: 't1', originCol: 2, originRow: 1, rotation: 90 };
    const cells = getPlacedCells(tile, placement);
    // BAR_3 [{col:0,row:0},{col:1,row:0},{col:2,row:0}] at 90° CW:
    // (0,0)→(0,0) (1,0)→(0,-1) (2,0)→(0,-2) → normalize: (0,2),(0,1),(0,0)
    // translated by (2,1): [{col:2,row:3},{col:2,row:2},{col:2,row:1}]
    expect(sortCells(cells)).toEqual(sortCells([
      {col:2,row:1},{col:2,row:2},{col:2,row:3},
    ]));
  });
});

describe('computePlacementState', () => {
  const simplePuzzle: MosaicPuzzleClient = {
    id: 'test',
    gridCols: 4,
    gridRows: 4,
    targetCells: [{col:0,row:0},{col:1,row:0},{col:0,row:1},{col:1,row:1}],
    tiles: [{ tileId: 't1', shape: 'SQUARE', assetKey: 'mo_tile_leaf' }],
  };

  it('complete valid placement → isComplete true', () => {
    const placements: MosaicTilePlacement[] = [
      { tileId: 't1', originCol: 0, originRow: 0, rotation: 0 },
    ];
    const result = computePlacementState(simplePuzzle, placements);
    expect(result.isComplete).toBe(true);
    expect(result.hasOverlap).toBe(false);
  });

  it('overlapping tiles → hasOverlap true', () => {
    const puzzle: MosaicPuzzleClient = {
      id: 'test2',
      gridCols: 5,
      gridRows: 5,
      targetCells: [{col:0,row:0},{col:1,row:0},{col:2,row:0},{col:0,row:1},{col:1,row:1},{col:2,row:1}],
      tiles: [
        { tileId: 't1', shape: 'SQUARE', assetKey: 'mo_tile_leaf' },
        { tileId: 't2', shape: 'SQUARE', assetKey: 'mo_tile_stone' },
      ],
    };
    const placements: MosaicTilePlacement[] = [
      { tileId: 't1', originCol: 0, originRow: 0, rotation: 0 },
      { tileId: 't2', originCol: 1, originRow: 0, rotation: 0 }, // overlaps at (1,0) and (1,1)
    ];
    const result = computePlacementState(puzzle, placements);
    expect(result.hasOverlap).toBe(true);
    expect(result.isComplete).toBe(false);
  });

  it('tile placed outside target → isComplete false, hasOverlap false', () => {
    const puzzle: MosaicPuzzleClient = {
      id: 'test3',
      gridCols: 5,
      gridRows: 5,
      targetCells: [{col:0,row:0},{col:1,row:0},{col:0,row:1},{col:1,row:1}],
      tiles: [{ tileId: 't1', shape: 'SQUARE', assetKey: 'mo_tile_leaf' }],
    };
    const placements: MosaicTilePlacement[] = [
      { tileId: 't1', originCol: 2, originRow: 2, rotation: 0 }, // placed away from target
    ];
    const result = computePlacementState(puzzle, placements);
    expect(result.isComplete).toBe(false);
    expect(result.hasOverlap).toBe(false);
  });
});

describe('validateSolution', () => {
  const simplePuzzle: MosaicPuzzle = {
    id: 'test',
    gridCols: 4,
    gridRows: 4,
    targetCells: [{col:0,row:0},{col:1,row:0},{col:0,row:1},{col:1,row:1}],
    tiles: [{ tileId: 't1', shape: 'SQUARE', assetKey: 'mo_tile_leaf' }],
    solution: [{ tileId: 't1', originCol: 0, originRow: 0, rotation: 0 }],
  };

  it('correct full coverage → true', () => {
    const valid = validateSolution(simplePuzzle, [
      { tileId: 't1', originCol: 0, originRow: 0, rotation: 0 },
    ]);
    expect(valid).toBe(true);
  });

  it('missing cell → false', () => {
    // Place nothing
    const valid = validateSolution(simplePuzzle, []);
    expect(valid).toBe(false);
  });

  it('overlapping tiles → false', () => {
    const puzzle: MosaicPuzzle = {
      id: 'test2',
      gridCols: 5,
      gridRows: 5,
      targetCells: [{col:0,row:0},{col:1,row:0},{col:2,row:0},{col:0,row:1},{col:1,row:1},{col:2,row:1}],
      tiles: [
        { tileId: 't1', shape: 'SQUARE', assetKey: 'mo_tile_leaf' },
        { tileId: 't2', shape: 'SQUARE', assetKey: 'mo_tile_stone' },
      ],
      solution: [],
    };
    const valid = validateSolution(puzzle, [
      { tileId: 't1', originCol: 0, originRow: 0, rotation: 0 },
      { tileId: 't2', originCol: 1, originRow: 0, rotation: 0 },
    ]);
    expect(valid).toBe(false);
  });
});

describe('validateSolution against all 25 library puzzles', () => {
  // Import puzzle library — in mobile context we read the JSON directly
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const puzzleData: MosaicPuzzle[] = require('../../../../../../all_passed_puzzles.json');

  it('all 25 puzzles validate with their stored solutions', () => {
    expect(puzzleData.length).toBe(25);
    for (const puzzle of puzzleData) {
      const result = validateSolution(puzzle, puzzle.solution);
      expect(result).toBe(true);
    }
  });
});
