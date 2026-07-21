import { afterEach, describe, expect, it } from 'vitest';
import {
  buildE2eWrapRenewalMessage,
  clearE2eWrapRenewalNotice,
  getLastE2eWrapRenewalNotice,
  publishE2eWrapRenewalNotice,
  subscribeE2eWrapRenewalNotice,
} from '../../src/services/supabase/e2eWrapRenewalNotice';

afterEach(() => {
  clearE2eWrapRenewalNotice();
});

describe('buildE2eWrapRenewalMessage', () => {
  it('renovados → mensagem com N de total', () => {
    expect(
      buildE2eWrapRenewalMessage({ renewed: 2, alreadyAligned: 1, total: 3 }),
    ).toMatch(/renovado \(2 de 3 e-mails\)/i);
  });

  it('só alinhados → mensagem de confirmado', () => {
    expect(
      buildE2eWrapRenewalMessage({ renewed: 0, alreadyAligned: 2, total: 2 }),
    ).toMatch(/confirmado \(2 e-mails alinhados\)/i);
  });

  it('dek_locked → pede escudo verde', () => {
    expect(
      buildE2eWrapRenewalMessage({
        renewed: 0,
        alreadyAligned: 0,
        total: 2,
        dekLocked: true,
      }),
    ).toMatch(/escudo verde/i);
  });
});

describe('publishE2eWrapRenewalNotice', () => {
  it('notifica assinantes e guarda last notice', () => {
    const seen: string[] = [];
    const unsub = subscribeE2eWrapRenewalNotice((n) => {
      if (n) seen.push(n.message);
    });
    publishE2eWrapRenewalNotice({
      renewed: 1,
      alreadyAligned: 0,
      total: 1,
      source: 'wipe',
    });
    expect(getLastE2eWrapRenewalNotice()?.renewed).toBe(1);
    expect(getLastE2eWrapRenewalNotice()?.source).toBe('wipe');
    expect(seen[0]).toMatch(/renovado/i);
    unsub();
  });
});
