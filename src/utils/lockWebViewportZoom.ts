/**
 * Bloqueia zoom (pinch) no PWA e web — mantém o app enquadrado na tela.
 */
export function lockWebViewportZoom(): () => void {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return () => undefined;
  }

  const VIEWPORT_CONTENT =
    'width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover';

  let meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'viewport';
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', VIEWPORT_CONTENT);

  const html = document.documentElement;
  const body = document.body;
  html.style.touchAction = 'manipulation';
  body.style.touchAction = 'manipulation';
  html.style.overscrollBehavior = 'none';
  body.style.overscrollBehavior = 'none';
  (html.style as CSSStyleDeclaration & { textSizeAdjust?: string }).textSizeAdjust = '100%';
  (html.style as CSSStyleDeclaration & { webkitTextSizeAdjust?: string }).webkitTextSizeAdjust =
    '100%';

  const preventGesture = (event: Event) => {
    event.preventDefault();
  };

  /** iOS Safari / PWA standalone ainda dispara gesture* em pinch. */
  document.addEventListener('gesturestart', preventGesture, { passive: false });
  document.addEventListener('gesturechange', preventGesture, { passive: false });
  document.addEventListener('gestureend', preventGesture, { passive: false });

  return () => {
    document.removeEventListener('gesturestart', preventGesture);
    document.removeEventListener('gesturechange', preventGesture);
    document.removeEventListener('gestureend', preventGesture);
  };
}
