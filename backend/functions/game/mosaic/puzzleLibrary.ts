import { MosaicPuzzle } from '../../../shared/types';

export const puzzleLibrary: MosaicPuzzle[] = [
  {
    "id": "s1_puzzle_1",
    "gridCols": 5,
    "gridRows": 5,
    "targetCells": [
      {
        "col": 0,
        "row": 0
      },
      {
        "col": 1,
        "row": 0
      },
      {
        "col": 3,
        "row": 0
      },
      {
        "col": 1,
        "row": 1
      },
      {
        "col": 2,
        "row": 1
      },
      {
        "col": 3,
        "row": 1
      },
      {
        "col": 0,
        "row": 2
      },
      {
        "col": 1,
        "row": 2
      },
      {
        "col": 3,
        "row": 2
      },
      {
        "col": 0,
        "row": 3
      },
      {
        "col": 1,
        "row": 3
      },
      {
        "col": 3,
        "row": 3
      },
      {
        "col": 4,
        "row": 3
      },
      {
        "col": 1,
        "row": 4
      },
      {
        "col": 3,
        "row": 4
      },
      {
        "col": 4,
        "row": 4
      }
    ],
    "tiles": [
      {
        "tileId": "t1",
        "shape": "L",
        "assetKey": "mo_tile_leaf"
      },
      {
        "tileId": "t2",
        "shape": "T",
        "assetKey": "mo_tile_mushroom"
      },
      {
        "tileId": "t3",
        "shape": "SQUARE",
        "assetKey": "mo_tile_stone"
      },
      {
        "tileId": "t4",
        "shape": "S",
        "assetKey": "mo_tile_acorn"
      }
    ],
    "solution": [
      {
        "tileId": "t1",
        "originCol": 0,
        "originRow": 0,
        "rotation": 180
      },
      {
        "tileId": "t2",
        "originCol": 2,
        "originRow": 0,
        "rotation": 270
      },
      {
        "tileId": "t3",
        "originCol": 3,
        "originRow": 3,
        "rotation": 0
      },
      {
        "tileId": "t4",
        "originCol": 0,
        "originRow": 2,
        "rotation": 90
      }
    ]
  },
  {
    "id": "s1_puzzle_2",
    "gridCols": 5,
    "gridRows": 5,
    "targetCells": [
      {
        "col": 0,
        "row": 0
      },
      {
        "col": 2,
        "row": 0
      },
      {
        "col": 0,
        "row": 1
      },
      {
        "col": 1,
        "row": 1
      },
      {
        "col": 2,
        "row": 1
      },
      {
        "col": 3,
        "row": 1
      },
      {
        "col": 0,
        "row": 2
      },
      {
        "col": 2,
        "row": 2
      },
      {
        "col": 3,
        "row": 2
      },
      {
        "col": 0,
        "row": 3
      },
      {
        "col": 1,
        "row": 3
      },
      {
        "col": 2,
        "row": 3
      },
      {
        "col": 3,
        "row": 3
      },
      {
        "col": 4,
        "row": 3
      },
      {
        "col": 0,
        "row": 4
      },
      {
        "col": 4,
        "row": 4
      }
    ],
    "tiles": [
      {
        "tileId": "t1",
        "shape": "PLUS",
        "assetKey": "mo_tile_stone"
      },
      {
        "tileId": "t2",
        "shape": "L",
        "assetKey": "mo_tile_acorn"
      },
      {
        "tileId": "t3",
        "shape": "S",
        "assetKey": "mo_tile_leaf"
      },
      {
        "tileId": "t4",
        "shape": "BAR_3",
        "assetKey": "mo_tile_mushroom"
      }
    ],
    "solution": [
      {
        "tileId": "t1",
        "originCol": 1,
        "originRow": 0,
        "rotation": 0
      },
      {
        "tileId": "t2",
        "originCol": 0,
        "originRow": 3,
        "rotation": 270
      },
      {
        "tileId": "t3",
        "originCol": 3,
        "originRow": 2,
        "rotation": 90
      },
      {
        "tileId": "t4",
        "originCol": 0,
        "originRow": 0,
        "rotation": 90
      }
    ]
  },
  {
    "id": "s1_puzzle_3",
    "gridCols": 5,
    "gridRows": 5,
    "targetCells": [
      {
        "col": 1,
        "row": 0
      },
      {
        "col": 4,
        "row": 0
      },
      {
        "col": 0,
        "row": 1
      },
      {
        "col": 1,
        "row": 1
      },
      {
        "col": 2,
        "row": 1
      },
      {
        "col": 4,
        "row": 1
      },
      {
        "col": 0,
        "row": 2
      },
      {
        "col": 1,
        "row": 2
      },
      {
        "col": 2,
        "row": 2
      },
      {
        "col": 3,
        "row": 2
      },
      {
        "col": 4,
        "row": 2
      },
      {
        "col": 0,
        "row": 3
      },
      {
        "col": 1,
        "row": 3
      },
      {
        "col": 2,
        "row": 3
      },
      {
        "col": 2,
        "row": 4
      }
    ],
    "tiles": [
      {
        "tileId": "t1",
        "shape": "T",
        "assetKey": "mo_tile_mushroom"
      },
      {
        "tileId": "t2",
        "shape": "L_MIRROR",
        "assetKey": "mo_tile_leaf"
      },
      {
        "tileId": "t3",
        "shape": "SQUARE",
        "assetKey": "mo_tile_acorn"
      },
      {
        "tileId": "t4",
        "shape": "BAR_3",
        "assetKey": "mo_tile_stone"
      }
    ],
    "solution": [
      {
        "tileId": "t1",
        "originCol": 0,
        "originRow": 0,
        "rotation": 180
      },
      {
        "tileId": "t2",
        "originCol": 3,
        "originRow": 0,
        "rotation": 0
      },
      {
        "tileId": "t3",
        "originCol": 0,
        "originRow": 2,
        "rotation": 0
      },
      {
        "tileId": "t4",
        "originCol": 2,
        "originRow": 2,
        "rotation": 90
      }
    ]
  },
  {
    "id": "s1_puzzle_4",
    "gridCols": 5,
    "gridRows": 5,
    "targetCells": [
      {
        "col": 0,
        "row": 0
      },
      {
        "col": 1,
        "row": 0
      },
      {
        "col": 3,
        "row": 0
      },
      {
        "col": 0,
        "row": 1
      },
      {
        "col": 1,
        "row": 1
      },
      {
        "col": 2,
        "row": 1
      },
      {
        "col": 3,
        "row": 1
      },
      {
        "col": 0,
        "row": 2
      },
      {
        "col": 1,
        "row": 2
      },
      {
        "col": 2,
        "row": 2
      },
      {
        "col": 3,
        "row": 2
      },
      {
        "col": 0,
        "row": 3
      },
      {
        "col": 3,
        "row": 3
      },
      {
        "col": 4,
        "row": 3
      },
      {
        "col": 2,
        "row": 4
      },
      {
        "col": 3,
        "row": 4
      }
    ],
    "tiles": [
      {
        "tileId": "t1",
        "shape": "BAR_4",
        "assetKey": "mo_tile_acorn"
      },
      {
        "tileId": "t2",
        "shape": "T",
        "assetKey": "mo_tile_stone"
      },
      {
        "tileId": "t3",
        "shape": "S",
        "assetKey": "mo_tile_mushroom"
      },
      {
        "tileId": "t4",
        "shape": "L",
        "assetKey": "mo_tile_leaf"
      }
    ],
    "solution": [
      {
        "tileId": "t1",
        "originCol": 0,
        "originRow": 0,
        "rotation": 90
      },
      {
        "tileId": "t2",
        "originCol": 2,
        "originRow": 0,
        "rotation": 270
      },
      {
        "tileId": "t3",
        "originCol": 2,
        "originRow": 3,
        "rotation": 0
      },
      {
        "tileId": "t4",
        "originCol": 1,
        "originRow": 0,
        "rotation": 0
      }
    ]
  },
  {
    "id": "s1_puzzle_5",
    "gridCols": 5,
    "gridRows": 5,
    "targetCells": [
      {
        "col": 0,
        "row": 0
      },
      {
        "col": 3,
        "row": 0
      },
      {
        "col": 4,
        "row": 0
      },
      {
        "col": 0,
        "row": 1
      },
      {
        "col": 1,
        "row": 1
      },
      {
        "col": 2,
        "row": 1
      },
      {
        "col": 3,
        "row": 1
      },
      {
        "col": 4,
        "row": 1
      },
      {
        "col": 0,
        "row": 2
      },
      {
        "col": 0,
        "row": 3
      },
      {
        "col": 1,
        "row": 3
      },
      {
        "col": 0,
        "row": 4
      },
      {
        "col": 1,
        "row": 4
      },
      {
        "col": 2,
        "row": 4
      },
      {
        "col": 3,
        "row": 4
      },
      {
        "col": 4,
        "row": 4
      }
    ],
    "tiles": [
      {
        "tileId": "t1",
        "shape": "L_MIRROR",
        "assetKey": "mo_tile_leaf"
      },
      {
        "tileId": "t2",
        "shape": "SQUARE",
        "assetKey": "mo_tile_acorn"
      },
      {
        "tileId": "t3",
        "shape": "T",
        "assetKey": "mo_tile_stone"
      },
      {
        "tileId": "t4",
        "shape": "BAR_4",
        "assetKey": "mo_tile_mushroom"
      }
    ],
    "solution": [
      {
        "tileId": "t1",
        "originCol": 0,
        "originRow": 0,
        "rotation": 270
      },
      {
        "tileId": "t2",
        "originCol": 3,
        "originRow": 0,
        "rotation": 0
      },
      {
        "tileId": "t3",
        "originCol": 0,
        "originRow": 2,
        "rotation": 90
      },
      {
        "tileId": "t4",
        "originCol": 1,
        "originRow": 4,
        "rotation": 0
      }
    ]
  },
  {
    "id": "s2_puzzle_1",
    "gridCols": 5,
    "gridRows": 5,
    "targetCells": [
      {
        "col": 0,
        "row": 0
      },
      {
        "col": 1,
        "row": 0
      },
      {
        "col": 2,
        "row": 0
      },
      {
        "col": 3,
        "row": 0
      },
      {
        "col": 0,
        "row": 1
      },
      {
        "col": 1,
        "row": 1
      },
      {
        "col": 3,
        "row": 1
      },
      {
        "col": 0,
        "row": 2
      },
      {
        "col": 1,
        "row": 2
      },
      {
        "col": 3,
        "row": 2
      },
      {
        "col": 4,
        "row": 2
      },
      {
        "col": 0,
        "row": 3
      },
      {
        "col": 1,
        "row": 3
      },
      {
        "col": 2,
        "row": 3
      },
      {
        "col": 3,
        "row": 3
      },
      {
        "col": 2,
        "row": 4
      }
    ],
    "tiles": [
      {
        "tileId": "t1",
        "shape": "BAR_4",
        "assetKey": "mo_tile_leaf"
      },
      {
        "tileId": "t2",
        "shape": "L",
        "assetKey": "mo_tile_mushroom"
      },
      {
        "tileId": "t3",
        "shape": "T",
        "assetKey": "mo_tile_stone"
      },
      {
        "tileId": "t4",
        "shape": "S",
        "assetKey": "mo_tile_acorn"
      }
    ],
    "solution": [
      {
        "tileId": "t1",
        "originCol": 0,
        "originRow": 0,
        "rotation": 90
      },
      {
        "tileId": "t2",
        "originCol": 1,
        "originRow": 0,
        "rotation": 270
      },
      {
        "tileId": "t3",
        "originCol": 3,
        "originRow": 1,
        "rotation": 90
      },
      {
        "tileId": "t4",
        "originCol": 1,
        "originRow": 2,
        "rotation": 90
      }
    ]
  },
  {
    "id": "s2_puzzle_2",
    "gridCols": 5,
    "gridRows": 5,
    "targetCells": [
      {
        "col": 1,
        "row": 0
      },
      {
        "col": 2,
        "row": 0
      },
      {
        "col": 3,
        "row": 0
      },
      {
        "col": 0,
        "row": 1
      },
      {
        "col": 1,
        "row": 1
      },
      {
        "col": 2,
        "row": 1
      },
      {
        "col": 3,
        "row": 1
      },
      {
        "col": 4,
        "row": 1
      },
      {
        "col": 0,
        "row": 2
      },
      {
        "col": 1,
        "row": 2
      },
      {
        "col": 2,
        "row": 2
      },
      {
        "col": 3,
        "row": 2
      },
      {
        "col": 4,
        "row": 2
      },
      {
        "col": 1,
        "row": 3
      },
      {
        "col": 4,
        "row": 3
      },
      {
        "col": 1,
        "row": 4
      }
    ],
    "tiles": [
      {
        "tileId": "t1",
        "shape": "S",
        "assetKey": "mo_tile_acorn"
      },
      {
        "tileId": "t2",
        "shape": "T",
        "assetKey": "mo_tile_stone"
      },
      {
        "tileId": "t3",
        "shape": "L",
        "assetKey": "mo_tile_leaf"
      },
      {
        "tileId": "t4",
        "shape": "L_MIRROR",
        "assetKey": "mo_tile_mushroom"
      }
    ],
    "solution": [
      {
        "tileId": "t1",
        "originCol": 0,
        "originRow": 0,
        "rotation": 0
      },
      {
        "tileId": "t2",
        "originCol": 2,
        "originRow": 0,
        "rotation": 180
      },
      {
        "tileId": "t3",
        "originCol": 0,
        "originRow": 2,
        "rotation": 180
      },
      {
        "tileId": "t4",
        "originCol": 2,
        "originRow": 2,
        "rotation": 90
      }
    ]
  },
  {
    "id": "s2_puzzle_3",
    "gridCols": 5,
    "gridRows": 5,
    "targetCells": [
      {
        "col": 1,
        "row": 0
      },
      {
        "col": 3,
        "row": 0
      },
      {
        "col": 0,
        "row": 1
      },
      {
        "col": 1,
        "row": 1
      },
      {
        "col": 2,
        "row": 1
      },
      {
        "col": 3,
        "row": 1
      },
      {
        "col": 4,
        "row": 1
      },
      {
        "col": 0,
        "row": 2
      },
      {
        "col": 1,
        "row": 2
      },
      {
        "col": 3,
        "row": 2
      },
      {
        "col": 0,
        "row": 3
      },
      {
        "col": 3,
        "row": 3
      },
      {
        "col": 0,
        "row": 4
      },
      {
        "col": 1,
        "row": 4
      },
      {
        "col": 2,
        "row": 4
      },
      {
        "col": 3,
        "row": 4
      }
    ],
    "tiles": [
      {
        "tileId": "t1",
        "shape": "PLUS",
        "assetKey": "mo_tile_mushroom"
      },
      {
        "tileId": "t2",
        "shape": "T",
        "assetKey": "mo_tile_leaf"
      },
      {
        "tileId": "t3",
        "shape": "BAR_3",
        "assetKey": "mo_tile_stone"
      },
      {
        "tileId": "t4",
        "shape": "L",
        "assetKey": "mo_tile_acorn"
      }
    ],
    "solution": [
      {
        "tileId": "t1",
        "originCol": 2,
        "originRow": 0,
        "rotation": 0
      },
      {
        "tileId": "t2",
        "originCol": 0,
        "originRow": 0,
        "rotation": 270
      },
      {
        "tileId": "t3",
        "originCol": 0,
        "originRow": 2,
        "rotation": 90
      },
      {
        "tileId": "t4",
        "originCol": 1,
        "originRow": 3,
        "rotation": 90
      }
    ]
  },
  {
    "id": "s2_puzzle_4",
    "gridCols": 5,
    "gridRows": 5,
    "targetCells": [
      {
        "col": 0,
        "row": 0
      },
      {
        "col": 1,
        "row": 0
      },
      {
        "col": 2,
        "row": 0
      },
      {
        "col": 3,
        "row": 0
      },
      {
        "col": 2,
        "row": 1
      },
      {
        "col": 3,
        "row": 1
      },
      {
        "col": 4,
        "row": 1
      },
      {
        "col": 0,
        "row": 2
      },
      {
        "col": 3,
        "row": 2
      },
      {
        "col": 4,
        "row": 2
      },
      {
        "col": 0,
        "row": 3
      },
      {
        "col": 1,
        "row": 3
      },
      {
        "col": 2,
        "row": 3
      },
      {
        "col": 3,
        "row": 3
      },
      {
        "col": 4,
        "row": 3
      },
      {
        "col": 1,
        "row": 4
      }
    ],
    "tiles": [
      {
        "tileId": "t1",
        "shape": "L_MIRROR",
        "assetKey": "mo_tile_stone"
      },
      {
        "tileId": "t2",
        "shape": "T",
        "assetKey": "mo_tile_leaf"
      },
      {
        "tileId": "t3",
        "shape": "S",
        "assetKey": "mo_tile_acorn"
      },
      {
        "tileId": "t4",
        "shape": "L",
        "assetKey": "mo_tile_mushroom"
      }
    ],
    "solution": [
      {
        "tileId": "t1",
        "originCol": 0,
        "originRow": 0,
        "rotation": 90
      },
      {
        "tileId": "t2",
        "originCol": 3,
        "originRow": 0,
        "rotation": 90
      },
      {
        "tileId": "t3",
        "originCol": 0,
        "originRow": 2,
        "rotation": 90
      },
      {
        "tileId": "t4",
        "originCol": 2,
        "originRow": 2,
        "rotation": 90
      }
    ]
  },
  {
    "id": "s2_puzzle_5",
    "gridCols": 5,
    "gridRows": 5,
    "targetCells": [
      {
        "col": 3,
        "row": 0
      },
      {
        "col": 0,
        "row": 1
      },
      {
        "col": 2,
        "row": 1
      },
      {
        "col": 3,
        "row": 1
      },
      {
        "col": 4,
        "row": 1
      },
      {
        "col": 0,
        "row": 2
      },
      {
        "col": 3,
        "row": 2
      },
      {
        "col": 4,
        "row": 2
      },
      {
        "col": 0,
        "row": 3
      },
      {
        "col": 1,
        "row": 3
      },
      {
        "col": 2,
        "row": 3
      },
      {
        "col": 3,
        "row": 3
      },
      {
        "col": 4,
        "row": 3
      },
      {
        "col": 0,
        "row": 4
      },
      {
        "col": 1,
        "row": 4
      },
      {
        "col": 4,
        "row": 4
      }
    ],
    "tiles": [
      {
        "tileId": "t1",
        "shape": "PLUS",
        "assetKey": "mo_tile_leaf"
      },
      {
        "tileId": "t2",
        "shape": "BAR_4",
        "assetKey": "mo_tile_stone"
      },
      {
        "tileId": "t3",
        "shape": "L",
        "assetKey": "mo_tile_mushroom"
      },
      {
        "tileId": "t4",
        "shape": "BAR_3",
        "assetKey": "mo_tile_acorn"
      }
    ],
    "solution": [
      {
        "tileId": "t1",
        "originCol": 2,
        "originRow": 0,
        "rotation": 0
      },
      {
        "tileId": "t2",
        "originCol": 0,
        "originRow": 1,
        "rotation": 90
      },
      {
        "tileId": "t3",
        "originCol": 1,
        "originRow": 3,
        "rotation": 270
      },
      {
        "tileId": "t4",
        "originCol": 4,
        "originRow": 2,
        "rotation": 90
      }
    ]
  },
  {
    "id": "m1_puzzle_1",
    "gridCols": 5,
    "gridRows": 6,
    "targetCells": [
      {
        "col": 0,
        "row": 0
      },
      {
        "col": 0,
        "row": 1
      },
      {
        "col": 0,
        "row": 3
      },
      {
        "col": 0,
        "row": 4
      },
      {
        "col": 1,
        "row": 0
      },
      {
        "col": 1,
        "row": 1
      },
      {
        "col": 1,
        "row": 2
      },
      {
        "col": 1,
        "row": 3
      },
      {
        "col": 1,
        "row": 4
      },
      {
        "col": 2,
        "row": 0
      },
      {
        "col": 2,
        "row": 1
      },
      {
        "col": 2,
        "row": 2
      },
      {
        "col": 2,
        "row": 3
      },
      {
        "col": 3,
        "row": 2
      },
      {
        "col": 3,
        "row": 3
      },
      {
        "col": 3,
        "row": 4
      }
    ],
    "tiles": [
      {
        "tileId": "t1",
        "shape": "S",
        "assetKey": "mo_tile_leaf"
      },
      {
        "tileId": "t2",
        "shape": "L",
        "assetKey": "mo_tile_mushroom"
      },
      {
        "tileId": "t3",
        "shape": "T",
        "assetKey": "mo_tile_stone"
      },
      {
        "tileId": "t4",
        "shape": "SQUARE",
        "assetKey": "mo_tile_acorn"
      }
    ],
    "solution": [
      {
        "tileId": "t1",
        "originCol": 0,
        "originRow": 0,
        "rotation": 90
      },
      {
        "tileId": "t2",
        "originCol": 1,
        "originRow": 0,
        "rotation": 180
      },
      {
        "tileId": "t3",
        "originCol": 2,
        "originRow": 2,
        "rotation": 270
      },
      {
        "tileId": "t4",
        "originCol": 0,
        "originRow": 3,
        "rotation": 0
      }
    ]
  },
  {
    "id": "m1_puzzle_2",
    "gridCols": 5,
    "gridRows": 6,
    "targetCells": [
      {
        "col": 0,
        "row": 0
      },
      {
        "col": 0,
        "row": 1
      },
      {
        "col": 0,
        "row": 2
      },
      {
        "col": 0,
        "row": 3
      },
      {
        "col": 0,
        "row": 4
      },
      {
        "col": 0,
        "row": 5
      },
      {
        "col": 1,
        "row": 1
      },
      {
        "col": 1,
        "row": 2
      },
      {
        "col": 1,
        "row": 3
      },
      {
        "col": 2,
        "row": 0
      },
      {
        "col": 2,
        "row": 1
      },
      {
        "col": 2,
        "row": 3
      },
      {
        "col": 2,
        "row": 4
      },
      {
        "col": 3,
        "row": 0
      },
      {
        "col": 3,
        "row": 1
      },
      {
        "col": 3,
        "row": 2
      },
      {
        "col": 4,
        "row": 0
      },
      {
        "col": 4,
        "row": 1
      },
      {
        "col": 4,
        "row": 2
      }
    ],
    "tiles": [
      {
        "tileId": "t1",
        "shape": "T",
        "assetKey": "mo_tile_leaf"
      },
      {
        "tileId": "t2",
        "shape": "L",
        "assetKey": "mo_tile_stone"
      },
      {
        "tileId": "t3",
        "shape": "S",
        "assetKey": "mo_tile_mushroom"
      },
      {
        "tileId": "t4",
        "shape": "SQUARE",
        "assetKey": "mo_tile_acorn"
      },
      {
        "tileId": "t5",
        "shape": "BAR_3",
        "assetKey": "mo_tile_leaf"
      }
    ],
    "solution": [
      {
        "tileId": "t1",
        "originCol": 0,
        "originRow": 0,
        "rotation": 90
      },
      {
        "tileId": "t2",
        "originCol": 2,
        "originRow": 0,
        "rotation": 270
      },
      {
        "tileId": "t3",
        "originCol": 1,
        "originRow": 2,
        "rotation": 90
      },
      {
        "tileId": "t4",
        "originCol": 3,
        "originRow": 1,
        "rotation": 0
      },
      {
        "tileId": "t5",
        "originCol": 0,
        "originRow": 3,
        "rotation": 90
      }
    ]
  },
  {
    "id": "m1_puzzle_3",
    "gridCols": 5,
    "gridRows": 6,
    "targetCells": [
      {
        "col": 0,
        "row": 0
      },
      {
        "col": 0,
        "row": 1
      },
      {
        "col": 0,
        "row": 2
      },
      {
        "col": 0,
        "row": 3
      },
      {
        "col": 1,
        "row": 0
      },
      {
        "col": 1,
        "row": 1
      },
      {
        "col": 1,
        "row": 2
      },
      {
        "col": 1,
        "row": 3
      },
      {
        "col": 1,
        "row": 4
      },
      {
        "col": 2,
        "row": 0
      },
      {
        "col": 2,
        "row": 1
      },
      {
        "col": 2,
        "row": 2
      },
      {
        "col": 2,
        "row": 3
      },
      {
        "col": 3,
        "row": 1
      },
      {
        "col": 3,
        "row": 3
      },
      {
        "col": 4,
        "row": 0
      },
      {
        "col": 4,
        "row": 1
      },
      {
        "col": 4,
        "row": 3
      }
    ],
    "tiles": [
      {
        "tileId": "t1",
        "shape": "T",
        "assetKey": "mo_tile_acorn"
      },
      {
        "tileId": "t2",
        "shape": "L",
        "assetKey": "mo_tile_leaf"
      },
      {
        "tileId": "t3",
        "shape": "L_MIRROR",
        "assetKey": "mo_tile_mushroom"
      },
      {
        "tileId": "t4",
        "shape": "BAR_3",
        "assetKey": "mo_tile_stone"
      },
      {
        "tileId": "t5",
        "shape": "BAR_3",
        "assetKey": "mo_tile_leaf"
      }
    ],
    "solution": [
      {
        "tileId": "t1",
        "originCol": 0,
        "originRow": 0,
        "rotation": 0
      },
      {
        "tileId": "t2",
        "originCol": 2,
        "originRow": 0,
        "rotation": 90
      },
      {
        "tileId": "t3",
        "originCol": 1,
        "originRow": 2,
        "rotation": 180
      },
      {
        "tileId": "t4",
        "originCol": 0,
        "originRow": 1,
        "rotation": 90
      },
      {
        "tileId": "t5",
        "originCol": 2,
        "originRow": 3,
        "rotation": 0
      }
    ]
  },
  {
    "id": "m1_puzzle_4",
    "gridCols": 5,
    "gridRows": 6,
    "targetCells": [
      {
        "col": 0,
        "row": 0
      },
      {
        "col": 0,
        "row": 1
      },
      {
        "col": 0,
        "row": 2
      },
      {
        "col": 1,
        "row": 2
      },
      {
        "col": 1,
        "row": 3
      },
      {
        "col": 1,
        "row": 4
      },
      {
        "col": 1,
        "row": 5
      },
      {
        "col": 2,
        "row": 0
      },
      {
        "col": 2,
        "row": 1
      },
      {
        "col": 2,
        "row": 2
      },
      {
        "col": 2,
        "row": 3
      },
      {
        "col": 2,
        "row": 4
      },
      {
        "col": 3,
        "row": 1
      },
      {
        "col": 3,
        "row": 2
      },
      {
        "col": 3,
        "row": 3
      },
      {
        "col": 3,
        "row": 4
      },
      {
        "col": 3,
        "row": 5
      },
      {
        "col": 4,
        "row": 2
      },
      {
        "col": 4,
        "row": 3
      }
    ],
    "tiles": [
      {
        "tileId": "t1",
        "shape": "L",
        "assetKey": "mo_tile_stone"
      },
      {
        "tileId": "t2",
        "shape": "T",
        "assetKey": "mo_tile_leaf"
      },
      {
        "tileId": "t3",
        "shape": "SQUARE",
        "assetKey": "mo_tile_acorn"
      },
      {
        "tileId": "t4",
        "shape": "BAR_3",
        "assetKey": "mo_tile_mushroom"
      },
      {
        "tileId": "t5",
        "shape": "S",
        "assetKey": "mo_tile_leaf"
      }
    ],
    "solution": [
      {
        "tileId": "t1",
        "originCol": 0,
        "originRow": 0,
        "rotation": 0
      },
      {
        "tileId": "t2",
        "originCol": 2,
        "originRow": 0,
        "rotation": 90
      },
      {
        "tileId": "t3",
        "originCol": 3,
        "originRow": 2,
        "rotation": 0
      },
      {
        "tileId": "t4",
        "originCol": 1,
        "originRow": 3,
        "rotation": 90
      },
      {
        "tileId": "t5",
        "originCol": 2,
        "originRow": 3,
        "rotation": 90
      }
    ]
  },
  {
    "id": "m1_puzzle_5",
    "gridCols": 5,
    "gridRows": 6,
    "targetCells": [
      {
        "col": 0,
        "row": 0
      },
      {
        "col": 0,
        "row": 1
      },
      {
        "col": 0,
        "row": 2
      },
      {
        "col": 0,
        "row": 3
      },
      {
        "col": 1,
        "row": 0
      },
      {
        "col": 1,
        "row": 2
      },
      {
        "col": 1,
        "row": 4
      },
      {
        "col": 2,
        "row": 0
      },
      {
        "col": 2,
        "row": 1
      },
      {
        "col": 2,
        "row": 2
      },
      {
        "col": 2,
        "row": 3
      },
      {
        "col": 2,
        "row": 4
      },
      {
        "col": 3,
        "row": 0
      },
      {
        "col": 3,
        "row": 1
      },
      {
        "col": 3,
        "row": 2
      },
      {
        "col": 3,
        "row": 3
      }
    ],
    "tiles": [
      {
        "tileId": "t1",
        "shape": "BAR_4",
        "assetKey": "mo_tile_mushroom"
      },
      {
        "tileId": "t2",
        "shape": "L_MIRROR",
        "assetKey": "mo_tile_stone"
      },
      {
        "tileId": "t3",
        "shape": "T",
        "assetKey": "mo_tile_leaf"
      },
      {
        "tileId": "t4",
        "shape": "S",
        "assetKey": "mo_tile_acorn"
      }
    ],
    "solution": [
      {
        "tileId": "t1",
        "originCol": 0,
        "originRow": 0,
        "rotation": 90
      },
      {
        "tileId": "t2",
        "originCol": 1,
        "originRow": 0,
        "rotation": 90
      },
      {
        "tileId": "t3",
        "originCol": 1,
        "originRow": 1,
        "rotation": 180
      },
      {
        "tileId": "t4",
        "originCol": 1,
        "originRow": 3,
        "rotation": 0
      }
    ]
  },
  {
    "id": "l1_puzzle_1",
    "gridCols": 6,
    "gridRows": 5,
    "targetCells": [
      {
        "col": 0,
        "row": 0
      },
      {
        "col": 1,
        "row": 0
      },
      {
        "col": 2,
        "row": 0
      },
      {
        "col": 3,
        "row": 0
      },
      {
        "col": 4,
        "row": 0
      },
      {
        "col": 5,
        "row": 0
      },
      {
        "col": 0,
        "row": 1
      },
      {
        "col": 1,
        "row": 1
      },
      {
        "col": 2,
        "row": 1
      },
      {
        "col": 3,
        "row": 1
      },
      {
        "col": 0,
        "row": 2
      },
      {
        "col": 1,
        "row": 2
      },
      {
        "col": 2,
        "row": 2
      },
      {
        "col": 3,
        "row": 2
      },
      {
        "col": 1,
        "row": 3
      },
      {
        "col": 0,
        "row": 4
      },
      {
        "col": 1,
        "row": 4
      },
      {
        "col": 2,
        "row": 4
      }
    ],
    "tiles": [
      {
        "tileId": "t1",
        "shape": "BAR_3",
        "assetKey": "mo_tile_leaf"
      },
      {
        "tileId": "t2",
        "shape": "T",
        "assetKey": "mo_tile_mushroom"
      },
      {
        "tileId": "t3",
        "shape": "SQUARE",
        "assetKey": "mo_tile_stone"
      },
      {
        "tileId": "t4",
        "shape": "L",
        "assetKey": "mo_tile_acorn"
      },
      {
        "tileId": "t5",
        "shape": "BAR_3",
        "assetKey": "mo_tile_leaf"
      }
    ],
    "solution": [
      {
        "tileId": "t1",
        "originCol": 0,
        "originRow": 0,
        "rotation": 90
      },
      {
        "tileId": "t2",
        "originCol": 0,
        "originRow": 3,
        "rotation": 180
      },
      {
        "tileId": "t3",
        "originCol": 1,
        "originRow": 0,
        "rotation": 0
      },
      {
        "tileId": "t4",
        "originCol": 1,
        "originRow": 1,
        "rotation": 90
      },
      {
        "tileId": "t5",
        "originCol": 3,
        "originRow": 0,
        "rotation": 0
      }
    ]
  },
  {
    "id": "l1_puzzle_2",
    "gridCols": 6,
    "gridRows": 5,
    "targetCells": [
      {
        "col": 0,
        "row": 0
      },
      {
        "col": 1,
        "row": 0
      },
      {
        "col": 3,
        "row": 0
      },
      {
        "col": 4,
        "row": 0
      },
      {
        "col": 5,
        "row": 0
      },
      {
        "col": 0,
        "row": 1
      },
      {
        "col": 1,
        "row": 1
      },
      {
        "col": 2,
        "row": 1
      },
      {
        "col": 3,
        "row": 1
      },
      {
        "col": 4,
        "row": 1
      },
      {
        "col": 5,
        "row": 1
      },
      {
        "col": 0,
        "row": 2
      },
      {
        "col": 1,
        "row": 2
      },
      {
        "col": 3,
        "row": 2
      },
      {
        "col": 4,
        "row": 2
      },
      {
        "col": 5,
        "row": 2
      },
      {
        "col": 1,
        "row": 3
      },
      {
        "col": 1,
        "row": 4
      }
    ],
    "tiles": [
      {
        "tileId": "t1",
        "shape": "SQUARE",
        "assetKey": "mo_tile_leaf"
      },
      {
        "tileId": "t2",
        "shape": "L",
        "assetKey": "mo_tile_mushroom"
      },
      {
        "tileId": "t3",
        "shape": "T",
        "assetKey": "mo_tile_stone"
      },
      {
        "tileId": "t4",
        "shape": "BAR_3",
        "assetKey": "mo_tile_acorn"
      },
      {
        "tileId": "t5",
        "shape": "BAR_3",
        "assetKey": "mo_tile_leaf"
      }
    ],
    "solution": [
      {
        "tileId": "t1",
        "originCol": 0,
        "originRow": 0,
        "rotation": 0
      },
      {
        "tileId": "t2",
        "originCol": 0,
        "originRow": 2,
        "rotation": 180
      },
      {
        "tileId": "t3",
        "originCol": 2,
        "originRow": 0,
        "rotation": 270
      },
      {
        "tileId": "t4",
        "originCol": 4,
        "originRow": 0,
        "rotation": 90
      },
      {
        "tileId": "t5",
        "originCol": 5,
        "originRow": 0,
        "rotation": 90
      }
    ]
  },
  {
    "id": "l1_puzzle_3",
    "gridCols": 6,
    "gridRows": 5,
    "targetCells": [
      {
        "col": 5,
        "row": 0
      },
      {
        "col": 0,
        "row": 1
      },
      {
        "col": 1,
        "row": 1
      },
      {
        "col": 2,
        "row": 1
      },
      {
        "col": 4,
        "row": 1
      },
      {
        "col": 5,
        "row": 1
      },
      {
        "col": 1,
        "row": 2
      },
      {
        "col": 2,
        "row": 2
      },
      {
        "col": 3,
        "row": 2
      },
      {
        "col": 4,
        "row": 2
      },
      {
        "col": 5,
        "row": 2
      },
      {
        "col": 2,
        "row": 3
      },
      {
        "col": 3,
        "row": 3
      },
      {
        "col": 4,
        "row": 3
      },
      {
        "col": 5,
        "row": 3
      },
      {
        "col": 2,
        "row": 4
      },
      {
        "col": 3,
        "row": 4
      },
      {
        "col": 4,
        "row": 4
      },
      {
        "col": 5,
        "row": 4
      }
    ],
    "tiles": [
      {
        "tileId": "t1",
        "shape": "BAR_3",
        "assetKey": "mo_tile_leaf"
      },
      {
        "tileId": "t2",
        "shape": "L",
        "assetKey": "mo_tile_mushroom"
      },
      {
        "tileId": "t3",
        "shape": "T",
        "assetKey": "mo_tile_stone"
      },
      {
        "tileId": "t4",
        "shape": "L_MIRROR",
        "assetKey": "mo_tile_acorn"
      },
      {
        "tileId": "t5",
        "shape": "BAR_4",
        "assetKey": "mo_tile_leaf"
      }
    ],
    "solution": [
      {
        "tileId": "t1",
        "originCol": 0,
        "originRow": 1,
        "rotation": 0
      },
      {
        "tileId": "t2",
        "originCol": 1,
        "originRow": 2,
        "rotation": 180
      },
      {
        "tileId": "t3",
        "originCol": 3,
        "originRow": 1,
        "rotation": 270
      },
      {
        "tileId": "t4",
        "originCol": 3,
        "originRow": 3,
        "rotation": 270
      },
      {
        "tileId": "t5",
        "originCol": 5,
        "originRow": 0,
        "rotation": 90
      }
    ]
  },
  {
    "id": "l1_puzzle_4",
    "gridCols": 6,
    "gridRows": 5,
    "targetCells": [
      {
        "col": 2,
        "row": 0
      },
      {
        "col": 3,
        "row": 0
      },
      {
        "col": 4,
        "row": 0
      },
      {
        "col": 5,
        "row": 0
      },
      {
        "col": 2,
        "row": 1
      },
      {
        "col": 3,
        "row": 1
      },
      {
        "col": 4,
        "row": 1
      },
      {
        "col": 5,
        "row": 1
      },
      {
        "col": 1,
        "row": 2
      },
      {
        "col": 2,
        "row": 2
      },
      {
        "col": 3,
        "row": 2
      },
      {
        "col": 4,
        "row": 2
      },
      {
        "col": 5,
        "row": 2
      },
      {
        "col": 3,
        "row": 3
      },
      {
        "col": 4,
        "row": 3
      },
      {
        "col": 5,
        "row": 3
      },
      {
        "col": 3,
        "row": 4
      },
      {
        "col": 4,
        "row": 4
      }
    ],
    "tiles": [
      {
        "tileId": "t1",
        "shape": "L_MIRROR",
        "assetKey": "mo_tile_leaf"
      },
      {
        "tileId": "t2",
        "shape": "SQUARE",
        "assetKey": "mo_tile_mushroom"
      },
      {
        "tileId": "t3",
        "shape": "S",
        "assetKey": "mo_tile_stone"
      },
      {
        "tileId": "t4",
        "shape": "BAR_3",
        "assetKey": "mo_tile_acorn"
      },
      {
        "tileId": "t5",
        "shape": "BAR_3",
        "assetKey": "mo_tile_leaf"
      }
    ],
    "solution": [
      {
        "tileId": "t1",
        "originCol": 1,
        "originRow": 2,
        "rotation": 90
      },
      {
        "tileId": "t2",
        "originCol": 2,
        "originRow": 0,
        "rotation": 0
      },
      {
        "tileId": "t3",
        "originCol": 3,
        "originRow": 3,
        "rotation": 0
      },
      {
        "tileId": "t4",
        "originCol": 4,
        "originRow": 0,
        "rotation": 90
      },
      {
        "tileId": "t5",
        "originCol": 5,
        "originRow": 0,
        "rotation": 90
      }
    ]
  },
  {
    "id": "l1_puzzle_5",
    "gridCols": 6,
    "gridRows": 5,
    "targetCells": [
      {
        "col": 4,
        "row": 0
      },
      {
        "col": 3,
        "row": 1
      },
      {
        "col": 4,
        "row": 1
      },
      {
        "col": 5,
        "row": 1
      },
      {
        "col": 1,
        "row": 2
      },
      {
        "col": 2,
        "row": 2
      },
      {
        "col": 3,
        "row": 2
      },
      {
        "col": 4,
        "row": 2
      },
      {
        "col": 5,
        "row": 2
      },
      {
        "col": 1,
        "row": 3
      },
      {
        "col": 2,
        "row": 3
      },
      {
        "col": 3,
        "row": 3
      },
      {
        "col": 4,
        "row": 3
      },
      {
        "col": 5,
        "row": 3
      },
      {
        "col": 1,
        "row": 4
      },
      {
        "col": 3,
        "row": 4
      },
      {
        "col": 4,
        "row": 4
      },
      {
        "col": 5,
        "row": 4
      }
    ],
    "tiles": [
      {
        "tileId": "t1",
        "shape": "BAR_3",
        "assetKey": "mo_tile_leaf"
      },
      {
        "tileId": "t2",
        "shape": "S",
        "assetKey": "mo_tile_mushroom"
      },
      {
        "tileId": "t3",
        "shape": "T",
        "assetKey": "mo_tile_stone"
      },
      {
        "tileId": "t4",
        "shape": "L",
        "assetKey": "mo_tile_acorn"
      },
      {
        "tileId": "t5",
        "shape": "BAR_3",
        "assetKey": "mo_tile_leaf"
      }
    ],
    "solution": [
      {
        "tileId": "t1",
        "originCol": 1,
        "originRow": 2,
        "rotation": 90
      },
      {
        "tileId": "t2",
        "originCol": 2,
        "originRow": 2,
        "rotation": 90
      },
      {
        "tileId": "t3",
        "originCol": 3,
        "originRow": 0,
        "rotation": 180
      },
      {
        "tileId": "t4",
        "originCol": 3,
        "originRow": 2,
        "rotation": 180
      },
      {
        "tileId": "t5",
        "originCol": 5,
        "originRow": 2,
        "rotation": 90
      }
    ]
  },
  {
    "id": "l2_puzzle_1",
    "gridCols": 6,
    "gridRows": 6,
    "targetCells": [
      {
        "col": 0,
        "row": 0
      },
      {
        "col": 1,
        "row": 0
      },
      {
        "col": 2,
        "row": 0
      },
      {
        "col": 3,
        "row": 0
      },
      {
        "col": 4,
        "row": 0
      },
      {
        "col": 5,
        "row": 0
      },
      {
        "col": 0,
        "row": 1
      },
      {
        "col": 1,
        "row": 1
      },
      {
        "col": 4,
        "row": 1
      },
      {
        "col": 0,
        "row": 2
      },
      {
        "col": 1,
        "row": 2
      },
      {
        "col": 2,
        "row": 2
      },
      {
        "col": 4,
        "row": 2
      },
      {
        "col": 0,
        "row": 3
      },
      {
        "col": 2,
        "row": 3
      },
      {
        "col": 3,
        "row": 3
      },
      {
        "col": 4,
        "row": 3
      },
      {
        "col": 5,
        "row": 3
      },
      {
        "col": 0,
        "row": 4
      },
      {
        "col": 4,
        "row": 4
      }
    ],
    "tiles": [
      {
        "tileId": "t1",
        "shape": "L",
        "assetKey": "mo_tile_leaf"
      },
      {
        "tileId": "t2",
        "shape": "T",
        "assetKey": "mo_tile_mushroom"
      },
      {
        "tileId": "t3",
        "shape": "S",
        "assetKey": "mo_tile_stone"
      },
      {
        "tileId": "t4",
        "shape": "PLUS",
        "assetKey": "mo_tile_acorn"
      },
      {
        "tileId": "t5",
        "shape": "BAR_3",
        "assetKey": "mo_tile_leaf"
      }
    ],
    "solution": [
      {
        "tileId": "t1",
        "originCol": 0,
        "originRow": 0,
        "rotation": 270
      },
      {
        "tileId": "t2",
        "originCol": 3,
        "originRow": 0,
        "rotation": 0
      },
      {
        "tileId": "t3",
        "originCol": 1,
        "originRow": 1,
        "rotation": 90
      },
      {
        "tileId": "t4",
        "originCol": 3,
        "originRow": 2,
        "rotation": 0
      },
      {
        "tileId": "t5",
        "originCol": 0,
        "originRow": 2,
        "rotation": 90
      }
    ]
  },
  {
    "id": "l2_puzzle_2",
    "gridCols": 6,
    "gridRows": 6,
    "targetCells": [
      {
        "col": 0,
        "row": 0
      },
      {
        "col": 1,
        "row": 0
      },
      {
        "col": 2,
        "row": 0
      },
      {
        "col": 3,
        "row": 0
      },
      {
        "col": 4,
        "row": 0
      },
      {
        "col": 5,
        "row": 0
      },
      {
        "col": 0,
        "row": 1
      },
      {
        "col": 1,
        "row": 1
      },
      {
        "col": 2,
        "row": 1
      },
      {
        "col": 4,
        "row": 1
      },
      {
        "col": 5,
        "row": 1
      },
      {
        "col": 0,
        "row": 2
      },
      {
        "col": 2,
        "row": 2
      },
      {
        "col": 3,
        "row": 2
      },
      {
        "col": 4,
        "row": 2
      },
      {
        "col": 0,
        "row": 3
      },
      {
        "col": 1,
        "row": 3
      },
      {
        "col": 2,
        "row": 3
      },
      {
        "col": 3,
        "row": 3
      },
      {
        "col": 4,
        "row": 3
      },
      {
        "col": 2,
        "row": 4
      }
    ],
    "tiles": [
      {
        "tileId": "t1",
        "shape": "BAR_4",
        "assetKey": "mo_tile_stone"
      },
      {
        "tileId": "t2",
        "shape": "SQUARE",
        "assetKey": "mo_tile_acorn"
      },
      {
        "tileId": "t3",
        "shape": "L_MIRROR",
        "assetKey": "mo_tile_leaf"
      },
      {
        "tileId": "t4",
        "shape": "T",
        "assetKey": "mo_tile_mushroom"
      },
      {
        "tileId": "t5",
        "shape": "PLUS",
        "assetKey": "mo_tile_stone"
      }
    ],
    "solution": [
      {
        "tileId": "t1",
        "originCol": 0,
        "originRow": 0,
        "rotation": 90
      },
      {
        "tileId": "t2",
        "originCol": 1,
        "originRow": 0,
        "rotation": 0
      },
      {
        "tileId": "t3",
        "originCol": 3,
        "originRow": 0,
        "rotation": 90
      },
      {
        "tileId": "t4",
        "originCol": 3,
        "originRow": 1,
        "rotation": 270
      },
      {
        "tileId": "t5",
        "originCol": 1,
        "originRow": 2,
        "rotation": 0
      }
    ]
  },
  {
    "id": "l2_puzzle_3",
    "gridCols": 6,
    "gridRows": 6,
    "targetCells": [
      {
        "col": 0,
        "row": 0
      },
      {
        "col": 3,
        "row": 0
      },
      {
        "col": 4,
        "row": 0
      },
      {
        "col": 5,
        "row": 0
      },
      {
        "col": 0,
        "row": 1
      },
      {
        "col": 2,
        "row": 1
      },
      {
        "col": 3,
        "row": 1
      },
      {
        "col": 4,
        "row": 1
      },
      {
        "col": 5,
        "row": 1
      },
      {
        "col": 0,
        "row": 2
      },
      {
        "col": 1,
        "row": 2
      },
      {
        "col": 2,
        "row": 2
      },
      {
        "col": 3,
        "row": 2
      },
      {
        "col": 4,
        "row": 2
      },
      {
        "col": 5,
        "row": 2
      },
      {
        "col": 3,
        "row": 3
      },
      {
        "col": 4,
        "row": 3
      },
      {
        "col": 5,
        "row": 3
      },
      {
        "col": 4,
        "row": 4
      }
    ],
    "tiles": [
      {
        "tileId": "t1",
        "shape": "BAR_3",
        "assetKey": "mo_tile_acorn"
      },
      {
        "tileId": "t2",
        "shape": "SQUARE",
        "assetKey": "mo_tile_mushroom"
      },
      {
        "tileId": "t3",
        "shape": "T",
        "assetKey": "mo_tile_leaf"
      },
      {
        "tileId": "t4",
        "shape": "PLUS",
        "assetKey": "mo_tile_stone"
      },
      {
        "tileId": "t5",
        "shape": "BAR_3",
        "assetKey": "mo_tile_leaf"
      }
    ],
    "solution": [
      {
        "tileId": "t1",
        "originCol": 0,
        "originRow": 0,
        "rotation": 90
      },
      {
        "tileId": "t2",
        "originCol": 3,
        "originRow": 0,
        "rotation": 0
      },
      {
        "tileId": "t3",
        "originCol": 1,
        "originRow": 1,
        "rotation": 180
      },
      {
        "tileId": "t4",
        "originCol": 3,
        "originRow": 2,
        "rotation": 0
      },
      {
        "tileId": "t5",
        "originCol": 5,
        "originRow": 0,
        "rotation": 90
      }
    ]
  },
  {
    "id": "l2_puzzle_4",
    "gridCols": 6,
    "gridRows": 6,
    "targetCells": [
      {
        "col": 0,
        "row": 0
      },
      {
        "col": 2,
        "row": 0
      },
      {
        "col": 4,
        "row": 0
      },
      {
        "col": 0,
        "row": 1
      },
      {
        "col": 1,
        "row": 1
      },
      {
        "col": 2,
        "row": 1
      },
      {
        "col": 3,
        "row": 1
      },
      {
        "col": 4,
        "row": 1
      },
      {
        "col": 5,
        "row": 1
      },
      {
        "col": 0,
        "row": 2
      },
      {
        "col": 2,
        "row": 2
      },
      {
        "col": 4,
        "row": 2
      },
      {
        "col": 5,
        "row": 2
      },
      {
        "col": 0,
        "row": 3
      },
      {
        "col": 2,
        "row": 3
      },
      {
        "col": 3,
        "row": 3
      },
      {
        "col": 4,
        "row": 3
      },
      {
        "col": 5,
        "row": 3
      },
      {
        "col": 1,
        "row": 4
      },
      {
        "col": 2,
        "row": 4
      },
      {
        "col": 3,
        "row": 4
      },
      {
        "col": 2,
        "row": 5
      }
    ],
    "tiles": [
      {
        "tileId": "t1",
        "shape": "PLUS",
        "assetKey": "mo_tile_mushroom"
      },
      {
        "tileId": "t2",
        "shape": "BAR_4",
        "assetKey": "mo_tile_stone"
      },
      {
        "tileId": "t3",
        "shape": "T",
        "assetKey": "mo_tile_acorn"
      },
      {
        "tileId": "t4",
        "shape": "L",
        "assetKey": "mo_tile_leaf"
      },
      {
        "tileId": "t5",
        "shape": "PLUS",
        "assetKey": "mo_tile_mushroom"
      }
    ],
    "solution": [
      {
        "tileId": "t1",
        "originCol": 1,
        "originRow": 0,
        "rotation": 0
      },
      {
        "tileId": "t2",
        "originCol": 0,
        "originRow": 0,
        "rotation": 90
      },
      {
        "tileId": "t3",
        "originCol": 4,
        "originRow": 0,
        "rotation": 90
      },
      {
        "tileId": "t4",
        "originCol": 3,
        "originRow": 2,
        "rotation": 90
      },
      {
        "tileId": "t5",
        "originCol": 1,
        "originRow": 3,
        "rotation": 0
      }
    ]
  },
  {
    "id": "l2_puzzle_5",
    "gridCols": 6,
    "gridRows": 6,
    "targetCells": [
      {
        "col": 0,
        "row": 0
      },
      {
        "col": 3,
        "row": 0
      },
      {
        "col": 4,
        "row": 0
      },
      {
        "col": 0,
        "row": 1
      },
      {
        "col": 1,
        "row": 1
      },
      {
        "col": 2,
        "row": 1
      },
      {
        "col": 3,
        "row": 1
      },
      {
        "col": 0,
        "row": 2
      },
      {
        "col": 1,
        "row": 2
      },
      {
        "col": 2,
        "row": 2
      },
      {
        "col": 3,
        "row": 2
      },
      {
        "col": 4,
        "row": 2
      },
      {
        "col": 1,
        "row": 3
      },
      {
        "col": 3,
        "row": 3
      },
      {
        "col": 4,
        "row": 3
      },
      {
        "col": 1,
        "row": 4
      },
      {
        "col": 3,
        "row": 4
      },
      {
        "col": 3,
        "row": 5
      }
    ],
    "tiles": [
      {
        "tileId": "t1",
        "shape": "T",
        "assetKey": "mo_tile_leaf"
      },
      {
        "tileId": "t2",
        "shape": "S",
        "assetKey": "mo_tile_acorn"
      },
      {
        "tileId": "t3",
        "shape": "L_MIRROR",
        "assetKey": "mo_tile_mushroom"
      },
      {
        "tileId": "t4",
        "shape": "BAR_3",
        "assetKey": "mo_tile_stone"
      },
      {
        "tileId": "t5",
        "shape": "BAR_3",
        "assetKey": "mo_tile_leaf"
      }
    ],
    "solution": [
      {
        "tileId": "t1",
        "originCol": 0,
        "originRow": 0,
        "rotation": 90
      },
      {
        "tileId": "t2",
        "originCol": 2,
        "originRow": 0,
        "rotation": 0
      },
      {
        "tileId": "t3",
        "originCol": 2,
        "originRow": 2,
        "rotation": 90
      },
      {
        "tileId": "t4",
        "originCol": 1,
        "originRow": 2,
        "rotation": 90
      },
      {
        "tileId": "t5",
        "originCol": 3,
        "originRow": 3,
        "rotation": 90
      }
    ]
  }
];

export function getRandomPuzzle(): MosaicPuzzle {
  return puzzleLibrary[Math.floor(Math.random() * puzzleLibrary.length)];
}
