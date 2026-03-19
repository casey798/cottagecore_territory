export const BEAD_COLORS = ['red', 'gold', 'green', 'brown'] as const;
export type BeadColor = (typeof BEAD_COLORS)[number];

export const BEAD_HEX: Record<BeadColor, string> = {
  red: '#C0392B',
  gold: '#D4A843',
  green: '#27AE60',
  brown: '#8B5E3C',
};

export const BEAD_HIGHLIGHT: Record<BeadColor, string> = {
  red: '#E74C3C',
  gold: '#F0D070',
  green: '#58D68D',
  brown: '#B07D56',
};

export interface JarData {
  beads: BeadColor[];
  isBuffer: boolean;
}

export type Jars = JarData[];

const JAR_CAPACITY = 4;
const NUM_TARGET_JARS = 4;
const NUM_BUFFER_JARS = 1;
const SCRAMBLE_MOVES = 40;

export const NUM_JARS = NUM_TARGET_JARS + NUM_BUFFER_JARS;

function deepCopyJars(jars: Jars): Jars {
  return jars.map((jar) => ({ beads: [...jar.beads], isBuffer: jar.isBuffer }));
}

export function generatePuzzle(): Jars {
  for (let attempt = 0; attempt < 100; attempt++) {
    const jars: Jars = BEAD_COLORS.map((color) => ({
      beads: Array.from({ length: JAR_CAPACITY }, () => color),
      isBuffer: false,
    }));
    for (let i = 0; i < NUM_BUFFER_JARS; i++) {
      jars.push({ beads: [], isBuffer: true });
    }

    let state = deepCopyJars(jars);

    for (let move = 0; move < SCRAMBLE_MOVES; move++) {
      const nonEmpty = state
        .map((jar, i) => ({ jar, i }))
        .filter(({ jar }) => jar.beads.length > 0);
      if (nonEmpty.length === 0) break;

      const source = nonEmpty[Math.floor(Math.random() * nonEmpty.length)];
      const destinations = state
        .map((jar, i) => ({ jar, i }))
        .filter(({ jar, i }) => i !== source.i && jar.beads.length < JAR_CAPACITY);
      if (destinations.length === 0) continue;

      const dest = destinations[Math.floor(Math.random() * destinations.length)];
      const bead = state[source.i].beads[state[source.i].beads.length - 1];
      state[source.i].beads = state[source.i].beads.slice(0, -1);
      state[dest.i].beads = [...state[dest.i].beads, bead];
    }

    if (!checkWin(state)) {
      return state;
    }
  }

  throw new Error('Failed to generate valid Leaf Sort puzzle');
}

// Win condition: every TARGET jar (isBuffer === false) must contain exactly
// JAR_CAPACITY (4) beads, all of the same color. Buffer jars are ignored.
//
// Solved-state trace (5 jars: 4 target + 1 buffer):
//   jar 0 (target): ['red','red','red','red']          -> 4 beads, all red    -> PASS
//   jar 1 (target): ['gold','gold','gold','gold']      -> 4 beads, all gold   -> PASS
//   jar 2 (target): ['green','green','green','green']  -> 4 beads, all green  -> PASS
//   jar 3 (target): ['brown','brown','brown','brown']  -> 4 beads, all brown  -> PASS
//   jar 4 (buffer): []                                 -> skipped (isBuffer)
//   All 4 targets pass -> return true
//
// Mid-game with buffer holding leftovers:
//   jar 0 (target): ['red','red','red','red']          -> PASS
//   jar 1 (target): ['gold','gold','gold','gold']      -> PASS
//   jar 2 (target): ['green','green','green','green']  -> PASS
//   jar 3 (target): ['brown','brown','brown','brown']  -> PASS
//   jar 4 (buffer): ['red']                            -> skipped (isBuffer)
//   All 4 targets pass -> return true (buffer irrelevant)
//
// Incomplete state:
//   jar 0 (target): ['red','red','red']                -> 3 beads, not 4 -> FAIL
//   -> return false immediately
export function checkWin(jars: Jars): boolean {
  for (const jar of jars) {
    if (jar.isBuffer) continue;
    if (jar.beads.length !== JAR_CAPACITY) return false;
    const color = jar.beads[0];
    for (let i = 1; i < jar.beads.length; i++) {
      if (jar.beads[i] !== color) return false;
    }
  }
  return true;
}

export function canMove(jars: Jars, fromIndex: number, toIndex: number): boolean {
  if (fromIndex === toIndex) return false;
  const source = jars[fromIndex];
  const dest = jars[toIndex];
  if (source.beads.length === 0) return false;
  if (dest.beads.length >= JAR_CAPACITY) return false;
  if (dest.beads.length === 0) return true;
  return dest.beads[dest.beads.length - 1] === source.beads[source.beads.length - 1];
}

export function applyMove(jars: Jars, fromIndex: number, toIndex: number): Jars {
  const newJars = deepCopyJars(jars);
  const bead = newJars[fromIndex].beads.pop()!;
  newJars[toIndex].beads.push(bead);
  return newJars;
}
