import { describe, expect, it } from 'vitest';
import {
  isMobileOrTabletUserAgent,
  resolveUsePhoneFrame,
} from '../../src/hooks/useDeviceLayout';

const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

describe('resolveUsePhoneFrame', () => {
  it('sempre desativada (desktop usa sidebar, sem moldura iPhone)', () => {
    expect(
      resolveUsePhoneFrame({
        isWeb: true,
        width: 1440,
        height: 900,
        userAgent: DESKTOP_UA,
        pointerCoarse: false,
        hoverNone: false,
      }),
    ).toBe(false);
  });

  it('desativa moldura em celular em retrato', () => {
    expect(
      resolveUsePhoneFrame({
        isWeb: true,
        width: 390,
        height: 844,
        userAgent: IPHONE_UA,
      }),
    ).toBe(false);
  });

  it('desativa moldura em celular deitado (largura >= 768)', () => {
    expect(
      resolveUsePhoneFrame({
        isWeb: true,
        width: 844,
        height: 390,
        userAgent: IPHONE_UA,
      }),
    ).toBe(false);
  });

  it('desativa moldura em Android PWA em paisagem', () => {
    expect(
      resolveUsePhoneFrame({
        isWeb: true,
        width: 915,
        height: 412,
        userAgent: ANDROID_UA,
      }),
    ).toBe(false);
  });

  it('desativa moldura em dispositivo touch-primary sem UA mobile', () => {
    expect(
      resolveUsePhoneFrame({
        isWeb: true,
        width: 1366,
        height: 1024,
        userAgent: DESKTOP_UA,
        pointerCoarse: true,
        hoverNone: true,
      }),
    ).toBe(false);
  });

  it('desativa moldura fora da web', () => {
    expect(
      resolveUsePhoneFrame({
        isWeb: false,
        width: 1440,
        height: 900,
        userAgent: DESKTOP_UA,
      }),
    ).toBe(false);
  });
});

describe('isMobileOrTabletUserAgent', () => {
  it('detecta iPhone e Android', () => {
    expect(isMobileOrTabletUserAgent(IPHONE_UA)).toBe(true);
    expect(isMobileOrTabletUserAgent(ANDROID_UA)).toBe(true);
    expect(isMobileOrTabletUserAgent(DESKTOP_UA)).toBe(false);
  });
});
