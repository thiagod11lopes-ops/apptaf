import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart, RadarChart, HeatmapChart, GaugeChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
  RadarComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsCoreOption } from 'echarts/core';

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  RadarChart,
  HeatmapChart,
  GaugeChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
  RadarComponent,
  CanvasRenderer,
]);

type Props = {
  option: EChartsCoreOption;
  height?: number;
  isDark?: boolean;
};

export function EChartsView({ option, height = 280, isDark = false }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = echarts.init(el, isDark ? 'dark' : undefined, { renderer: 'canvas' });
    chartRef.current = chart;
    chart.setOption(option, { notMerge: true });

    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    ro?.observe(el);

    return () => {
      window.removeEventListener('resize', onResize);
      ro?.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [option, isDark]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height, borderRadius: 12, overflow: 'hidden' }}
    />
  );
}
