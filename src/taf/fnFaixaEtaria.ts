/** Faixa etária estendida (Fuzileiros Navais — corrida 3200 m, flexões, abdominais). */
export type FaixaEtariaFn =
  | '18-25'
  | '26-33'
  | '34-39'
  | '40-45'
  | '46-49'
  | '50-54'
  | '55-60';

export function faixaEtariaFn(idadeAnos: number): FaixaEtariaFn | null {
  if (idadeAnos < 18) return null;
  if (idadeAnos <= 25) return '18-25';
  if (idadeAnos <= 33) return '26-33';
  if (idadeAnos <= 39) return '34-39';
  if (idadeAnos <= 45) return '40-45';
  if (idadeAnos <= 49) return '46-49';
  if (idadeAnos <= 54) return '50-54';
  return '55-60';
}
