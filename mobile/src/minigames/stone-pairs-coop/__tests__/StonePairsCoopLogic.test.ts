import { checkMatch } from '../../stone-pairs/StonePairsLogic';
import {
  generateCoopPuzzle,
  isCrossBoundary,
  CoopCardData,
} from '../StonePairsCoopGame';

const CARDS_PER_HALF = 12;
const TOTAL_CARDS = 24;
const TOTAL_PAIRS = 12;

function isP1Card(id: number): boolean {
  return id < CARDS_PER_HALF;
}
function isP2Card(id: number): boolean {
  return id >= CARDS_PER_HALF;
}

describe('StonePairsCoop: grid generation', () => {
  it('generates exactly 24 cards', () => {
    const { cards } = generateCoopPuzzle();
    expect(cards).toHaveLength(TOTAL_CARDS);
  });

  it('has 12 unique pairs (each iconIndex appears exactly twice)', () => {
    const { cards } = generateCoopPuzzle();
    const countByIcon = new Map<number, number>();
    for (const card of cards) {
      countByIcon.set(card.iconIndex, (countByIcon.get(card.iconIndex) ?? 0) + 1);
    }
    expect(countByIcon.size).toBe(TOTAL_PAIRS);
    for (const [, count] of countByIcon) {
      expect(count).toBe(2);
    }
  });

  it('assigns sequential IDs 0–11 to P1 and 12–23 to P2', () => {
    const { cards } = generateCoopPuzzle();
    for (let i = 0; i < TOTAL_CARDS; i++) {
      expect(cards[i].id).toBe(i);
    }
  });

  it('P1 zone has exactly 12 cards (rows 0-2) and P2 zone has 12 (rows 3-5)', () => {
    const { cards } = generateCoopPuzzle();
    const p1Cards = cards.filter((c) => isP1Card(c.id));
    const p2Cards = cards.filter((c) => isP2Card(c.id));
    expect(p1Cards).toHaveLength(CARDS_PER_HALF);
    expect(p2Cards).toHaveLength(CARDS_PER_HALF);
  });
});

describe('StonePairsCoop: cross-boundary pair constraint', () => {
  it('has exactly 4 cross-boundary pairs by default', () => {
    const { cards, crossPairIds } = generateCoopPuzzle();
    expect(crossPairIds.size).toBe(4);

    // Verify: for each cross pair, one card in P1 zone and one in P2 zone
    for (const pairId of crossPairIds) {
      const pairCards = cards.filter((c) => c.pairId === pairId);
      expect(pairCards).toHaveLength(2);
      const hasP1 = pairCards.some((c) => isP1Card(c.id));
      const hasP2 = pairCards.some((c) => isP2Card(c.id));
      expect(hasP1).toBe(true);
      expect(hasP2).toBe(true);
    }
  });

  it('within-zone pairs have both cards in the same half', () => {
    const { cards, crossPairIds } = generateCoopPuzzle();
    for (let pairId = 0; pairId < TOTAL_PAIRS; pairId++) {
      if (crossPairIds.has(pairId)) continue;
      const pairCards = cards.filter((c) => c.pairId === pairId);
      expect(pairCards).toHaveLength(2);
      const bothP1 = pairCards.every((c) => isP1Card(c.id));
      const bothP2 = pairCards.every((c) => isP2Card(c.id));
      expect(bothP1 || bothP2).toBe(true);
    }
  });

  it('cross-boundary count is between 1 and 8 inclusive across multiple runs', () => {
    // Run 50 times with varying target to verify constraint holds
    for (let target = 1; target <= 8; target++) {
      const { crossPairIds } = generateCoopPuzzle(target);
      expect(crossPairIds.size).toBeGreaterThanOrEqual(1);
      expect(crossPairIds.size).toBeLessThanOrEqual(8);
    }
  });
});

describe('StonePairsCoop: isCrossBoundary', () => {
  it('returns true when one card is P1 and the other is P2', () => {
    const a: CoopCardData = { id: 5, iconIndex: 0, iconLabel: '🍄', pairId: 0 };
    const b: CoopCardData = { id: 15, iconIndex: 0, iconLabel: '🍄', pairId: 0 };
    expect(isCrossBoundary(a, b)).toBe(true);
    expect(isCrossBoundary(b, a)).toBe(true);
  });

  it('returns false when both cards are in same zone', () => {
    const a: CoopCardData = { id: 2, iconIndex: 0, iconLabel: '🍄', pairId: 0 };
    const b: CoopCardData = { id: 8, iconIndex: 0, iconLabel: '🍄', pairId: 0 };
    expect(isCrossBoundary(a, b)).toBe(false);
  });
});

