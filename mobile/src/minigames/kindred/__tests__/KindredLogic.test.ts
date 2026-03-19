import { generatePuzzle, checkGroup, validateSolution, KindredPuzzle, GroupDefinition } from '../KindredLogic';
import { GROUP_PACKS } from '../groupPacks';

describe('generatePuzzle', () => {
  it('returns 16 words and 4 groups', () => {
    const puzzle = generatePuzzle();
    expect(puzzle.words).toHaveLength(16);
    expect(puzzle.groups).toHaveLength(4);
  });

  it('returns no duplicate words', () => {
    const puzzle = generatePuzzle();
    const unique = new Set(puzzle.words);
    expect(unique.size).toBe(16);
  });

  it('all words come from the groups in the puzzle', () => {
    const puzzle = generatePuzzle();
    const groupWords = new Set(puzzle.groups.flatMap((g: GroupDefinition) => g.words));
    for (const word of puzzle.words) {
      expect(groupWords.has(word)).toBe(true);
    }
  });

  it('selects a pack from the full pool', () => {
    for (let i = 0; i < 20; i++) {
      const puzzle = generatePuzzle();
      const matchingPack = GROUP_PACKS.find(
        (p) =>
          p.groups[0].label === puzzle.groups[0].label &&
          p.groups[1].label === puzzle.groups[1].label,
      );
      expect(matchingPack).toBeDefined();
    }
  });

  it('shuffles words (not always in group order)', () => {
    let foundShuffled = false;
    for (let i = 0; i < 30; i++) {
      const puzzle = generatePuzzle();
      const inOrder = puzzle.groups.flatMap((g: GroupDefinition) => g.words);
      if (JSON.stringify(puzzle.words) !== JSON.stringify(inOrder)) {
        foundShuffled = true;
        break;
      }
    }
    expect(foundShuffled).toBe(true);
  });
});

describe('checkGroup', () => {
  const groups: [GroupDefinition, GroupDefinition, GroupDefinition, GroupDefinition] = [
    { label: 'Things that drip', words: ['SAP', 'DEW', 'HONEY', 'WAX'] },
    { label: 'Autumn leaf colors', words: ['AMBER', 'RUSSET', 'CRIMSON', 'OCHRE'] },
    { label: 'Nocturnal garden visitors', words: ['OWL', 'BADGER', 'MOTH', 'FOX'] },
    { label: 'Potting shed tools', words: ['TROWEL', 'HOE', 'RAKE', 'DIBBER'] },
  ];

  it('identifies a correct group', () => {
    const result = checkGroup(['WAX', 'HONEY', 'SAP', 'DEW'], groups);
    expect(result.correct).toBe(true);
    expect(result.groupIndex).toBe(0);
    expect(result.label).toBe('Things that drip');
  });

  it('identifies correct group regardless of order', () => {
    const result = checkGroup(['OCHRE', 'AMBER', 'CRIMSON', 'RUSSET'], groups);
    expect(result.correct).toBe(true);
    expect(result.groupIndex).toBe(1);
    expect(result.label).toBe('Autumn leaf colors');
  });

  it('rejects a wrong group (all from different groups)', () => {
    const result = checkGroup(['SAP', 'AMBER', 'OWL', 'TROWEL'], groups);
    expect(result.correct).toBe(false);
    expect(result.groupIndex).toBeNull();
    expect(result.label).toBeNull();
  });

  it('rejects a partial match (3 from one group + 1 intruder)', () => {
    const result = checkGroup(['SAP', 'DEW', 'HONEY', 'OWL'], groups);
    expect(result.correct).toBe(false);
    expect(result.groupIndex).toBeNull();
    expect(result.label).toBeNull();
  });

  it('rejects selection with fewer than 4 words', () => {
    const result = checkGroup(['SAP', 'DEW'], groups);
    expect(result.correct).toBe(false);
    expect(result.groupIndex).toBeNull();
  });

  it('rejects selection with more than 4 words', () => {
    const result = checkGroup(['SAP', 'DEW', 'HONEY', 'WAX', 'AMBER'], groups);
    expect(result.correct).toBe(false);
  });

  it('handles words from two different groups (2+2 split)', () => {
    const result = checkGroup(['SAP', 'DEW', 'OWL', 'BADGER'], groups);
    expect(result.correct).toBe(false);
    expect(result.groupIndex).toBeNull();
  });
});

