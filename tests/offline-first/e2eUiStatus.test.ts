import { describe, expect, it } from 'vitest';
import {
  getE2eUiStatusCopy,
  isE2eUiReady,
  resolveE2eUiStatus,
} from '../../src/offline-first/sync/e2eUiStatus';

describe('resolveE2eUiStatus', () => {
  it('chave + sessão confiável → ready (verde verdadeiro)', () => {
    expect(
      resolveE2eUiStatus({
        isAuthorizedMember: true,
        hasActiveKey: true,
        sessionTrusted: true,
        memberWrapPresent: true,
      }),
    ).toBe('ready');
    expect(isE2eUiReady('ready')).toBe(true);
  });

  it('chave local sem confiança → key_mismatch (não verde)', () => {
    expect(
      resolveE2eUiStatus({
        isAuthorizedMember: true,
        hasActiveKey: true,
        sessionTrusted: false,
        memberWrapPresent: true,
      }),
    ).toBe('key_mismatch');
    expect(isE2eUiReady('key_mismatch')).toBe(false);
  });

  it('membro sem chave e sem wrap → awaiting_boss_wrap', () => {
    expect(
      resolveE2eUiStatus({
        isAuthorizedMember: true,
        hasActiveKey: false,
        sessionTrusted: false,
        memberWrapPresent: false,
      }),
    ).toBe('awaiting_boss_wrap');
  });

  it('membro sem chave mas com wrap → inactive (precisa relogar)', () => {
    expect(
      resolveE2eUiStatus({
        isAuthorizedMember: true,
        hasActiveKey: false,
        sessionTrusted: false,
        memberWrapPresent: true,
      }),
    ).toBe('inactive');
  });

  it('chefe sem chave → inactive (não aguarda wrap)', () => {
    expect(
      resolveE2eUiStatus({
        isAuthorizedMember: false,
        hasActiveKey: false,
        sessionTrusted: false,
        memberWrapPresent: false,
      }),
    ).toBe('inactive');
  });

  it('wrap ainda desconhecido (null) não inventa awaiting', () => {
    expect(
      resolveE2eUiStatus({
        isAuthorizedMember: true,
        hasActiveKey: false,
        sessionTrusted: false,
        memberWrapPresent: null,
      }),
    ).toBe('inactive');
  });
});

describe('getE2eUiStatusCopy', () => {
  it('awaiting tem chip claro para o usuário', () => {
    const copy = getE2eUiStatusCopy('awaiting_boss_wrap');
    expect(copy.chip).toMatch(/Aguardando chave do chefe/i);
  });

  it('key_mismatch explica desatualização', () => {
    const copy = getE2eUiStatusCopy('key_mismatch');
    expect(copy.chip).toMatch(/desatualizada/i);
  });
});
