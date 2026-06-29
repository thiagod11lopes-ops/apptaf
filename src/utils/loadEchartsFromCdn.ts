type EchartsGlobal = {
  init: (
    el: HTMLElement,
    theme?: string,
    opts?: { renderer?: string },
  ) => {
    setOption: (option: unknown, opts?: { notMerge?: boolean }) => void;
    resize: () => void;
    dispose: () => void;
  };
};

declare global {
  interface Window {
    echarts?: EchartsGlobal;
  }
}

const ECHARTS_CDN_URL = 'https://cdn.jsdelivr.net/npm/echarts@6.1.0/dist/echarts.min.js';

let loadPromise: Promise<EchartsGlobal> | null = null;

function scriptAlreadyLoading(): HTMLScriptElement | null {
  return document.querySelector('script[data-taf-echarts-cdn="1"]');
}

/** Carrega ECharts via CDN — evita bundle Metro/Expo com tslib (__extends). */
export function loadEchartsFromCdn(): Promise<EchartsGlobal> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('ECharts disponível apenas na web.'));
  }

  if (window.echarts?.init) {
    return Promise.resolve(window.echarts);
  }

  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const finish = () => {
        if (window.echarts?.init) {
          resolve(window.echarts);
          return;
        }
        loadPromise = null;
        reject(new Error('Biblioteca ECharts indisponível após carregar.'));
      };

      const existing = scriptAlreadyLoading();
      if (existing) {
        existing.addEventListener('load', finish, { once: true });
        existing.addEventListener(
          'error',
          () => {
            loadPromise = null;
            reject(new Error('Não foi possível carregar ECharts.'));
          },
          { once: true },
        );
        return;
      }

      const script = document.createElement('script');
      script.src = ECHARTS_CDN_URL;
      script.async = true;
      script.dataset.tafEchartsCdn = '1';
      script.onload = finish;
      script.onerror = () => {
        loadPromise = null;
        reject(new Error('Não foi possível carregar ECharts.'));
      };
      document.head.appendChild(script);
    });
  }

  return loadPromise;
}

export type { EchartsGlobal };
