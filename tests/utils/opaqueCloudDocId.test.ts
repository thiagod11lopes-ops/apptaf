import { describe, expect, it } from 'vitest';
import {
  isLegacyNipCloudDocId,
  resolveOpaqueCloudDocId,
} from '../../src/utils/opaqueCloudDocId';

describe('opaqueCloudDocId', () => {
  it('detecta id legado = NIP de 8 dígitos', () => {
    expect(isLegacyNipCloudDocId('12345678')).toBe(true);
    expect(isLegacyNipCloudDocId('12.3456.78')).toBe(false);
    expect(isLegacyNipCloudDocId('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(false);
  });

  it('não reutiliza NIP legado como cloudId', () => {
    const id = resolveOpaqueCloudDocId({
      localCloudId: '12345678',
      remoteRowId: '12345678',
    });
    expect(isLegacyNipCloudDocId(id)).toBe(false);
    expect(id.length).toBeGreaterThan(8);
  });

  it('preferência local opaco sobre remoto', () => {
    expect(
      resolveOpaqueCloudDocId({
        localCloudId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        remoteRowId: '11111111-2222-3333-4444-555555555555',
      }),
    ).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  });
});
