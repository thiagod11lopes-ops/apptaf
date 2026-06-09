import type { ViewStyle } from 'react-native';

/** Padding horizontal típico das telas com tabelas. */
export const TABLE_SCREEN_PADDING_H = 16;

/** Container de tabela/planilha ocupa 100% da largura (portrait e landscape). */
export const tableFullWidthStyle: ViewStyle = {
  width: '100%',
  maxWidth: '100%',
  alignSelf: 'stretch',
};

export function tableAvailableWidth(screenWidth: number, paddingH = TABLE_SCREEN_PADDING_H): number {
  return Math.max(screenWidth - paddingH * 2, 280);
}

type NumericRecord = Record<string, number>;

/** Escala colunas fixas para preencher a largura disponível (sem ficar menor que o mínimo base). */
export function escalarLargurasColunas<T extends NumericRecord>(
  base: T,
  availableWidth: number,
): { larguras: T; larguraTotal: number } {
  const baseTotal = (Object.values(base) as number[]).reduce((s, v) => s + v, 0);
  const larguraTotal = Math.max(availableWidth, baseTotal);
  const escala = larguraTotal / baseTotal;
  const larguras = {} as T;
  for (const k of Object.keys(base) as (keyof T)[]) {
    larguras[k] = Math.round(base[k] * escala) as T[keyof T];
  }
  return { larguras, larguraTotal };
}
