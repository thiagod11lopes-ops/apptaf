import { describe, expect, it } from 'vitest';
import {
  decideSyncedLocalOnlyAbsence,
  massSyntheticPruneThreshold,
  shouldAllowCloudAbsencePrune,
  stripMassSyntheticPrune,
} from '../../src/offline-first/sync/cloudAbsencePrune';

describe('shouldAllowCloudAbsencePrune', () => {
  it('chefe + full + snapshot confiável → permite poda', () => {
    expect(
      shouldAllowCloudAbsencePrune({
        fetchMode: 'full',
        trustworthyForPrune: true,
        isAuthorizedMember: false,
      }),
    ).toBe(true);
  });

  it('membro autorizado nunca poda por ausência (mesmo full confiável)', () => {
    expect(
      shouldAllowCloudAbsencePrune({
        fetchMode: 'full',
        trustworthyForPrune: true,
        isAuthorizedMember: true,
      }),
    ).toBe(false);
  });

  it('decrypt parcial (trustworthy=false) → não poda', () => {
    expect(
      shouldAllowCloudAbsencePrune({
        fetchMode: 'full',
        trustworthyForPrune: false,
        isAuthorizedMember: false,
      }),
    ).toBe(false);
  });

  it('fetch incremental → não poda', () => {
    expect(
      shouldAllowCloudAbsencePrune({
        fetchMode: 'incremental',
        trustworthyForPrune: true,
        isAuthorizedMember: false,
      }),
    ).toBe(false);
  });
});

describe('decideSyncedLocalOnlyAbsence', () => {
  it('allow=true → prune (tombstone sintético)', () => {
    expect(decideSyncedLocalOnlyAbsence(true)).toBe('prune');
  });

  it('allow=false → preserve (evita loop baixar→apagar→baixar)', () => {
    expect(decideSyncedLocalOnlyAbsence(false)).toBe('preserve');
  });
});

describe('massSyntheticPruneThreshold / stripMassSyntheticPrune', () => {
  it('limiar = max(50, 5% do local)', () => {
    expect(massSyntheticPruneThreshold(100)).toBe(50);
    expect(massSyntheticPruneThreshold(2000)).toBe(100);
    expect(massSyntheticPruneThreshold(0)).toBe(50);
  });

  it('abaixo do limiar: mantém podas sintéticas', () => {
    const plan = Array.from({ length: 10 }, (_, i) => ({
      collection: 'cadastros',
      id: `c${i}`,
      action: 'download' as const,
      remote: { syntheticCloudAbsence: true },
    }));
    const result = stripMassSyntheticPrune(plan, 2000);
    expect(result.stripped).toBe(0);
    expect(result.plan).toHaveLength(10);
  });

  it('acima do limiar: bloqueia lote inteiro de podas sintéticas', () => {
    const plan = Array.from({ length: 120 }, (_, i) => ({
      collection: 'cadastros',
      id: `c${i}`,
      action: 'download' as const,
      remote: { syntheticCloudAbsence: true },
    }));
    // downloads reais (sem synthetic) devem permanecer
    plan.push({
      collection: 'cadastros',
      id: 'keep-real',
      action: 'download',
      remote: { syntheticCloudAbsence: false },
    });
    const result = stripMassSyntheticPrune(plan, 2000);
    expect(result.threshold).toBe(100);
    expect(result.stripped).toBe(120);
    expect(result.plan).toHaveLength(1);
    expect(result.plan[0]?.id).toBe('keep-real');
  });

  it('não remove uploads nem downloads sem syntheticCloudAbsence', () => {
    const plan = [
      {
        collection: 'cadastros',
        id: 'up-1',
        action: 'upload' as const,
        remote: null,
      },
      {
        collection: 'cadastros',
        id: 'dl-1',
        action: 'download' as const,
        remote: { syntheticCloudAbsence: undefined },
      },
    ];
    const result = stripMassSyntheticPrune(plan, 10);
    expect(result.stripped).toBe(0);
    expect(result.plan).toHaveLength(2);
  });
});
