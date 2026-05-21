import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import { calcularIdadeAnos } from './calcularIdade';
import { tempoStringParaSegundos } from './calcularIdade';
import { parseTafPerformanceInput } from '../taf/tafTimeFormat';
import { textoNotaCorridaFromCadastro } from '../taf/corrida2400Nota';
import { textoNotaNatacaoFromCadastro } from '../taf/natacaoNota';

export type ContagemItem = { label: string; valor: number; pct?: number };

export type RegistroPorDataItem = {
  data: string;
  corrida: number;
  natacao: number;
  permanencia: number;
  total: number;
};

export type EstatisticasTafResumo = {
  totalCadastros: number;
  comCorrida: number;
  comNatacao: number;
  comPermanencia: number;
  comQualquerRegistroTaf: number;
  idadeMedia: number | null;
};

export type EstatisticasTafCompletas = {
  resumo: EstatisticasTafResumo;
  porCategoria: ContagemItem[];
  porSexo: ContagemItem[];
  porFaixaEtaria: ContagemItem[];
  registrosModalidade: ContagemItem[];
  notasCorrida: ContagemItem[];
  notasNatacao: ContagemItem[];
  permanencia: ContagemItem[];
  registrosPorData: RegistroPorDataItem[];
  temposCorrida: {
    mediaSeg: number | null;
    mediaFmt: string;
    melhorFmt: string | null;
    piorFmt: string | null;
    amostra: number;
  };
  temposNatacao: {
    mediaSeg: number | null;
    mediaFmt: string;
    melhorFmt: string | null;
    piorFmt: string | null;
    amostra: number;
  };
  taxas: {
    permanenciaAprovadosPct: number | null;
    corridaSemReprovacaoPct: number | null;
    natacaoSemReprovacaoPct: number | null;
    corridaNota50PlusPct: number | null;
    natacaoNota50PlusPct: number | null;
  };
  topPostosGrad: ContagemItem[];
  notaMediaCorrida: number | null;
  notaMediaNatacao: number | null;
};

function temCorrida(c: CadastroItemPersist): boolean {
  const leg = c as CadastroItemPersist & { tempo?: string };
  return !!(c.tempoCorrida?.trim() || leg.tempo?.trim() || c.notaCorrida?.trim());
}

function temNatacao(c: CadastroItemPersist): boolean {
  return !!(c.tempoNatacao?.trim() || c.notaNatacao?.trim());
}

function temPermanencia(c: CadastroItemPersist): boolean {
  return !!(c.resultadoPermanencia || c.tempoPermanencia?.trim());
}

function faixaEtariaTaf(idade: number | null): string {
  if (idade == null || idade < 18) return 'Inválida / <18';
  if (idade <= 25) return '18–25';
  if (idade <= 33) return '26–33';
  if (idade <= 39) return '34–39';
  if (idade <= 45) return '40–45';
  if (idade <= 49) return '46–49';
  return '50+';
}

function postoGrad(c: CadastroItemPersist): string {
  if (c.categoria === 'Oficiais') return (c.oficial || '').trim() || '—';
  return (c.praca || '').trim() || '—';
}

function tempoCorridaSegundos(c: CadastroItemPersist): number | null {
  const leg = c as CadastroItemPersist & { tempo?: string };
  const t = (c.tempoCorrida ?? leg.tempo ?? '').trim();
  if (!t) return null;
  return tempoStringParaSegundos(t);
}

function tempoNatacaoSegundos(c: CadastroItemPersist): number | null {
  const t = (c.tempoNatacao ?? '').trim();
  if (!t) return null;
  const ms = parseTafPerformanceInput('natacao', t);
  if (ms != null) return Math.floor(ms / 1000);
  return tempoStringParaSegundos(t);
}

function segundosParaMmSs(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
}

function contarPorChave(
  itens: { chave: string }[],
  ordem?: string[],
): ContagemItem[] {
  const map = new Map<string, number>();
  for (const { chave } of itens) {
    map.set(chave, (map.get(chave) ?? 0) + 1);
  }
  const total = itens.length || 1;
  const keys = ordem ?? [...map.keys()].sort((a, b) => (map.get(b) ?? 0) - (map.get(a) ?? 0));
  return keys
    .filter((k) => map.has(k))
    .map((label) => {
      const valor = map.get(label) ?? 0;
      return { label, valor, pct: Math.round((valor / total) * 100) };
    });
}

