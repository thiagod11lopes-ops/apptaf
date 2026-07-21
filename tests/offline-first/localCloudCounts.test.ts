import { describe, expect, it } from 'vitest';
import {
  formatLocalCloudRatio,
  localCloudAlignment,
  localCloudAlignmentLabel,
} from '../../src/services/localCloudCounts';

describe('localCloudCounts — dose 5', () => {
  it('formata local / nuvem', () => {
    expect(formatLocalCloudRatio(2243, 2243)).toBe('2.243 / 2.243');
    expect(formatLocalCloudRatio(1800, null)).toBe('1.800 / —');
  });

  it('alinhamento igual / atrás / à frente', () => {
    expect(localCloudAlignment(2243, 2243)).toBe('aligned');
    expect(localCloudAlignment(1800, 2243)).toBe('behind');
    expect(localCloudAlignment(2300, 2243)).toBe('ahead');
    expect(localCloudAlignment(10, null)).toBe('unknown');
  });

  it('rótulos em português', () => {
    expect(localCloudAlignmentLabel('aligned')).toMatch(/igual/i);
    expect(localCloudAlignmentLabel('behind')).toMatch(/atrás/i);
    expect(localCloudAlignmentLabel('ahead')).toMatch(/frente/i);
  });
});