describe('validateSolution', () => {
  const puzzle: KindredPuzzle = {
    words: [
      'SAP', 'DEW', 'HONEY', 'WAX',
      'AMBER', 'RUSSET', 'CRIMSON', 'OCHRE',
      'OWL', 'BADGER', 'MOTH', 'FOX',
      'TROWEL', 'HOE', 'RAKE', 'DIBBER',
    ],
    groups: [
      { label: 'Things that drip', words: ['SAP', 'DEW', 'HONEY', 'WAX'] },
      { label: 'Autumn leaf colors', words: ['AMBER', 'RUSSET', 'CRIMSON', 'OCHRE'] },
      { label: 'Nocturnal garden visitors', words: ['OWL', 'BADGER', 'MOTH', 'FOX'] },
      { label: 'Potting shed tools', words: ['TROWEL', 'HOE', 'RAKE', 'DIBBER'] },
    ],
  };

  it('returns solved: true when all 4 groups are found', () => {
    const result = validateSolution(puzzle, {
      groupsFound: [
        ['SAP', 'DEW', 'HONEY', 'WAX'],
        ['AMBER', 'RUSSET', 'CRIMSON', 'OCHRE'],
        ['OWL', 'BADGER', 'MOTH', 'FOX'],
        ['TROWEL', 'HOE', 'RAKE', 'DIBBER'],
      ],
    });
    expect(result.solved).toBe(true);
  });

  it('returns solved: true when groups are in different order', () => {
    const result = validateSolution(puzzle, {
      groupsFound: [
        ['TROWEL', 'HOE', 'RAKE', 'DIBBER'],
        ['OWL', 'BADGER', 'MOTH', 'FOX'],
        ['SAP', 'DEW', 'HONEY', 'WAX'],
        ['OCHRE', 'AMBER', 'CRIMSON', 'RUSSET'],
      ],
    });
    expect(result.solved).toBe(true);
  });

  it('returns solved: false when only some groups found', () => {
    const result = validateSolution(puzzle, {
      groupsFound: [
        ['SAP', 'DEW', 'HONEY', 'WAX'],
        ['AMBER', 'RUSSET', 'CRIMSON', 'OCHRE'],
      ],
    });
    expect(result.solved).toBe(false);
  });

  it('returns solved: false for empty submission', () => {
    const result = validateSolution(puzzle, { groupsFound: [] });
    expect(result.solved).toBe(false);
  });

  it('returns solved: false when a group has wrong words', () => {
    const result = validateSolution(puzzle, {
      groupsFound: [
        ['SAP', 'DEW', 'HONEY', 'AMBER'], // wrong
        ['WAX', 'RUSSET', 'CRIMSON', 'OCHRE'], // wrong
        ['OWL', 'BADGER', 'MOTH', 'FOX'],
        ['TROWEL', 'HOE', 'RAKE', 'DIBBER'],
      ],
    });
    expect(result.solved).toBe(false);
  });
});

describe('GROUP_PACKS integrity', () => {
  it('has at least 20 packs', () => {
    expect(GROUP_PACKS.length).toBeGreaterThanOrEqual(20);
  });

  it('every pack has exactly 4 groups of 4 words', () => {
    for (const pack of GROUP_PACKS) {
      expect(pack.groups).toHaveLength(4);
      for (const group of pack.groups) {
        expect(group.words).toHaveLength(4);
        expect(typeof group.label).toBe('string');
        expect(group.label.length).toBeGreaterThan(0);
      }
    }
  });

  it('no duplicate words within any single pack', () => {
    for (const pack of GROUP_PACKS) {
      const allWords = pack.groups.flatMap((g: GroupDefinition) => g.words);
      const unique = new Set(allWords);
      expect(unique.size).toBe(16);
    }
  });
});
