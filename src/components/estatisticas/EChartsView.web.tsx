import React, { useEffect, useRef, useState } from 'react';
import type { ChartOption } from '../../utils/estatisticasChartTypes';
import { loadEchartsFromCdn } from '../../utils/loadEchartsFromCdn';

type EChartsInstance = {
  setOption: (option: ChartOption, opts?: { notMerge?: boolean }) => void;
  resize: () => void;
  dispose: () => void;
};

type Props = {
  option: ChartOption;
  height?: number;
  isDark?: boolean;
};

export function EChartsView({ option, height = 280, isDark = false }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<EChartsInstance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let disposed = false;
    let cleanupResize = () => {};

    void (async () => {
      try {
        setLoading(true);
        setError(null);
        const echarts = await loadEchartsFromCdn();
        if (disposed || !containerRef.current) return;

        const chart = echarts.init(el, isDark ? 'dark' : undefined, { renderer: 'canvas' });
        chartRef.current = chart;
        chart.setOption(option, { notMerge: true });

        const onResize = () => chart.resize();
        window.addEventListener('resize', onResize);
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
        ro?.observe(el);
        cleanupResize = () => {
          window.removeEventListener('resize', onResize);
          ro?.disconnect();
        };
      } catch (e) {
        if (!disposed) {
          setError(e instanceof Error ? e.message : 'Não foi possível carregar o gráfico.');
        }
      } finally {
        if (!disposed) setLoading(false);
      }
    })();

    return () => {
      disposed = true;
      cleanupResize();
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, [option, isDark]);

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true });
  }, [option]);

  if (error) {
    return (
      <div style={{ padding: 16, color: '#b91c1c', fontSize: 13, textAlign: 'center' }}>
        {error}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height,
        borderRadius: 12,
        overflow: 'hidden',
        opacity: loading ? 0.45 : 1,
        transition: 'opacity 0.2s ease',
      }}
    />
  );
}
