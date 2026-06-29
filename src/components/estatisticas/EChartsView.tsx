import React, { useMemo } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import type { ChartOption } from '../../utils/estatisticasChartTypes';
import { buildEchartsWebViewHtml } from '../../utils/echartsWebViewHtml';

type Props = {
  option: ChartOption;
  height?: number;
  isDark?: boolean;
};

export function EChartsView({ option, height = 280, isDark = false }: Props) {
  const html = useMemo(
    () => buildEchartsWebViewHtml(option, height, isDark),
    [option, height, isDark],
  );

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

const styles = StyleSheet.create({
  webview: {
    width: '100%',
    backgroundColor: 'transparent',
  },
});
