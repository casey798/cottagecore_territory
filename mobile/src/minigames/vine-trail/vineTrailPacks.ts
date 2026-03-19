export interface VineTrailWord {
  word: string;
  path: [number, number][];
  isSpangram: boolean;
}

export interface VineTrailPack {
  id: string;
  theme: string;
  spangramHint: string;
  grid: string[][];
  words: VineTrailWord[];
  hintWords: string[];
}

export const vineTrailPacks: VineTrailPack[] = [
  {
    id: "pack-001",
    theme: "GARDEN SHED",
    spangramHint: "Where all this gear lives",
    grid: [
      ["S","S","E","V","O","G"],
      ["H","O","V","E","L","L"],
      ["G","A","R","D","E","S"],
      ["L","T","B","N","S","H"],
      ["A","R","S","U","S","E"],
      ["D","O","R","H","C","D"],
      ["D","W","E","A","S","K"],
      ["E","R","E","L","E","T"]
    ],
    words: [
      { word: "GARDENSHED", path: [[2,0],[2,1],[2,2],[2,3],[2,4],[3,3],[3,4],[3,5],[4,5],[5,5]], isSpangram: true },
      { word: "SHOVELS", path: [[0,0],[1,0],[1,1],[1,2],[1,3],[1,4],[2,5]], isSpangram: false },
      { word: "BUCKETS", path: [[3,2],[4,3],[5,4],[6,5],[7,4],[7,5],[6,4]], isSpangram: false },
      { word: "GLOVES", path: [[0,5],[1,5],[0,4],[0,3],[0,2],[0,1]], isSpangram: false },
      { word: "LADDER", path: [[3,0],[4,0],[5,0],[6,0],[7,0],[7,1]], isSpangram: false },
      { word: "TROWEL", path: [[3,1],[4,1],[5,1],[6,1],[7,2],[7,3]], isSpangram: false },
      { word: "SHEARS", path: [[4,4],[5,3],[6,2],[6,3],[5,2],[4,2]], isSpangram: false }
    ],
    hintWords: []
  },
  {
    id: "pack-002",
    theme: "WATERING PLANTS",
    spangramHint: "How gardens get their drink",
    grid: [
      ["P","H","D","R","I","Z"],
      ["O","S","O","S","Z","R"],
      ["U","S","P","L","T","E"],
      ["R","I","E","L","A","S"],
      ["S","I","N","M","A","R"],
      ["M","P","N","G","S","E"],
      ["D","I","R","G","H","L"],
      ["E","T","S","I","N","K"]
    ],
    words: [
      { word: "SPRINKLERS", path: [[4,0],[5,1],[6,2],[7,3],[7,4],[7,5],[6,5],[5,5],[4,5],[3,5]], isSpangram: true },
      { word: "DRIZZLE", path: [[0,2],[0,3],[0,4],[0,5],[1,4],[2,3],[3,2]], isSpangram: false },
      { word: "POURING", path: [[0,0],[1,0],[2,0],[3,0],[4,1],[5,2],[6,3]], isSpangram: false },
      { word: "HOSING", path: [[0,1],[1,2],[2,1],[3,1],[4,2],[5,3]], isSpangram: false },
      { word: "SPLASH", path: [[1,1],[2,2],[3,3],[4,4],[5,4],[6,4]], isSpangram: false },
      { word: "STREAM", path: [[1,3],[2,4],[1,5],[2,5],[3,4],[4,3]], isSpangram: false },
      { word: "MISTED", path: [[5,0],[6,1],[7,2],[7,1],[7,0],[6,0]], isSpangram: false }
    ],
    hintWords: []
  },
  {
    id: "pack-003",
    theme: "WORKING THE SOIL",
    spangramHint: "Enriching the earth naturally",
    grid: [
      ["C","P","T","D","R","L"],
      ["L","O","I","A","I","O"],
      ["O","L","M","K","O","G"],
      ["L","W","I","P","G","S"],
      ["I","N","E","I","O","E"],
      ["N","G","N","D","N","S"],
      ["G","G","F","I","S","T"],
      ["D","E","T","G","N","I"]
    ],
    words: [
      { word: "COMPOSTING", path: [[0,0],[1,1],[2,2],[3,3],[4,4],[5,5],[6,5],[7,5],[7,4],[7,3]], isSpangram: true },
      { word: "TILLING", path: [[0,2],[1,2],[2,1],[3,0],[4,0],[5,0],[6,0]], isSpangram: false },
      { word: "DIGGING", path: [[0,3],[1,4],[2,5],[3,4],[4,3],[5,2],[6,1]], isSpangram: false },
      { word: "PLOWED", path: [[0,1],[1,0],[2,0],[3,1],[4,2],[5,3]], isSpangram: false },
      { word: "RAKING", path: [[0,4],[1,3],[2,3],[3,2],[4,1],[5,1]], isSpangram: false },
      { word: "LOOSEN", path: [[0,5],[1,5],[2,4],[3,5],[4,5],[5,4]], isSpangram: false },
      { word: "SIFTED", path: [[6,4],[6,3],[6,2],[7,2],[7,1],[7,0]], isSpangram: false }
    ],
    hintWords: []
  },
  {
    id: "pack-004",
    theme: "HAND TOOLS",
    spangramHint: "Breaks up hard ground",
    grid: [
      ["T","P","S","W","E","E"],
      ["R","D","R","H","D","R"],
      ["O","I","B","U","E","E"],
      ["W","B","L","S","N","A"],
      ["E","L","S","E","R","E"],
      ["C","U","L","T","I","R"],
      ["L","O","S","V","R","S"],
      ["E","V","H","A","T","O"]
    ],
    words: [
      { word: "CULTIVATOR", path: [[5,0],[5,1],[5,2],[5,3],[5,4],[6,3],[7,3],[7,4],[7,5],[6,4]], isSpangram: true },
      { word: "TROWELS", path: [[0,0],[1,0],[2,0],[3,0],[4,0],[4,1],[4,2]], isSpangram: false },
      { word: "PRUNERS", path: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,5],[6,5]], isSpangram: false },
      { word: "SHEARS", path: [[0,2],[1,3],[2,4],[3,5],[4,4],[3,3]], isSpangram: false },
      { word: "WEEDER", path: [[0,3],[0,4],[0,5],[1,4],[2,5],[1,5]], isSpangram: false },
      { word: "DIBBLE", path: [[1,1],[2,1],[3,1],[2,2],[3,2],[4,3]], isSpangram: false },
      { word: "SHOVEL", path: [[6,2],[7,2],[6,1],[7,1],[7,0],[6,0]], isSpangram: false }
    ],
    hintWords: []
  },
  {
    id: "pack-005",
    theme: "GREENHOUSE",
    spangramHint: "A glass house for growing",
    grid: [
      ["S","O","R","C","H","I"],
      ["H","S","H","E","D","C"],
      ["E","P","A","S","S","A"],
      ["L","E","R","T","U","C"],
      ["V","W","S","O","E","T"],
      ["O","E","E","U","U","R"],
      ["G","L","S","R","O","T"],
      ["F","R","E","E","N","H"]
    ],
    words: [
      { word: "GREENHOUSE", path: [[6,0],[7,1],[7,2],[7,3],[7,4],[7,5],[6,4],[5,3],[4,2],[3,1]], isSpangram: true },
      { word: "ORCHIDS", path: [[0,1],[0,2],[0,3],[0,4],[0,5],[1,4],[2,3]], isSpangram: false },
      { word: "SHELVES", path: [[0,0],[1,0],[2,0],[3,0],[4,0],[5,1],[6,2]], isSpangram: false },
      { word: "HEATER", path: [[1,2],[1,3],[2,2],[3,3],[4,4],[5,5]], isSpangram: false },
      { word: "SPROUT", path: [[1,1],[2,1],[3,2],[4,3],[5,4],[6,5]], isSpangram: false },
      { word: "CACTUS", path: [[1,5],[2,5],[3,5],[4,5],[3,4],[2,4]], isSpangram: false },
      { word: "FLOWER", path: [[7,0],[6,1],[5,0],[4,1],[5,2],[6,3]], isSpangram: false }
    ],
    hintWords: []
  },
  {
    id: "pack-006",
    theme: "FOREST ANIMALS",
    spangramHint: "A habitat among the trees",
    grid: [
      ["S","Q","U","I","R","R"],
      ["W","P","R","A","A","R"],
      ["O","A","N","C","B","E"],
      ["B","O","C","T","B","L"],
      ["A","O","D","I","H","R"],
      ["O","D","T","L","E","E"],
      ["N","C","G","T","A","D"],
      ["O","Y","O","E","R","N"]
    ],
    words: [
      { word: "WOODLAND", path: [[1,0],[2,0],[3,1],[4,2],[5,3],[6,4],[7,5],[6,5]], isSpangram: true },
      { word: "RACCOON", path: [[0,5],[1,4],[2,3],[3,2],[4,1],[5,0],[6,0]], isSpangram: false },
      { word: "PANTHER", path: [[1,1],[2,1],[2,2],[3,3],[4,4],[5,5],[4,5]], isSpangram: false },
      { word: "RABBIT", path: [[1,2],[1,3],[2,4],[3,4],[4,3],[5,2]], isSpangram: false },
      { word: "BADGER", path: [[3,0],[4,0],[5,1],[6,2],[7,3],[7,4]], isSpangram: false },
      { word: "COYOTE", path: [[6,1],[7,0],[7,1],[7,2],[6,3],[5,4]], isSpangram: false },
      { word: "SQUIRREL", path: [[0,0],[0,1],[0,2],[0,3],[0,4],[1,5],[2,5],[3,5]], isSpangram: false }
    ],
    hintWords: []
  },
  {
    id: "pack-007",
    theme: "THINGS A FOX DOES",
    spangramHint: "Outsmarting the competition",
    grid: [
      ["C","B","P","S","N","S"],
      ["H","S","U","O","T","E"],
      ["A","P","R","A","U","A"],
      ["S","R","L","R","K","N"],
      ["I","K","I","S","O","C"],
      ["I","N","G","N","W","E"],
      ["O","N","G","T","I","G"],
      ["U","T","F","O","X","N"]
    ],
    words: [
      { word: "OUTFOXING", path: [[6,0],[7,0],[7,1],[7,2],[7,3],[7,4],[6,4],[7,5],[6,5]], isSpangram: true },
      { word: "STALKING", path: [[0,5],[1,4],[2,3],[3,2],[4,1],[5,0],[6,1],[6,2]], isSpangram: false },
      { word: "CHASING", path: [[0,0],[1,0],[2,0],[3,0],[4,0],[5,1],[5,2]], isSpangram: false },
      { word: "POUNCE", path: [[0,2],[1,3],[2,4],[3,5],[4,5],[5,5]], isSpangram: false },
      { word: "BURROW", path: [[0,1],[1,2],[2,2],[3,3],[4,4],[5,4]], isSpangram: false },
      { word: "SNEAKS", path: [[0,3],[0,4],[1,5],[2,5],[3,4],[4,3]], isSpangram: false },
      { word: "SPRINT", path: [[1,1],[2,1],[3,1],[4,2],[5,3],[6,3]], isSpangram: false }
    ],
    hintWords: []
  },
  {
    id: "pack-008",
    theme: "BIRDS AT DAWN",
    spangramHint: "Morning melodies in the trees",
    grid: [
      ["S","W","A","R","B","L"],
      ["P","A","R","R","O","E"],
      ["S","T","U","W","F","R"],
      ["O","R","H","S","H","I"],
      ["N","G","B","I","R","N"],
      ["M","C","U","C","C","D"],
      ["P","A","E","H","K","S"],
      ["G","I","E","S","O","O"]
    ],
    words: [
      { word: "SONGBIRDS", path: [[2,0],[3,0],[4,0],[4,1],[4,2],[4,3],[4,4],[5,5],[6,5]], isSpangram: true },
      { word: "WARBLER", path: [[0,1],[0,2],[0,3],[0,4],[0,5],[1,5],[2,5]], isSpangram: false },
      { word: "SPARROW", path: [[0,0],[1,0],[1,1],[1,2],[1,3],[1,4],[2,3]], isSpangram: false },
      { word: "FINCHES", path: [[2,4],[3,5],[4,5],[5,4],[6,3],[7,2],[7,3]], isSpangram: false },
      { word: "THRUSH", path: [[2,1],[3,2],[3,1],[2,2],[3,3],[3,4]], isSpangram: false },
      { word: "CUCKOO", path: [[5,1],[5,2],[5,3],[6,4],[7,5],[7,4]], isSpangram: false },
      { word: "MAGPIE", path: [[5,0],[6,1],[7,0],[6,0],[7,1],[6,2]], isSpangram: false }
    ],
    hintWords: []
  },
  {
    id: "pack-009",
    theme: "SMALL WOODLAND CREATURES",
    spangramHint: "Cheeks stuffed with acorns",
    grid: [
      ["F","R","A","G","O","P"],
      ["E","B","E","S","H","W"],
      ["R","L","B","E","A","E"],
      ["C","R","R","I","T","S"],
      ["H","S","E","T","S","S"],
      ["I","P","M","U","N","H"],
      ["M","O","T","S","R","K"],
      ["A","R","M","E","W","S"]
    ],
    words: [
      { word: "CHIPMUNKS", path: [[3,0],[4,0],[5,0],[5,1],[5,2],[5,3],[5,4],[6,5],[7,5]], isSpangram: true },
      { word: "GOPHERS", path: [[0,3],[0,4],[0,5],[1,4],[2,3],[3,2],[4,1]], isSpangram: false },
      { word: "FERRETS", path: [[0,0],[1,0],[2,0],[3,1],[4,2],[4,3],[4,4]], isSpangram: false },
      { word: "RABBITS", path: [[0,1],[0,2],[1,1],[2,2],[3,3],[3,4],[3,5]], isSpangram: false },
      { word: "WEASEL", path: [[1,5],[2,5],[2,4],[1,3],[1,2],[2,1]], isSpangram: false },
      { word: "SHREWS", path: [[4,5],[5,5],[6,4],[7,3],[7,4],[6,3]], isSpangram: false },
      { word: "MARMOT", path: [[6,0],[7,0],[7,1],[7,2],[6,1],[6,2]], isSpangram: false }
    ],
    hintWords: []
  },
  {
    id: "pack-010",
    theme: "ANIMALS IN WINTER",
    spangramHint: "The long winter sleep",
    grid: [
      ["S","H","M","F","O","R"],
      ["H","E","I","B","U","A"],
      ["U","L","G","R","O","G"],
      ["D","T","R","W","R","E"],
      ["D","E","A","T","E","S"],
      ["R","L","H","E","A","G"],
      ["R","E","E","T","T","N"],
      ["H","I","B","E","R","A"]
    ],
    words: [
      { word: "HIBERNATE", path: [[7,0],[7,1],[7,2],[7,3],[7,4],[6,5],[7,5],[6,4],[5,3]], isSpangram: true },
      { word: "MIGRATE", path: [[0,2],[1,2],[2,2],[3,2],[4,2],[4,3],[4,4]], isSpangram: false },
      { word: "SHELTER", path: [[0,0],[0,1],[1,1],[2,1],[3,1],[4,1],[5,0]], isSpangram: false },
      { word: "FORAGES", path: [[0,3],[0,4],[0,5],[1,5],[2,5],[3,5],[4,5]], isSpangram: false },
      { word: "HUDDLE", path: [[1,0],[2,0],[3,0],[4,0],[5,1],[6,2]], isSpangram: false },
      { word: "BURROW", path: [[1,3],[1,4],[2,3],[3,4],[2,4],[3,3]], isSpangram: false },
      { word: "GATHER", path: [[5,5],[5,4],[6,3],[5,2],[6,1],[6,0]], isSpangram: false }
    ],
    hintWords: []
  },
  {
    id: "pack-011",
    theme: "BAKING BREAD",
    spangramHint: "A tangy loaf starter",
    grid: [
      ["S","K","R","O","L","L"],
      ["O","R","N","L","B","I"],
      ["U","I","O","E","U","N"],
      ["S","R","A","T","A","G"],
      ["I","V","D","E","T","D"],
      ["N","E","R","O","G","I"],
      ["G","S","S","C","U","N"],
      ["Y","T","U","R","H","G"]
    ],
    words: [
      { word: "SOURDOUGH", path: [[0,0],[1,0],[2,0],[3,1],[4,2],[5,3],[6,4],[7,5],[7,4]], isSpangram: true },
      { word: "KNEADING", path: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,5],[6,5],[5,4]], isSpangram: false },
      { word: "ROLLING", path: [[0,2],[0,3],[0,4],[0,5],[1,5],[2,5],[3,5]], isSpangram: false },
      { word: "RISING", path: [[1,1],[2,1],[3,0],[4,0],[5,0],[6,0]], isSpangram: false },
      { word: "BUTTER", path: [[1,4],[2,4],[3,3],[4,4],[4,3],[5,2]], isSpangram: false },
      { word: "LOAVES", path: [[1,3],[2,2],[3,2],[4,1],[5,1],[6,1]], isSpangram: false },
      { word: "CRUSTY", path: [[6,3],[7,3],[7,2],[6,2],[7,1],[7,0]], isSpangram: false }
    ],
    hintWords: []
  },
  {
    id: "pack-012",
    theme: "COTTAGE SWEETS",
    spangramHint: "Sugar and everything nice",
    grid: [
      ["C","O","O","K","I","C"],
      ["S","P","S","E","Y","A"],
      ["W","A","S","T","R","R"],
      ["E","E","T","N","E","A"],
      ["P","T","O","F","M","S"],
      ["E","U","F","E","S","S"],
      ["D","E","L","C","O","N"],
      ["D","I","N","G","S","E"]
    ],
    words: [
      { word: "SWEETNESS", path: [[1,0],[2,0],[3,0],[3,1],[3,2],[3,3],[3,4],[4,5],[5,5]], isSpangram: true },
      { word: "COOKIES", path: [[0,0],[0,1],[0,2],[0,3],[0,4],[1,3],[2,2]], isSpangram: false },
      { word: "CARAMEL", path: [[0,5],[1,5],[2,5],[3,5],[4,4],[5,3],[6,2]], isSpangram: false },
      { word: "PUDDING", path: [[4,0],[5,1],[6,0],[7,0],[7,1],[7,2],[7,3]], isSpangram: false },
      { word: "PASTRY", path: [[1,1],[2,1],[1,2],[2,3],[2,4],[1,4]], isSpangram: false },
      { word: "TOFFEE", path: [[4,1],[4,2],[4,3],[5,2],[6,1],[5,0]], isSpangram: false },
      { word: "SCONES", path: [[5,4],[6,3],[6,4],[6,5],[7,5],[7,4]], isSpangram: false }
    ],
    hintWords: []
  },
  {
    id: "pack-013",
    theme: "KITCHEN TOOLS",
    spangramHint: "Pots, pans, and more",
    grid: [
      ["S","S","B","L","E","N"],
      ["T","R","P","P","G","D"],
      ["R","E","E","A","R","E"],
      ["A","E","L","A","T","R"],
      ["I","N","E","R","T","U"],
      ["S","O","N","S","L","E"],
      ["C","P","O","A","R","R"],
      ["O","O","K","W","A","E"]
    ],
    words: [
      { word: "COOKWARE", path: [[6,0],[7,0],[7,1],[7,2],[7,3],[7,4],[6,5],[7,5]], isSpangram: true },
      { word: "GRATER", path: [[1,4],[2,4],[3,3],[4,4],[5,5],[6,4]], isSpangram: false },
      { word: "PEELER", path: [[1,3],[2,2],[3,1],[3,2],[2,1],[1,1]], isSpangram: false },
      { word: "SPOONS", path: [[5,0],[6,1],[6,2],[5,1],[5,2],[5,3]], isSpangram: false },
      { word: "STRAINER", path: [[0,0],[1,0],[2,0],[3,0],[4,0],[4,1],[4,2],[4,3]], isSpangram: false },
      { word: "SPATULA", path: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,4],[6,3]], isSpangram: false },
      { word: "BLENDER", path: [[0,2],[0,3],[0,4],[0,5],[1,5],[2,5],[3,5]], isSpangram: false }
    ],
    hintWords: []
  },
  {
    id: "pack-014",
    theme: "BAKING ACTIONS",
    spangramHint: "Getting the amounts right",
    grid: [
      ["P","F","O","S","I","F"],
      ["O","L","N","I","T","M"],
      ["U","G","D","I","X","I"],
      ["M","R","N","I","N","G"],
      ["E","G","I","N","G","R"],
      ["A","S","U","R","I","I"],
      ["B","N","G","G","S","N"],
      ["A","K","I","I","N","G"]
    ],
    words: [
      { word: "MEASURING", path: [[3,0],[4,0],[5,0],[5,1],[5,2],[5,3],[5,4],[6,5],[7,5]], isSpangram: true },
      { word: "MIXING", path: [[1,5],[2,5],[2,4],[1,3],[1,2],[2,1]], isSpangram: false },
      { word: "RISING", path: [[4,5],[5,5],[6,4],[7,3],[7,4],[6,3]], isSpangram: false },
      { word: "BAKING", path: [[6,0],[7,0],[7,1],[7,2],[6,1],[6,2]], isSpangram: false },
      { word: "SIFTING", path: [[0,3],[0,4],[0,5],[1,4],[2,3],[3,2],[4,1]], isSpangram: false },
      { word: "POURING", path: [[0,0],[1,0],[2,0],[3,1],[4,2],[4,3],[4,4]], isSpangram: false },
      { word: "FOLDING", path: [[0,1],[0,2],[1,1],[2,2],[3,3],[3,4],[3,5]], isSpangram: false }
    ],
    hintWords: []
  },
  {
    id: "pack-015",
    theme: "CAKE INGREDIENTS",
    spangramHint: "A rich dark flavor",
    grid: [
      ["V","C","I","N","N","A"],
      ["B","A","A","D","N","M"],
      ["G","U","N","L","O","O"],
      ["N","I","T","I","M","N"],
      ["C","U","N","T","L","E"],
      ["T","H","E","G","L","T"],
      ["M","R","O","E","A","A"],
      ["E","G","R","C","O","L"]
    ],
    words: [
      { word: "CHOCOLATE", path: [[4,0],[5,1],[6,2],[7,3],[7,4],[7,5],[6,5],[5,5],[4,5]], isSpangram: true },
      { word: "CINNAMON", path: [[0,1],[0,2],[0,3],[0,4],[0,5],[1,5],[2,5],[3,5]], isSpangram: false },
      { word: "VANILLA", path: [[0,0],[1,1],[2,2],[3,3],[4,4],[5,4],[6,4]], isSpangram: false },
      { word: "BUTTER", path: [[1,0],[2,1],[3,2],[4,3],[5,2],[6,1]], isSpangram: false },
      { word: "ALMOND", path: [[1,2],[2,3],[3,4],[2,4],[1,4],[1,3]], isSpangram: false },
      { word: "GINGER", path: [[2,0],[3,1],[4,2],[5,3],[6,3],[7,2]], isSpangram: false },
      { word: "NUTMEG", path: [[3,0],[4,1],[5,0],[6,0],[7,0],[7,1]], isSpangram: false }
    ],
    hintWords: []
  },
  {
    id: "pack-016",
    theme: "GARDEN FLOWERS",
    spangramHint: "Where blooms are planted in rows",
    grid: [
      ["P","S","P","I","L","T"],
      ["E","T","U","N","I","U"],
      ["F","L","O","W","E","A"],
      ["V","Z","O","R","B","E"],
      ["I","I","A","R","D","D"],
      ["O","N","I","A","C","S"],
      ["L","N","H","L","S","H"],
      ["E","T","I","A","I","D"]
    ],
    words: [
      { word: "FLOWERBEDS", path: [[2,0],[2,1],[2,2],[2,3],[2,4],[3,3],[3,4],[3,5],[4,5],[5,5]], isSpangram: true },
      { word: "PETUNIA", path: [[0,0],[1,0],[1,1],[1,2],[1,3],[1,4],[2,5]], isSpangram: false },
      { word: "ORCHIDS", path: [[3,2],[4,3],[5,4],[6,5],[7,4],[7,5],[6,4]], isSpangram: false },
      { word: "TULIPS", path: [[0,5],[1,5],[0,4],[0,3],[0,2],[0,1]], isSpangram: false },
      { word: "VIOLET", path: [[3,0],[4,0],[5,0],[6,0],[7,0],[7,1]], isSpangram: false },
      { word: "ZINNIA", path: [[3,1],[4,1],[5,1],[6,1],[7,2],[7,3]], isSpangram: false },
      { word: "DAHLIA", path: [[4,4],[5,3],[6,2],[6,3],[5,2],[4,2]], isSpangram: false }
    ],
    hintWords: []
  },
  {
    id: "pack-017",
    theme: "TYPES OF TREES",
    spangramHint: "A forest full of these",
    grid: [
      ["C","W","S","C","E","C"],
      ["Y","M","I","P","H","D"],
      ["P","A","L","E","R","A"],
      ["R","P","S","L","R","U"],
      ["E","T","L","S","O","C"],
      ["N","S","S","E","W","E"],
      ["W","U","T","S","N","S"],
      ["O","O","D","L","A","D"]
    ],
    words: [
      { word: "WOODLANDS", path: [[6,0],[7,0],[7,1],[7,2],[7,3],[7,4],[6,4],[7,5],[6,5]], isSpangram: true },
      { word: "CHESTNUT", path: [[0,5],[1,4],[2,3],[3,2],[4,1],[5,0],[6,1],[6,2]], isSpangram: false },
      { word: "CYPRESS", path: [[0,0],[1,0],[2,0],[3,0],[4,0],[5,1],[5,2]], isSpangram: false },
      { word: "SPRUCE", path: [[0,2],[1,3],[2,4],[3,5],[4,5],[5,5]], isSpangram: false },
      { word: "WILLOW", path: [[0,1],[1,2],[2,2],[3,3],[4,4],[5,4]], isSpangram: false },
      { word: "CEDARS", path: [[0,3],[0,4],[1,5],[2,5],[3,4],[4,3]], isSpangram: false },
      { word: "MAPLES", path: [[1,1],[2,1],[3,1],[4,2],[5,3],[6,3]], isSpangram: false }
    ],
    hintWords: []
  },
  {
    id: "pack-018",
    theme: "PARTS OF A PLANT",
    spangramHint: "All the green stuff growing",
    grid: [
      ["V","L","F","B","T","P"],
      ["E","E","L","H","L","E"],
      ["A","O","G","O","T","O"],
      ["W","V","R","E","S","A"],
      ["E","N","E","S","T","L"],
      ["R","S","O","S","S","A"],
      ["S","M","O","H","S","T"],
      ["S","T","O","N","O","I"]
    ],
    words: [
      { word: "VEGETATION", path: [[0,0],[1,1],[2,2],[3,3],[4,4],[5,5],[6,5],[7,5],[7,4],[7,3]], isSpangram: true },
      { word: "FLOWERS", path: [[0,2],[1,2],[2,1],[3,0],[4,0],[5,0],[6,0]], isSpangram: false },
      { word: "BLOSSOM", path: [[0,3],[1,4],[2,5],[3,4],[4,3],[5,2],[6,1]], isSpangram: false },
      { word: "LEAVES", path: [[0,1],[1,0],[2,0],[3,1],[4,2],[5,3]], isSpangram: false },
      { word: "THORNS", path: [[0,4],[1,3],[2,3],[3,2],[4,1],[5,1]], isSpangram: false },
      { word: "PETALS", path: [[0,5],[1,5],[2,4],[3,5],[4,5],[5,4]], isSpangram: false },
      { word: "SHOOTS", path: [[6,4],[6,3],[6,2],[7,2],[7,1],[7,0]], isSpangram: false }
    ],
    hintWords: []
  },
  {
    id: "pack-019",
    theme: "THINGS THAT GROW IN SPRING",
    spangramHint: "The season of new growth",
    grid: [
      ["D","S","T","C","L","O"],
      ["A","S","P","U","V","R"],
      ["I","H","O","R","L","E"],
      ["S","O","T","S","O","I"],
      ["I","E","S","S","P","U"],
      ["S","P","R","I","N","T"],
      ["S","E","G","G","E","S"],
      ["N","E","R","T","I","M"]
    ],
    words: [
      { word: "SPRINGTIME", path: [[5,0],[5,1],[5,2],[5,3],[5,4],[6,3],[7,3],[7,4],[7,5],[6,4]], isSpangram: true },
      { word: "DAISIES", path: [[0,0],[1,0],[2,0],[3,0],[4,0],[4,1],[4,2]], isSpangram: false },
      { word: "SPROUTS", path: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,5],[6,5]], isSpangram: false },
      { word: "TULIPS", path: [[0,2],[1,3],[2,4],[3,5],[4,4],[3,3]], isSpangram: false },
      { word: "CLOVER", path: [[0,3],[0,4],[0,5],[1,4],[2,5],[1,5]], isSpangram: false },
      { word: "SHOOTS", path: [[1,1],[2,1],[3,1],[2,2],[3,2],[4,3]], isSpangram: false },
      { word: "GREENS", path: [[6,2],[7,2],[6,1],[7,1],[7,0],[6,0]], isSpangram: false }
    ],
    hintWords: []
  },
  {
    id: "pack-020",
    theme: "WHAT PLANTS NEED",
    spangramHint: "Food and care for growing things",
    grid: [
      ["N","O","W","C","C","S"],
      ["X","O","A","A","O","H"],
      ["Y","R","U","R","M","O"],
      ["G","B","M","R","P","W"],
      ["E","T","O","O","I","E"],
      ["H","N","S","N","R","S"],
      ["B","T","E","Z","E","H"],
      ["R","E","T","N","E","M"]
    ],
    words: [
      { word: "NOURISHMENT", path: [[0,0],[1,1],[2,2],[3,3],[4,4],[5,5],[6,5],[7,5],[7,4],[7,3],[7,2]], isSpangram: true },
      { word: "COMPOST", path: [[0,4],[1,4],[2,4],[3,4],[4,3],[5,2],[6,1]], isSpangram: false },
      { word: "WARMTH", path: [[0,2],[1,3],[2,3],[3,2],[4,1],[5,0]], isSpangram: false },
      { word: "OXYGEN", path: [[0,1],[1,0],[2,0],[3,0],[4,0],[5,1]], isSpangram: false },
      { word: "CARBON", path: [[0,3],[1,2],[2,1],[3,1],[4,2],[5,3]], isSpangram: false },
      { word: "SHOWER", path: [[0,5],[1,5],[2,5],[3,5],[4,5],[5,4]], isSpangram: false },
      { word: "BREEZE", path: [[6,0],[7,0],[7,1],[6,2],[6,3],[6,4]], isSpangram: false }
    ],
    hintWords: []
  },
  {
    id: "pack-021",
    theme: "PLACES TO STUDY",
    spangramHint: "Where students hit the books",
    grid: [
      ["L","L","B","C","O","M"],
      ["I","S","O","E","N","M"],
      ["B","E","N","U","S","O"],
      ["S","R","H","C","N","S"],
      ["D","T","A","G","E","T"],
      ["P","O","U","R","S","O"],
      ["A","O","R","D","Y","P"],
      ["T","I","S","M","Y","S"]
    ],
    words: [
      { word: "STUDYSPOTS", path: [[3,0],[4,1],[5,2],[6,3],[7,4],[7,5],[6,5],[5,5],[4,5],[3,5]], isSpangram: true },
      { word: "LIBRARY", path: [[0,0],[1,0],[2,0],[3,1],[4,2],[5,3],[6,4]], isSpangram: false },
      { word: "LOUNGES", path: [[0,1],[1,2],[2,3],[3,4],[4,3],[4,4],[5,4]], isSpangram: false },
      { word: "DORMS", path: [[4,0],[5,1],[6,2],[7,3],[7,2]], isSpangram: false },
      { word: "COMMONS", path: [[0,3],[0,4],[0,5],[1,5],[2,5],[1,4],[2,4]], isSpangram: false },
      { word: "BENCHES", path: [[0,2],[1,3],[2,2],[3,3],[3,2],[2,1],[1,1]], isSpangram: false },
      { word: "PATIO", path: [[5,0],[6,0],[7,0],[7,1],[6,1]], isSpangram: false }
    ],
    hintWords: []
  },
  {
    id: "pack-022",
    theme: "THINGS IN A CLASSROOM",
    spangramHint: "Teacher writes on this",
    grid: [
      ["M","C","P","E","N","C"],
      ["A","P","H","E","I","A"],
      ["R","A","O","L","R","S"],
      ["K","I","S","S","E","D"],
      ["W","E","R","R","T","R"],
      ["S","H","R","S","E","A"],
      ["N","C","I","S","R","O"],
      ["E","E","R","T","E","B"]
    ],
    words: [
      { word: "WHITEBOARD", path: [[4,0],[5,1],[6,2],[7,3],[7,4],[7,5],[6,5],[5,5],[4,5],[3,5]], isSpangram: true },
      { word: "PENCILS", path: [[0,2],[0,3],[0,4],[0,5],[1,4],[2,3],[3,2]], isSpangram: false },
      { word: "CHAIRS", path: [[0,1],[1,2],[2,1],[3,1],[4,2],[5,3]], isSpangram: false },
      { word: "POSTER", path: [[1,1],[2,2],[3,3],[4,4],[5,4],[6,4]], isSpangram: false },
      { word: "ERASER", path: [[1,3],[2,4],[1,5],[2,5],[3,4],[4,3]], isSpangram: false },
      { word: "SCREEN", path: [[5,0],[6,1],[7,2],[7,1],[7,0],[6,0]], isSpangram: false },
      { word: "MARKERS", path: [[0,0],[1,0],[2,0],[3,0],[4,1],[5,2],[6,3]], isSpangram: false }
    ],
    hintWords: []
  },
  {
    id: "pack-023",
    theme: "BETWEEN CLASSES",
    spangramHint: "Time to relax and recharge",
    grid: [
      ["T","T","E","X","T","I"],
      ["A","L","K","I","N","N"],
      ["B","S","C","G","W","G"],
      ["R","A","N","K","S","A"],
      ["E","A","K","T","I","L"],
      ["C","S","C","R","K","M"],
      ["F","O","E","I","O","E"],
      ["F","E","N","G","L","L"]
    ],
    words: [
      { word: "BREAKTIME", path: [[2,0],[3,0],[4,0],[4,1],[4,2],[4,3],[4,4],[5,5],[6,5]], isSpangram: true },
      { word: "TEXTING", path: [[0,1],[0,2],[0,3],[0,4],[0,5],[1,5],[2,5]], isSpangram: false },
      { word: "TALKING", path: [[0,0],[1,0],[1,1],[1,2],[1,3],[1,4],[2,3]], isSpangram: false },
      { word: "WALKING", path: [[2,4],[3,5],[4,5],[5,4],[6,3],[7,2],[7,3]], isSpangram: false },
      { word: "SNACKS", path: [[2,1],[3,2],[3,1],[2,2],[3,3],[3,4]], isSpangram: false },
      { word: "SCROLL", path: [[5,1],[5,2],[5,3],[6,4],[7,5],[7,4]], isSpangram: false },
      { word: "COFFEE", path: [[5,0],[6,1],[7,0],[6,0],[7,1],[6,2]], isSpangram: false }
    ],
    hintWords: []
  },
  {
    id: "pack-024",
    theme: "COLLEGE CANTEEN",
    spangramHint: "Where everyone eats on campus",
    grid: [
      ["C","K","E","N","A","P"],
      ["O","T","E","T","K","P"],
      ["U","S","C","I","A","L"],
      ["C","N","N","H","U","P"],
      ["A","S","T","E","R","S"],
      ["F","E","T","E","R","P"],
      ["S","W","S","S","O","I"],
      ["T","R","A","O","N","A"]
    ],
    words: [
      { word: "CAFETERIA", path: [[3,0],[4,0],[5,0],[5,1],[5,2],[5,3],[5,4],[6,5],[7,5]], isSpangram: true },
      { word: "NAPKINS", path: [[0,3],[0,4],[0,5],[1,4],[2,3],[3,2],[4,1]], isSpangram: false },
      { word: "COUNTER", path: [[0,0],[1,0],[2,0],[3,1],[4,2],[4,3],[4,4]], isSpangram: false },
      { word: "KETCHUP", path: [[0,1],[0,2],[1,1],[2,2],[3,3],[3,4],[3,5]], isSpangram: false },
      { word: "PLATES", path: [[1,5],[2,5],[2,4],[1,3],[1,2],[2,1]], isSpangram: false },
      { word: "SPOONS", path: [[4,5],[5,5],[6,4],[7,3],[7,4],[6,3]], isSpangram: false },
      { word: "STRAWS", path: [[6,0],[7,0],[7,1],[7,2],[6,1],[6,2]], isSpangram: false }
    ],
    hintWords: []
  },
  {
    id: "pack-025",
    theme: "CAMPUS OUTDOORS",
    spangramHint: "Open area surrounded by buildings",
    grid: [
      ["F","O","B","E","Z","G"],
      ["O","U","N","T","A","A"],
      ["C","O","U","R","T","I"],
      ["P","A","G","Y","F","N"],
      ["A","A","T","P","A","I"],
      ["R","Z","L","H","E","R"],
      ["D","A","S","L","W","D"],
      ["E","N","S","D","Y","A"]
    ],
    words: [
      { word: "COURTYARD", path: [[2,0],[2,1],[2,2],[2,3],[2,4],[3,3],[4,4],[5,5],[6,5]], isSpangram: true },
      { word: "GARDENS", path: [[3,2],[4,1],[5,0],[6,0],[7,0],[7,1],[7,2]], isSpangram: false },
      { word: "PATHWAY", path: [[3,0],[3,1],[4,2],[5,3],[6,4],[7,5],[7,4]], isSpangram: false },
      { word: "FOUNTAIN", path: [[0,0],[1,0],[1,1],[1,2],[1,3],[1,4],[2,5],[3,5]], isSpangram: false },
      { word: "GAZEBO", path: [[0,5],[1,5],[0,4],[0,3],[0,2],[0,1]], isSpangram: false },
      { word: "FIELDS", path: [[3,4],[4,5],[5,4],[6,3],[7,3],[6,2]], isSpangram: false },
      { word: "PLAZA", path: [[4,3],[5,2],[6,1],[5,1],[4,0]], isSpangram: false }
    ],
    hintWords: []
  }
];