function notaNumerica(nota: string): number | null {
  if (nota === 'REPROVADO' || nota === '—' || !nota.trim()) return null;
  const n = parseInt(nota, 10);
  return Number.isFinite(n) ? n : null;
}

const ORDEM_NOTAS = ['100', '90', '80', '70', '60', '50', 'REPROVADO', '—', 'Sem nota'];

export function calcularEstatisticasTaf(cadastros: CadastroItemPersist[]): EstatisticasTafCompletas {
  const total = cadastros.length;
  let comCorrida = 0;
  let comNatacao = 0;
  let comPermanencia = 0;
  const idades: number[] = [];

  const categoriaItens: { chave: string }[] = [];
  const sexoItens: { chave: string }[] = [];
  const faixaItens: { chave: string }[] = [];
  const notaCorridaItens: { chave: string }[] = [];
  const notaNatacaoItens: { chave: string }[] = [];
  const permItens: { chave: string }[] = [];
  const postoItens: { chave: string }[] = [];

  const temposC: number[] = [];
  const temposN: number[] = [];
  const notasC: number[] = [];
  const notasN: number[] = [];

  let permAprov = 0;
  let permTotal = 0;
  let corridaOk = 0;
  let corridaTotal = 0;
  let natacaoOk = 0;
  let natacaoTotal = 0;
  let corrida50 = 0;
  let natacao50 = 0;

  const mapaData = new Map<string, { corrida: number; natacao: number; permanencia: number }>();

  const addData = (data: string | undefined, mod: 'corrida' | 'natacao' | 'permanencia') => {
    const d = (data ?? '').trim();
    if (!d) return;
    const cur = mapaData.get(d) ?? { corrida: 0, natacao: 0, permanencia: 0 };
    cur[mod] += 1;
    mapaData.set(d, cur);
  };

  for (const c of cadastros) {
    categoriaItens.push({ chave: c.categoria });
    sexoItens.push({ chave: c.sexo === 'F' ? 'Feminino' : 'Masculino' });
    const idade = calcularIdadeAnos(c.dataNascimento);
    if (idade != null) idades.push(idade);
    faixaItens.push({ chave: faixaEtariaTaf(idade) });

    const pg = postoGrad(c);
    if (pg !== '—') postoItens.push({ chave: pg });

    if (temCorrida(c)) {
      comCorrida += 1;
      addData(c.dataTafCorrida, 'corrida');
      const nota = textoNotaCorridaFromCadastro({
        tempoCorrida: c.tempoCorrida,
        dataNascimento: c.dataNascimento,
        sexo: c.sexo,
      });
      notaCorridaItens.push({ chave: nota === '—' ? 'Sem nota' : nota });
      const sec = tempoCorridaSegundos(c);
      if (sec != null) temposC.push(sec);
      const nn = notaNumerica(nota);
      if (nn != null) notasC.push(nn);
      if (nota !== '—' && nota !== 'Sem nota') {
        corridaTotal += 1;
        if (nota !== 'REPROVADO') corridaOk += 1;
        if (nn != null && nn >= 50) corrida50 += 1;
      }
    }

    if (temNatacao(c)) {
      comNatacao += 1;
      addData(c.dataTafNatacao, 'natacao');
      const nota = textoNotaNatacaoFromCadastro({
        tempoNatacao: c.tempoNatacao,
        dataNascimento: c.dataNascimento,
        sexo: c.sexo,
      });
      notaNatacaoItens.push({ chave: nota === '—' ? 'Sem nota' : nota });
      const sec = tempoNatacaoSegundos(c);
      if (sec != null) temposN.push(sec);
      const nn = notaNumerica(nota);
      if (nn != null) notasN.push(nn);
      if (nota !== '—' && nota !== 'Sem nota') {
        natacaoTotal += 1;
        if (nota !== 'REPROVADO') natacaoOk += 1;
        if (nn != null && nn >= 50) natacao50 += 1;
      }
    }

    if (temPermanencia(c)) {
      comPermanencia += 1;
      addData(c.dataTafPermanencia, 'permanencia');
      const r = c.resultadoPermanencia ?? 'indefinido';
      permItens.push({
        chave: r === 'aprovado' ? 'Aprovado' : r === 'reprovado' ? 'Reprovado' : 'Indefinido',
      });
      if (r === 'aprovado' || r === 'reprovado') {
        permTotal += 1;
        if (r === 'aprovado') permAprov += 1;
      }
    }
  }

  const comQualquer = cadastros.filter((c) => temCorrida(c) || temNatacao(c) || temPermanencia(c)).length;

  const registrosPorData: RegistroPorDataItem[] = [...mapaData.entries()]
    .map(([data, v]) => ({
      data,
      corrida: v.corrida,
      natacao: v.natacao,
      permanencia: v.permanencia,
      total: v.corrida + v.natacao + v.permanencia,
    }))
    .sort((a, b) => {
      const pa = a.data.split('/').reverse().join('');
      const pb = b.data.split('/').reverse().join('');
      return pa.localeCompare(pb);
    });

  const mediaArr = (arr: number[]) =>
    arr.length ? Math.round(arr.reduce((s, x) => s + x, 0) / arr.length) : null;

  const mediaC = mediaArr(temposC);
  const mediaN = mediaArr(temposN);

  const faixaOrdem = ['18–25', '26–33', '34–39', '40–45', '46–49', '50+', 'Inválida / <18'];

  return {
    resumo: {
      totalCadastros: total,
      comCorrida,
      comNatacao,
      comPermanencia,
      comQualquerRegistroTaf: comQualquer,
      idadeMedia: idades.length
        ? Math.round(idades.reduce((s, x) => s + x, 0) / idades.length)
        : null,
    },
    porCategoria: contarPorChave(categoriaItens, ['Oficiais', 'Praças']),
    porSexo: contarPorChave(sexoItens, ['Masculino', 'Feminino']),
    porFaixaEtaria: contarPorChave(faixaItens, faixaOrdem),
    registrosModalidade: [
      { label: 'Corrida', valor: comCorrida, pct: total ? Math.round((comCorrida / total) * 100) : 0 },
      { label: 'Natação', valor: comNatacao, pct: total ? Math.round((comNatacao / total) * 100) : 0 },
      {
        label: 'Permanência',
        valor: comPermanencia,
        pct: total ? Math.round((comPermanencia / total) * 100) : 0,
      },
    ],
    notasCorrida: contarPorChave(notaCorridaItens, ORDEM_NOTAS),
    notasNatacao: contarPorChave(notaNatacaoItens, ORDEM_NOTAS),
    permanencia: contarPorChave(permItens, ['Aprovado', 'Reprovado', 'Indefinido']),
    registrosPorData,
    temposCorrida: {
      mediaSeg: mediaC,
      mediaFmt: mediaC != null ? segundosParaMmSs(mediaC) : '—',
      melhorFmt: temposC.length ? segundosParaMmSs(Math.min(...temposC)) : null,
      piorFmt: temposC.length ? segundosParaMmSs(Math.max(...temposC)) : null,
      amostra: temposC.length,
    },
    temposNatacao: {
      mediaSeg: mediaN,
      mediaFmt: mediaN != null ? segundosParaMmSs(mediaN) : '—',
      melhorFmt: temposN.length ? segundosParaMmSs(Math.min(...temposN)) : null,
      piorFmt: temposN.length ? segundosParaMmSs(Math.max(...temposN)) : null,
      amostra: temposN.length,
    },
    taxas: {
      permanenciaAprovadosPct: permTotal ? Math.round((permAprov / permTotal) * 100) : null,
      corridaSemReprovacaoPct: corridaTotal ? Math.round((corridaOk / corridaTotal) * 100) : null,
      natacaoSemReprovacaoPct: natacaoTotal ? Math.round((natacaoOk / natacaoTotal) * 100) : null,
      corridaNota50PlusPct: corridaTotal ? Math.round((corrida50 / corridaTotal) * 100) : null,
      natacaoNota50PlusPct: natacaoTotal ? Math.round((natacao50 / natacaoTotal) * 100) : null,
    },
    topPostosGrad: contarPorChave(postoItens).slice(0, 10),
    notaMediaCorrida: notasC.length
      ? Math.round(notasC.reduce((s, x) => s + x, 0) / notasC.length)
      : null,
    notaMediaNatacao: notasN.length
      ? Math.round(notasN.reduce((s, x) => s + x, 0) / notasN.length)
      : null,
  };
}