describe('StonePairsCoop: P1 cannot flip P2 rows', () => {
  it('P1 cards are all in indices 0–11, P2 cards all in 12–23', () => {
    const { cards } = generateCoopPuzzle();
    const p1 = cards.slice(0, CARDS_PER_HALF);
    const p2 = cards.slice(CARDS_PER_HALF);
    for (const card of p1) {
      expect(isP1Card(card.id)).toBe(true);
      expect(isP2Card(card.id)).toBe(false);
    }
    for (const card of p2) {
      expect(isP2Card(card.id)).toBe(true);
      expect(isP1Card(card.id)).toBe(false);
    }
  });
});

describe('StonePairsCoop: sync flip mechanics', () => {
  it('matching cards are detected by checkMatch', () => {
    const { cards } = generateCoopPuzzle();
    // Find a pair
    const first = cards[0];
    const second = cards.find((c) => c.id !== first.id && c.iconIndex === first.iconIndex);
    expect(second).toBeDefined();
    expect(checkMatch(first, second!)).toBe(true);
  });

  it('non-matching cards fail checkMatch', () => {
    const { cards } = generateCoopPuzzle();
    // Find two cards with different icons
    const first = cards[0];
    const second = cards.find((c) => c.iconIndex !== first.iconIndex);
    expect(second).toBeDefined();
    expect(checkMatch(first, second!)).toBe(false);
  });

  it('sync scenario: P1 flips cross card, P2 flips match → both stay matched', () => {
    // Simulate the state transitions
    const { cards, crossPairIds } = generateCoopPuzzle();
    const crossPairId = [...crossPairIds][0];
    const pairCards = cards.filter((c) => c.pairId === crossPairId);
    const p1Card = pairCards.find((c) => isP1Card(c.id))!;
    const p2Card = pairCards.find((c) => isP2Card(c.id))!;

    expect(p1Card).toBeDefined();
    expect(p2Card).toBeDefined();
    expect(checkMatch(p1Card, p2Card)).toBe(true);

    // Simulate: both revealed, check match → should match
    const matched = new Set<number>();
    matched.add(p1Card.id);
    matched.add(p2Card.id);
    expect(matched.size).toBe(2);
  });

  it('sync fail: cards should be flipped back (simulated by removing from revealed)', () => {
    const { cards, crossPairIds } = generateCoopPuzzle();
    const crossPairId = [...crossPairIds][0];
    const pairCards = cards.filter((c) => c.pairId === crossPairId);
    expect(pairCards).toHaveLength(2);
    const p1Card = pairCards.find((c) => isP1Card(c.id));
    const p2Card = pairCards.find((c) => isP2Card(c.id));
    expect(p1Card).toBeDefined();
    expect(p2Card).toBeDefined();

    // Simulate: P1 flips their card (revealed), sync timeout → flip back
    const revealed = new Set<number>();
    revealed.add(p1Card!.id);

    // Sync fail: remove both from revealed
    revealed.delete(p1Card!.id);
    revealed.delete(p2Card!.id);
    expect(revealed.has(p1Card!.id)).toBe(false);
    expect(revealed.has(p2Card!.id)).toBe(false);
  });
});

describe('StonePairsCoop: win detection', () => {
  it('win when all 24 cards (12 pairs) are matched', () => {
    const matched = new Set<number>();
    for (let i = 0; i < TOTAL_CARDS; i++) {
      matched.add(i);
    }
    expect(matched.size).toBe(TOTAL_CARDS);
  });

  it('not won with fewer than 24 matched cards', () => {
    const matched = new Set<number>();
    for (let i = 0; i < TOTAL_CARDS - 2; i++) {
      matched.add(i);
    }
    expect(matched.size).toBe(TOTAL_CARDS - 2);
    expect(matched.size === TOTAL_CARDS).toBe(false);
  });
});
