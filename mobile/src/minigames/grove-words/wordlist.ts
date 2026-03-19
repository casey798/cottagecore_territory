/**
 * Grove Words — answer pool and guess validation.
 *
 * ANSWER_WORDS: curated list of common, everyday words used as daily answers.
 * All 5-letter, uppercase.
 *
 * Guess validation uses VALID_GUESSES from validGuesses.ts (14,855 words).
 */

export const ANSWER_WORDS: readonly string[] = [
  'ABOUT', 'ABOVE', 'ADMIT', 'ADOPT', 'ADULT', 'AFTER', 'AGAIN', 'AGENT', 'AGREE', 'AHEAD',
  'ALARM', 'ALBUM', 'ALERT', 'ALIKE', 'ALIVE', 'ALLEY', 'ALLOW', 'ALONE', 'ALONG', 'ALTER',
  'ANGEL', 'ANGER', 'ANGLE', 'ANKLE', 'ANNOY', 'APART', 'APPLE', 'APPLY', 'ARROW', 'AVOID',
  'AWAKE', 'AWARD', 'AWARE', 'BADGE', 'BAKER', 'BASIC', 'BEACH', 'BEARD', 'BEAST', 'BEGAN',
  'BEGIN', 'BELOW', 'BENCH', 'BERRY', 'BIRTH', 'BLACK', 'BLADE', 'BLAME', 'BLANK', 'BLAST',
  'BLAZE', 'BLEND', 'BLESS', 'BLIND', 'BLOCK', 'BLOOD', 'BOARD', 'BONUS', 'BOOST', 'BOUND',
  'BRAIN', 'BRAND', 'BRAVE', 'BREAK', 'BREED', 'BRICK', 'BRIDE', 'BRIEF', 'BRING', 'BROAD',
  'BROKE', 'BROOK', 'BROWN', 'BUILD', 'BUILT', 'BUNCH', 'BURST', 'CANDY', 'CARRY', 'CAUSE',
  'CHAIN', 'CHAIR', 'CHALK', 'CHEAP', 'CHEAT', 'CHECK', 'CHEEK', 'CHEER', 'CHEST', 'CHIEF',
  'CHILD', 'CHILL', 'CIVIC', 'CLAIM', 'CLASS', 'CLEAN', 'CLEAR', 'CLIMB', 'CLOCK', 'CLOSE',
  'CLOUD', 'COACH', 'COAST', 'COLOR', 'COULD', 'COUNT', 'COURT', 'COVER', 'CRACK', 'CRANE',
  'CRASH', 'CRAZY', 'CREAM', 'CREEK', 'CRIME', 'CRISP', 'CROSS', 'CROWD', 'CROWN', 'CRUSH',
  'CURVE', 'CYCLE', 'DAILY', 'DANCE', 'DAISY', 'DEBUT', 'DECAY', 'DELAY', 'DELTA', 'DENSE',
  'DEPTH', 'DEVIL', 'DIRTY', 'DODGE', 'DOUBT', 'DOUGH', 'DRAFT', 'DRAIN', 'DRAMA', 'DRANK',
  'DRAPE', 'DREAM', 'DRILL', 'DRINK', 'DRIVE', 'DROVE', 'DROWN', 'EAGER', 'EAGLE', 'EARLY',
  'EARTH', 'EIGHT', 'ELECT', 'ELITE', 'EMBER', 'EMPTY', 'ENEMY', 'ENJOY', 'ENTER', 'ENTRY',
  'EQUAL', 'ERROR', 'ESSAY', 'ETHIC', 'EVENT', 'EXACT', 'EXIST', 'EXTRA', 'FABLE', 'FAITH',
  'FALSE', 'FANCY', 'FATAL', 'FAULT', 'FEAST', 'FETCH', 'FIELD', 'FIFTY', 'FIGHT', 'FINAL',
  'FIRST', 'FIXED', 'FLAME', 'FLARE', 'FLASH', 'FLOAT', 'FLOOD', 'FLOOR', 'FLOUR', 'FOCUS',
  'FORCE', 'FORGE', 'FOUND', 'FRAME', 'FRANK', 'FRAUD', 'FRESH', 'FRONT', 'FROST', 'FRUIT',
  'FUNNY', 'FUZZY', 'GIANT', 'GIVEN', 'GLASS', 'GLOOM', 'GLORY', 'GLOVE', 'GOING', 'GRACE',
  'GRADE', 'GRAIN', 'GRAND', 'GRANT', 'GRAPE', 'GRASP', 'GRASS', 'GRAVE', 'GREAT', 'GREEN',
  'GREET', 'GRIEF', 'GRIND', 'GROAN', 'GROSS', 'GROUP', 'GROVE', 'GROWN', 'GUARD', 'GUESS',
  'GUEST', 'GUIDE', 'GUILT', 'GUSTO', 'HABIT', 'HAPPY', 'HARSH', 'HAVEN', 'HEAVY', 'HEDGE',
  'HENCE', 'HERBS', 'HERON', 'HOBBY', 'HOLLY', 'HONOR', 'HORSE', 'HOTEL', 'HOUSE', 'HUMAN',
  'HUMOR', 'HURRY', 'HYPER', 'IDEAL', 'IMAGE', 'IMPLY', 'INDEX', 'INNER', 'INPUT', 'IRONY',
  'ISSUE', 'JELLY', 'JOKER', 'JUDGE', 'JUICE', 'JUICY', 'JUMBO', 'JUMPY', 'LEGAL', 'LEVEL',
  'LIGHT', 'LIMIT', 'LINEN', 'LOCAL', 'LOGIC', 'LOTUS', 'LOVER', 'LOWER', 'LUCKY', 'LYRIC',
  'MAGIC', 'MAJOR', 'MAKER', 'MAPLE', 'MARCH', 'MATCH', 'MAYOR', 'MEDAL', 'MERCY', 'MERIT',
  'METAL', 'MIGHT', 'MINOR', 'MINUS', 'MIXED', 'MODEL', 'MONEY', 'MONTH', 'MORAL', 'MOTOR',
  'MOUNT', 'MOUSE', 'MOVIE', 'MUSIC', 'NAIVE', 'NERVE', 'NEVER', 'NIGHT', 'NOBLE', 'NOISE',
  'NORTH', 'NOTED', 'NOVEL', 'NURSE', 'OCEAN', 'OFFER', 'OFTEN', 'OLIVE', 'ONSET', 'OPERA',
  'ORDER', 'OTHER', 'OUTER', 'OWNER', 'PAINT', 'PANIC', 'PAPER', 'PARTY', 'PATCH', 'PAUSE',
  'PEACE', 'PEACH', 'PEARL', 'PENNY', 'PHASE', 'PHONE', 'PHOTO', 'PILOT', 'PLACE', 'PLAIN',
  'PLANE', 'PLANT', 'PLATE', 'POINT', 'POKER', 'POPPY', 'POWER', 'PRESS', 'PRICE', 'PRIDE',
  'PRIME', 'PRINT', 'PRIZE', 'PROBE', 'PROOF', 'PROSE', 'PROUD', 'PROVE', 'PUNCH', 'PUPIL',
  'PURSE', 'QUEEN', 'QUERY', 'QUEST', 'QUICK', 'QUIET', 'QUOTE', 'RADAR', 'RADIO', 'RAISE',
  'RALLY', 'RANCH', 'RANGE', 'RAPID', 'RATIO', 'REACH', 'READY', 'REALM', 'REBEL', 'REFER',
  'REIGN', 'RELAX', 'RELAY', 'REMIX', 'REPAY', 'RESET', 'RISKY', 'RIVAL', 'RIVER', 'ROBIN',
  'ROBOT', 'ROCKY', 'ROUGH', 'ROUND', 'ROUTE', 'ROYAL', 'RULER', 'RURAL', 'RUSTY', 'SADLY',
  'SAINT', 'SALAD', 'SAUCE', 'SCARY', 'SCENE', 'SCORE', 'SCOUT', 'SEIZE', 'SENSE', 'SERVE',
  'SEVEN', 'SHAKE', 'SHAME', 'SHAPE', 'SHARE', 'SHARK', 'SHARP', 'SHELF', 'SHELL', 'SHIFT',
  'SHOOT', 'SHORT', 'SHOUT', 'SIGHT', 'SILLY', 'SINCE', 'SIXTH', 'SKILL', 'SLASH', 'SLATE',
  'SLAVE', 'SLEEP', 'SLICE', 'SLIDE', 'SLOPE', 'SLUMP', 'SMALL', 'SMART', 'SMILE', 'SMOKE',
  'SNAIL', 'SOLAR', 'SOLID', 'SOLVE', 'SORRY', 'SOUND', 'SPACE', 'SPARE', 'SPARK', 'SPAWN',
  'SPEAK', 'SPEED', 'SPEND', 'SPICE', 'SPILL', 'SPINE', 'SPOKE', 'SPOON', 'SPORT', 'SPRAY',
  'SQUAD', 'STACK', 'STAFF', 'STAGE', 'STAIN', 'STARE', 'STARK', 'START', 'STATE', 'STEAM',
  'STEEL', 'STEEP', 'STEER', 'STICK', 'STIFF', 'STILL', 'STOCK', 'STONE', 'STOOD', 'STORE',
  'STORM', 'STORY', 'STOVE', 'STRAP', 'STRAW', 'STRAY', 'STRIP', 'STUCK', 'STUDY', 'STUFF',
  'STYLE', 'SUGAR', 'SUNNY', 'SUPER', 'SURGE', 'SWEET', 'SWIFT', 'SWORD', 'TABLE', 'TASTE',
  'TEACH', 'TEETH', 'TENSE', 'TENTH', 'THANK', 'THEME', 'THICK', 'THING', 'THINK', 'THIRD',
  'THORN', 'THREE', 'THREW', 'THROW', 'TIGER', 'TIGHT', 'TIMER', 'TIRED', 'TITLE', 'TOAST',
  'TODAY', 'TOKEN', 'TOXIC', 'TRACE', 'TRACK', 'TRADE', 'TRAIL', 'TRAIN', 'TRAIT', 'TRASH',
  'TREAT', 'TREND', 'TRIAL', 'TRIBE', 'TRICK', 'TRIED', 'TROOP', 'TRULY', 'TRUNK', 'TRUST',
  'TRUTH', 'TWIST', 'ULTRA', 'UNDER', 'UNION', 'UNITY', 'UNTIL', 'UPPER', 'UPSET', 'UTTER',
  'VALID', 'VALUE', 'VALVE', 'VAULT', 'VENUE', 'VERSE', 'VIDEO', 'VIGOR', 'VIRAL', 'VISIT',
  'VITAL', 'VIVID', 'VOCAL', 'VOICE', 'VOTER', 'WAGER', 'WASTE', 'WATCH', 'WATER', 'WEIRD',
  'WHEAT', 'WHERE', 'WHILE', 'WHITE', 'WHOLE', 'WITCH', 'WOMAN', 'WOMEN', 'WORLD', 'WORRY',
  'WORSE', 'WORST', 'WORTH', 'WOULD', 'WOUND', 'WRITE', 'WRONG', 'WROTE', 'YACHT', 'YEARN',
  'YIELD', 'YOUNG', 'YOUTH', 'YUMMY', 'ZEBRA', 'ZESTY', 'ZIPPY',
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
