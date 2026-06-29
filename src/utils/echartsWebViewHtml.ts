import type { ChartOption } from './estatisticasChartTypes';

const ECHARTS_CDN_URLS = [
  'https://cdn.jsdelivr.net/npm/echarts@6.1.0/dist/echarts.min.js',
  'https://unpkg.com/echarts@6.1.0/dist/echarts.min.js',
];

function escapeScriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/** HTML isolado — ECharts só via CDN, fora do bundle Metro/Expo. */
export function buildEchartsWebViewHtml(
  option: ChartOption,
  height: number,
  isDark: boolean,
): string {
  const optionJson = escapeScriptJson(option);
  const themeInit = isDark ? "'dark'" : 'undefined';
  const cdnUrlsJson = escapeScriptJson(ECHARTS_CDN_URLS);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: transparent;
      overflow: hidden;
      -webkit-text-size-adjust: 100%;
    }
    #chart {
      width: 100%;
      height: ${height}px;
    }
    .err {
      color: #b91c1c;
      font: 13px/1.4 system-ui, sans-serif;
      text-align: center;
      padding: 16px;
    }
  </style>
</head>
<body>
  <div id="chart"></div>
  <script>
    (function () {
      var urls = ${cdnUrlsJson};
      var idx = 0;

      function showError(msg) {
        document.body.innerHTML = '<p class="err">' + msg + '</p>';
      }

      function boot() {
        if (!window.echarts) {
          showError('Não foi possível carregar ECharts.');
          return;
        }
        try {
          var chart = window.echarts.init(
            document.getElementById('chart'),
            ${themeInit},
            { renderer: 'canvas' }
          );
          chart.setOption(${optionJson}, { notMerge: true });
          window.addEventListener('resize', function () { chart.resize(); });
        } catch (e) {
          showError(e && e.message ? e.message : 'Erro ao renderizar gráfico.');
        }
      }

      function loadNext() {
        if (idx >= urls.length) {
          showError('Não foi possível carregar ECharts.');
          return;
        }
        var s = document.createElement('script');
        s.src = urls[idx++];
        s.async = true;
        s.onload = boot;
        s.onerror = loadNext;
        document.head.appendChild(s);
      }

      loadNext();
    })();
  </script>
</body>
</html>`;
}
