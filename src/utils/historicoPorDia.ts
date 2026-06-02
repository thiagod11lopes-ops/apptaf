import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';
import { dataBrParaIso, dataIsoParaBr } from './tafRegistro';

/** Mapa ISO (YYYY-MM-DD) → sessões daquele dia. */
export function mapaSessoesPorDiaIso(sessoes: SessaoAplicacaoTaf[]): Map<string, SessaoAplicacaoTaf[]> {
  const map = new Map<string, SessaoAplicacaoTaf[]>();
  for (const sessao of sessoes) {
    const iso = dataBrParaIso(sessao.dataAplicacao);
    if (!iso) continue;
    const lista = map.get(iso) ?? [];
    lista.push(sessao);
    map.set(iso, lista);
  }
  for (const [k, lista] of map) {
    lista.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
    map.set(k, lista);
  }
  return map;
}

export function diasComTestesIso(sessoes: SessaoAplicacaoTaf[]): Set<string> {
  return new Set(mapaSessoesPorDiaIso(sessoes).keys());
}

export function sessoesDoDiaIso(
  sessoes: SessaoAplicacaoTaf[],
  diaIso: string,
): SessaoAplicacaoTaf[] {
  const iso = diaIso.trim();
  return sessoes.filter((s) => dataBrParaIso(s.dataAplicacao) === iso);
}

export function dataBrDoDiaIso(diaIso: string): string {
  return dataIsoParaBr(diaIso);
}

export function isoHojeLocal(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export type CelulaCalendario = {
  iso: string | null;
  dia: number;
  mesAtual: boolean;
};

const MESES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

export function tituloMesAno(ano: number, mes: number): string {
  return `${MESES_PT[mes] ?? ''} ${ano}`;
}

/** Grade 6×7 com dias do mês (null = célula vazia). */
export function gradeCalendarioMes(ano: number, mes: number): CelulaCalendario[] {
  const primeiro = new Date(ano, mes, 1);
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  const inicioSemana = primeiro.getDay();
  const cells: CelulaCalendario[] = [];

  for (let i = 0; i < inicioSemana; i++) {
    cells.push({ iso: null, dia: 0, mesAtual: false });
  }
  for (let d = 1; d <= ultimoDia; d++) {
    const mm = String(mes + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    cells.push({
      iso: `${ano}-${mm}-${dd}`,
      dia: d,
      mesAtual: true,
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ iso: null, dia: 0, mesAtual: false });
  }
  return cells;
}
