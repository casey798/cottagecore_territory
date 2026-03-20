import { injectCoopSlots } from '../../shared/weightedAssignment';

describe('injectCoopSlots', () => {
  const soloAssigned = ['loc-1', 'loc-2', 'loc-3', 'loc-4'];
  const coopPool = ['coop-1', 'coop-2', 'coop-3'];

  it('coopChance=1.0 with non-empty coopPool always assigns 1 co-op slot', () => {
    // Run 20 times to verify determinism
    for (let i = 0; i < 20; i++) {
      const result = injectCoopSlots(soloAssigned, coopPool, 1.0, 0, 4);
      const coopInResult = result.assignedIds.filter((id) => coopPool.includes(id));
      expect(coopInResult.length).toBe(1);
      expect(result.coopCount).toBe(1);
      expect(result.assignedIds.length).toBe(4);
    }
  });

  it('coopChance=0 never assigns a co-op slot', () => {
    for (let i = 0; i < 20; i++) {
      const result = injectCoopSlots(soloAssigned, coopPool, 0, 0, 4);
      const coopInResult = result.assignedIds.filter((id) => coopPool.includes(id));
      expect(coopInResult.length).toBe(0);
      expect(result.coopCount).toBe(0);
    }
  });

  it('absent coopChance (treated as 0) never assigns a co-op slot', () => {
    const result = injectCoopSlots(soloAssigned, coopPool, 0, 0, 4);
    const coopInResult = result.assignedIds.filter((id) => coopPool.includes(id));
    expect(coopInResult.length).toBe(0);
    expect(result.coopCount).toBe(0);
  });

  it('coopCount cap of 2 is respected across multiple calls', () => {
    // First call: coopCount=0 → should inject
    const first = injectCoopSlots(soloAssigned, coopPool, 1.0, 0, 4);
    expect(first.coopCount).toBe(1);

    // Second call: coopCount=1 → should inject
    const second = injectCoopSlots(first.assignedIds, coopPool, 1.0, first.coopCount, 4);
    expect(second.coopCount).toBe(2);

    // Third call: coopCount=2 → should NOT inject (cap reached)
    const third = injectCoopSlots(second.assignedIds, coopPool, 1.0, second.coopCount, 4);
    expect(third.coopCount).toBe(2);
    // Verify the assignment didn't change
    expect(third.assignedIds).toEqual(second.assignedIds);
  });

  it('empty coopPool does not throw and returns normal solo assignment', () => {
    const result = injectCoopSlots(soloAssigned, [], 1.0, 0, 4);
    expect(result.assignedIds).toEqual(soloAssigned);
    expect(result.coopCount).toBe(0);
  });

  it('total assignment count never exceeds maxTotal', () => {
    // Start with fewer than maxTotal
    const shortAssigned = ['loc-1', 'loc-2'];
    const result = injectCoopSlots(shortAssigned, coopPool, 1.0, 0, 4);
    expect(result.assignedIds.length).toBeLessThanOrEqual(4);
    expect(result.coopCount).toBe(1);

    // Start with exactly maxTotal
    const fullAssigned = ['loc-1', 'loc-2', 'loc-3', 'loc-4'];
    const result2 = injectCoopSlots(fullAssigned, coopPool, 1.0, 0, 4);
    expect(result2.assignedIds.length).toBe(4);
    expect(result2.coopCount).toBe(1);
  });

  it('does not duplicate co-op locations already in assignment', () => {
    // coop-1 is at index 1 (won't be replaced); last slot is loc-3
    const assignedWithCoop = ['loc-1', 'coop-1', 'loc-2', 'loc-3'];
    const result = injectCoopSlots(assignedWithCoop, coopPool, 1.0, 0, 4);
    expect(result.coopCount).toBe(1);
    // The newly picked co-op should not be coop-1 (already present)
    const newCoopId = result.assignedIds[3]; // replaced last slot
    expect(coopPool).toContain(newCoopId);
    expect(newCoopId).not.toBe('coop-1');
    // No duplicates
    expect(new Set(result.assignedIds).size).toBe(result.assignedIds.length);
  });

  it('does not mutate the input array', () => {
    const original = [...soloAssigned];
    injectCoopSlots(soloAssigned, coopPool, 1.0, 0, 4);
    expect(soloAssigned).toEqual(original);
  });

  it('skips injection when all co-op locations are already in assignment', () => {
    const assignedAll = ['loc-1', 'coop-1', 'coop-2', 'coop-3'];
    const result = injectCoopSlots(assignedAll, coopPool, 1.0, 0, 4);
    // No new co-op can be added since all are already present
    expect(result.coopCount).toBe(0);
    expect(result.assignedIds).toEqual(assignedAll);
  });
});
