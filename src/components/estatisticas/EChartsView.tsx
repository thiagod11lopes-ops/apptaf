import React, { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { ChartOption } from '../../utils/estatisticasChartTypes';
import { buildEchartsWebViewHtml } from '../../utils/echartsWebViewHtml';

type Props = {
  option: ChartOption;
  height?: number;
  isDark?: boolean;
};

type WebIframeProps = {
  html: string;
  height: number;
};

/** Expo Web não suporta react-native-webview — iframe com o mesmo HTML do mobile. */
function EChartsWebIframe({ html, height }: WebIframeProps) {
  return React.createElement('iframe', {
    srcDoc: html,
    title: 'Gráfico ECharts',
    sandbox: 'allow-scripts allow-same-origin',
    style: {
      width: '100%',
      height,
      border: 'none',
      background: 'transparent',
      display: 'block',
    },
  });
}

function EChartsNativeWebView({ html, height }: { html: string; height: number }) {
  return (
    <WebView
      originWhitelist={['*']}
      source={{ html, baseUrl: 'https://taf.local' }}
      style={[styles.webview, { height }]}
      scrollEnabled={false}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      androidLayerType="hardware"
      cacheEnabled={false}
      incognito={Platform.OS === 'android'}
    />
  );
}

export function EChartsView({ option, height = 280, isDark = false }: Props) {
  const html = useMemo(
    () => buildEchartsWebViewHtml(option, height, isDark),
    [option, height, isDark],
  );

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.webview, { height }]}>
        <EChartsWebIframe html={html} height={height} />
      </View>
    );
  }

  return <EChartsNativeWebView html={html} height={height} />;
}

const styles = StyleSheet.create({
  webview: {
    width: '100%',
    backgroundColor: 'transparent',
  },
});
