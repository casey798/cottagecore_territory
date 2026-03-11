/**
 * Grove Words — answer pool and guess validation.
 *
 * ANSWER_WORDS: curated list of recognizable, nature/cottagecore-themed words
 * used for puzzle generation. All 5-letter, uppercase.
 *
 * Guess validation uses VALID_GUESSES from validGuesses.ts (14,854 words).
 */

export const ANSWER_WORDS: readonly string[] = [
  // ── Nature & outdoors ───────────────────────────────────────────────
  'ACORN', 'ALDER', 'ALGAE', 'ASPEN', 'ASTER',
  'BASIN', 'BEACH', 'BERRY', 'BIRCH', 'BLOOM',
  'BLOWN', 'BLUFF', 'BOUGH', 'BRIAR', 'BROOK',
  'BRUSH', 'CAIRN', 'CEDAR', 'CLIFF', 'CLOVE',
  'CLOUD', 'CLUMP', 'COAST', 'CORAL', 'CREEK',
  'CREST', 'CROPS', 'CROWN', 'DAISY', 'DELTA',
  'DITCH', 'DRIFT', 'DUNES', 'DUSTY', 'EARTH',
  'FAUNA', 'FERNS', 'FIELD', 'FJORD', 'FLAME',
  'FLASH', 'FLORA', 'FLOOD', 'FLOAT', 'FLOCK',
  'FLINT', 'FORGE', 'FROND', 'FROST', 'FRUIT',
  'FUNGI', 'GLADE', 'GLEAM', 'GLOOM', 'GOOSE',
  'GORGE', 'GRAIN', 'GRAPE', 'GRASS', 'GRAVE',
  'GREEN', 'GROVE', 'GROWN', 'GULCH', 'HAVEN',
  'HAZEL', 'HEATH', 'HEDGE', 'HERBS', 'HERON',
  'HILLY', 'KNOLL', 'LEAFY', 'LEDGE', 'LILAC',
  'MARSH', 'MELON', 'MIRTH', 'MISTY', 'MOIST',
  'MOOSE', 'MOSSY', 'MOUND', 'MOUNT', 'MUDDY',
  'MULCH', 'OAKEN', 'OCEAN', 'OLIVE', 'ONION',
  'PANSY', 'PEACH', 'PEARL', 'PERCH', 'PETAL',
  'PLANT', 'PLUCK', 'PLUME', 'PLUMP', 'POPPY',
  'PRUNE', 'QUAIL', 'RAINY', 'RANCH', 'RANGE',
  'REEDS', 'RIDGE', 'RIPEN', 'RISEN', 'RIVER',
  'ROBIN', 'ROCKY', 'ROOTS', 'ROSES', 'ROUGH',
  'RURAL', 'SCENT', 'SCRUB', 'SEDGE', 'SHADE',
  'SHADY', 'SHELL', 'SHIRE', 'SHORE', 'SHRUB',
  'SLATE', 'SLOPE', 'SNOWY', 'SPORE', 'SPRAY',
  'STALK', 'STEMS', 'STOKE', 'STONE', 'STONY',
  'STORK', 'STORM', 'STRAW', 'STUMP', 'SWAMP',
  'SWARM', 'SWIFT', 'THORN', 'THYME', 'TIDAL',
  'TRAIL', 'TROUT', 'TULIP', 'VINES', 'VISTA',
  'WATER', 'WHEAT', 'WINDY', 'WOODS', 'WOODY',

  // ── Cottage & rural life ────────────────────────────────────────────
  'AMBER', 'APPLE', 'ARBOR', 'AROMA', 'ATTIC',
  'BADGE', 'BAKER', 'BOARD', 'BOWER', 'BRAID',
  'BRAND', 'BRAVE', 'BREAD', 'BRICK', 'BRISK',
  'BROAD', 'BROOD', 'BROWN', 'BUILD', 'CABIN',
  'CALVE', 'CANAL', 'CARRY', 'CHAIR', 'CHALK',
  'CHARM', 'CHASE', 'CHEST', 'CIDER', 'CLAMP',
  'CLASP', 'CLEAN', 'CLEAR', 'CLIMB', 'CLOAK',
  'CLOTH', 'COACH', 'CRAFT', 'CRANE', 'CREAM',
  'CRISP', 'CROSS', 'CRUSH', 'CYCLE', 'DAIRY',
  'DANCE', 'DREAM', 'DRESS', 'DRINK', 'DWELL',
  'EAGLE', 'EMBER', 'FABLE', 'FAITH', 'FANCY',
  'FEAST', 'FENCE', 'FIBER', 'FLASK', 'FLEET',
  'FLOOR', 'FLOUR', 'FOUND', 'FRAME', 'FRESH',
  'FRONT', 'GLAZE', 'GLIDE', 'GLOBE', 'GLORY',
  'GOURD', 'GRACE', 'GRAND', 'GRASP', 'GREET',
  'GRIEF', 'GRILL', 'GRIND', 'GUARD', 'GUIDE',
  'GUILD', 'HARDY', 'HASTE', 'HAUNT', 'HEART',
  'HOBBY', 'HONEY', 'HONOR', 'HORSE', 'HOUND',
  'HOUSE', 'IVORY', 'JOLLY', 'JUICE', 'KNACK',
  'KNEEL', 'KNELT', 'KNIFE', 'KNOWN', 'LABOR',
  'LANCE', 'LATCH', 'LAYER', 'LEAPT', 'LEARN',
  'LIGHT', 'LINEN', 'LOFTY', 'LOOSE', 'LUNAR',
  'MAPLE', 'MARCH', 'MASON', 'MATCH', 'MERGE',
  'MERIT', 'METAL', 'MIGHT', 'MILKY', 'MONTH',
  'MORAL', 'MOUSE', 'MOUTH', 'MUSIC', 'NOBLE',
  'NORTH', 'NOVEL', 'PAINT', 'PAPER', 'PATCH',
  'PENNY', 'PIECE', 'PILOT', 'PINCH', 'PLACE',
  'PLAID', 'PLAIN', 'PLATE', 'PLAZA', 'POEMS',
  'POINT', 'PORCH', 'POUCH', 'POUND', 'POWER',
  'PRESS', 'PRIDE', 'PRIME', 'PRINT', 'PRIZE',
  'PROOF', 'PROUD', 'PSALM', 'PULSE', 'PUPPY',
  'PURSE', 'QUEEN', 'QUEST', 'QUIET', 'QUILL',
  'QUILT', 'QUIRK', 'RAISE', 'RAPID', 'REACH',
  'REALM', 'REIGN', 'RELAX', 'RIGHT', 'ROAST',
  'ROUND', 'ROUTE', 'ROYAL', 'SAINT', 'SAVOR',
  'SCALE', 'SCENE', 'SCOUT', 'SHAWL', 'SHEAR',
  'SHEEP', 'SHELF', 'SHIFT', 'SHORT', 'SIGHT',
  'SILKY', 'SKILL', 'SLEEP', 'SLICE', 'SLIDE',
  'SMALL', 'SMART', 'SMELL', 'SMILE', 'SMITH',
  'SMOKE', 'SOLID', 'SOUND', 'SOUTH', 'SPACE',
  'SPARK', 'SPEAK', 'SPEAR', 'SPECK', 'SPICE',
  'SPILL', 'SPOKE', 'STAFF', 'STAGE', 'STAIN',
  'STAIR', 'STAKE', 'STALE', 'STAMP', 'STAND',
  'STARE', 'START', 'STASH', 'STEAD', 'STEAK',
  'STEAL', 'STEAM', 'STEEL', 'STEEP', 'STEER',
  'STICK', 'STIFF', 'STILL', 'STILT', 'STOCK',
  'STOIC', 'STOOL', 'STOOP', 'STORE', 'STORY',
  'STOUT', 'STOVE', 'STRAY', 'STUDY', 'STYLE',
  'SUNNY', 'SURGE', 'SWEET', 'SWEPT', 'SWINE',
  'SWORD', 'SYRUP', 'TABLE', 'TAPER', 'THICK',
  'THREE', 'TIGHT', 'TIMER', 'TOAST', 'TOKEN',
  'TOUCH', 'TOWER', 'TRACE', 'TRACK', 'TRADE',
  'TRAIN', 'TRAIT', 'TREAT', 'TREND', 'TRIAL',
  'TRIBE', 'TRICK', 'TRILL', 'TRULY', 'TRUNK',
  'TRUST', 'TRUTH', 'TWIST', 'UNION', 'UNITY',
  'UPPER', 'USUAL', 'VALOR', 'VALUE', 'VAULT',
  'VIGOR', 'VIVID', 'VOICE', 'WAKEN', 'WATCH',
  'WEARY', 'WEAVE', 'WEDGE', 'WHEEL', 'WHILE',
  'WHIRL', 'WHITE', 'WHOLE', 'WIELD', 'WOMAN',
  'WOMEN', 'WORLD', 'WORTH', 'WOUND', 'WOVEN',
  'WRIST', 'WROTE', 'YIELD',
] as const;

/** Set of all valid guesses for quick lookup (loaded lazily). */
let _validSet: ReadonlySet<string> | null = null;

export function getValidWordSet(): ReadonlySet<string> {
  if (!_validSet) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const VALID_GUESSES: string[] = require('./validGuesses').default;
    _validSet = new Set([...VALID_GUESSES, ...ANSWER_WORDS]);
  }
  return _validSet;
}
