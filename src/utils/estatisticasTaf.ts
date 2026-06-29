import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf, TipoProvaAplicada } from '../services/resultadosAplicadosIndexedDb';
import { calcularIdadeAnos, tempoStringParaSegundos } from './calcularIdade';
import { parseTafPerformanceInput } from '../taf/tafTimeFormat';
import { textoNotaCorridaFromCadastro } from '../taf/corrida2400Nota';
import { textoNotaNatacaoFromCadastro } from '../taf/natacaoNota';
import { textoNotaCaminhadaFromCadastro } from '../taf/caminhada4800Nota';
import {
  cadastroComTafCompleto,
  cadastroComAlgumResultadoTaf,
  cadastroComPendenciaParcialTaf,
  temAvaliacaoCorrida,
  temAvaliacaoCaminhada,
  temAvaliacaoNatacao,
  temAvaliacaoPermanencia,
  postoGradFromCadastro,
} from './resultadoTafCadastro';
import { nipDigitos } from './nipFormat';

export type ContagemItem = { label: string; valor: number; pct?: number; hint?: string };

export type RegistroPorDataItem = {
  data: string;
  corrida: number;
  caminhada: number;
  natacao: number;
  permanencia: number;
  total: number;
  militaresUnicos: number;
};

export type RegistroPorMesItem = {
  mes: string;
  corrida: number;
  caminhada: number;
  natacao: number;
  permanencia: number;
  total: number;
};

export type RankingTempoItem = {
  nome: string;
  nip: string;
  tempoFmt: string;
  tempoSeg: number;
  nota?: string;
};

export type HeatmapReprovacaoItem = {
  faixa: string;
  corridaPct: number;
  caminhadaPct: number;
  natacaoPct: number;
  amostra: number;
};

export type NotaMediaGrupo = {
  corrida: number | null;
  caminhada: number | null;
  natacao: number | null;
  amostra: number;
};

export type EstatisticasTemposResumo = {
  mediaSeg: number | null;
  mediaFmt: string;
  melhorFmt: string | null;
  piorFmt: string | null;
  amostra: number;
};

export type EstatisticasTafResumo = {
  totalCadastros: number;
  comCorrida: number;
  comCaminhada: number;
  comNatacao: number;
  comPermanencia: number;
  comQualquerRegistroTaf: number;
  idadeMedia: number | null;
  tafCompleto: number;
  tafParcial: number;
  semNenhumTeste: number;
  taxaConclusaoTafPct: number | null;
  mediaMilitaresPorDia: number;
  diasComAplicacao: number;
};

export type EstatisticasTafCompletas = {
  resumo: EstatisticasTafResumo;
  porCategoria: ContagemItem[];
  porSexo: ContagemItem[];
  porFaixaEtaria: ContagemItem[];
  registrosModalidade: ContagemItem[];
  corridaVsCaminhada: ContagemItem[];
  pendenciasModalidade: ContagemItem[];
  notasCorrida: ContagemItem[];
  notasCaminhada: ContagemItem[];
  notasNatacao: ContagemItem[];
  permanencia: ContagemItem[];
  registrosPorData: RegistroPorDataItem[];
  registrosPorMes: RegistroPorMesItem[];
  temposCorrida: EstatisticasTemposResumo;
  temposCaminhada: EstatisticasTemposResumo;
  temposNatacao: EstatisticasTemposResumo;
  temposPermanencia: EstatisticasTemposResumo;
  taxas: {
    permanenciaAprovadosPct: number | null;
    corridaSemReprovacaoPct: number | null;
    natacaoSemReprovacaoPct: number | null;
    caminhadaSemReprovacaoPct: number | null;
    corridaNota50PlusPct: number | null;
    natacaoNota50PlusPct: number | null;
    caminhadaNota50PlusPct: number | null;
    taxaGlobalAprovacaoPct: number | null;
    reprovados2PlusModalidadesPct: number | null;
  };
  topPostosGrad: ContagemItem[];
  desempenhoPorPosto: ContagemItem[];
  notaMediaCorrida: number | null;
  notaMediaNatacao: number | null;
  notaMediaCaminhada: number | null;
  notaMediaGeral: number | null;
  medianaNotas: number | null;
  notaMediaPorFaixaEtaria: Record<string, NotaMediaGrupo>;
  notaMediaPorSexo: Record<string, NotaMediaGrupo>;
  notaMediaPorCategoria: Record<string, NotaMediaGrupo>;
  aprovacaoPorCategoria: ContagemItem[];
  heatmapReprovacao: HeatmapReprovacaoItem[];
  rankingTempos: {
    corrida: RankingTempoItem[];
    caminhada: RankingTempoItem[];
    natacao: RankingTempoItem[];
  };
  operacional: {
    totalSessoes: number;
    mediaParticipantesPorSessao: number;
    provaMaisAplicada: string;
    contagemPorProva: Record<TipoProvaAplicada, number>;
  };
  qualidade: {
    cadastrosIncompletos: number;
    notasInconsistentes: number;
    idadeInvalida: number;
  };
  metaConclusao: {
    metaPct: number;
    atualPct: number;
    faltam: number;
  };
  cadastrosNovos: {
    ultimos30: number;
    ultimos90: number;
    disponivel: boolean;
  };
};

export const META_CONCLUSAO_TAF_PCT = 80;

const ORDEM_NOTAS = ['100', '90', '80', '70', '60', '50', 'REPROVADO', '—', 'Sem nota'];
const FAIXA_ORDEM = ['18–25', '26–33', '34–39', '40–45', '46–49', '50+', 'Inválida / <18'];

function faixaEtariaTaf(idade: number | null): string {
  if (idade == null || idade < 18) return 'Inválida / <18';
  if (idade <= 25) return '18–25';
  if (idade <= 33) return '26–33';
  if (idade <= 39) return '34–39';
  if (idade <= 45) return '40–45';
  if (idade <= 49) return '46–49';
  return '50+';
}

function temPermanencia(c: CadastroItemPersist): boolean {
  return temAvaliacaoPermanencia(c);
}

function tempoCorridaSegundos(c: CadastroItemPersist): number | null {
  const leg = c as CadastroItemPersist & { tempo?: string };
  const t = (c.tempoCorrida ?? leg.tempo ?? '').trim();
  if (!t) return null;
  return tempoStringParaSegundos(t);
}

function tempoCaminhadaSegundos(c: CadastroItemPersist): number | null {
  const t = (c.tempoCaminhada ?? '').trim();
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

function tempoPermanenciaSegundos(c: CadastroItemPersist): number | null {
  const t = (c.tempoPermanencia ?? '').trim();
  if (!t) return null;
  return tempoStringParaSegundos(t);
}

function segundosParaMmSs(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
}

function contarPorChave(itens: { chave: string }[], ordem?: string[]): ContagemItem[] {
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

function mediana(arr: number[]): number | null {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

function mediaArr(arr: number[]): number | null {
  return arr.length ? Math.round(arr.reduce((s, x) => s + x, 0) / arr.length) : null;
}

function resumoTempos(segundos: number[]): EstatisticasTemposResumo {
  const media = mediaArr(segundos);
  return {
    mediaSeg: media,
    mediaFmt: media != null ? segundosParaMmSs(media) : '—',
    melhorFmt: segundos.length ? segundosParaMmSs(Math.min(...segundos)) : null,
    piorFmt: segundos.length ? segundosParaMmSs(Math.max(...segundos)) : null,
    amostra: segundos.length,
  };
}

function chaveMilitar(c: CadastroItemPersist): string {
  return c.id || nipDigitos(c.nip) || c.nome || '—';
}

function notaFromCadastro(
  c: CadastroItemPersist,
  mod: 'corrida' | 'caminhada' | 'natacao',
): string {
  if (mod === 'corrida') {
    return textoNotaCorridaFromCadastro({
      tempoCorrida: c.tempoCorrida,
      dataNascimento: c.dataNascimento,
      sexo: c.sexo,
    });
  }
  if (mod === 'caminhada') {
    return textoNotaCaminhadaFromCadastro({
      tempoCaminhada: c.tempoCaminhada,
      dataNascimento: c.dataNascimento,
      sexo: c.sexo,
    });
  }
  return textoNotaNatacaoFromCadastro({
    tempoNatacao: c.tempoNatacao,
    dataNascimento: c.dataNascimento,
    sexo: c.sexo,
  });
}

function isReprovado(nota: string): boolean {
  return nota === 'REPROVADO';
}

function isAprovadoModalidade(nota: string): boolean {
  return nota !== '—' && nota !== 'Sem nota' && nota !== 'REPROVADO';
}

type AcumNotaGrupo = {
  corrida: number[];
  caminhada: number[];
  natacao: number[];
};

function pushNotaGrupo(acum: AcumNotaGrupo, mod: 'corrida' | 'caminhada' | 'natacao', nota: string) {
  const n = notaNumerica(nota);
  if (n == null) return;
  acum[mod].push(n);
}

function grupoParaMedia(acum: AcumNotaGrupo): NotaMediaGrupo {
  return {
    corrida: mediaArr(acum.corrida),
    caminhada: mediaArr(acum.caminhada),
    natacao: mediaArr(acum.natacao),
    amostra: acum.corrida.length + acum.caminhada.length + acum.natacao.length,
  };
}

function mesFromData(data: string): string {
  const p = data.trim().split('/');
  if (p.length !== 3) return data.slice(0, 7);
  return `${p[1]}/${p[2]}`;
}

function calcularMediaMilitaresPorDia(
  cadastros: CadastroItemPersist[],
  sessoes: SessaoAplicacaoTaf[],
): { media: number; dias: number; porDia: Map<string, Set<string>> } {
  const porDia = new Map<string, Set<string>>();

  const add = (data: string | undefined, chave: string) => {
    const d = (data ?? '').trim();
    if (!d || !chave || chave === '—') return;
    if (!porDia.has(d)) porDia.set(d, new Set());
    porDia.get(d)!.add(chave);
  };

  for (const c of cadastros) {
    const chave = chaveMilitar(c);
    add(c.dataTafCorrida, chave);
    add(c.dataTafCaminhada, chave);
    add(c.dataTafNatacao, chave);
    add(c.dataTafPermanencia, chave);
  }

  for (const s of sessoes) {
    const d = s.dataAplicacao.trim();
    for (const r of s.resultados) {
      const chave = nipDigitos(r.nip) || (r.nome ?? '').trim() || r.nip;
      add(d, chave);
    }
  }

  const dias = porDia.size;
  if (dias === 0) return { media: 0, dias: 0, porDia };
  const total = [...porDia.values()].reduce((sum, set) => sum + set.size, 0);
  return { media: Math.round((total / dias) * 10) / 10, dias, porDia };
}

export function calcularEstatisticasTaf(
  cadastros: CadastroItemPersist[],
  sessoes: SessaoAplicacaoTaf[] = [],
): EstatisticasTafCompletas {
  const total = cadastros.length;
  let comCorrida = 0;
  let comCaminhada = 0;
  let comNatacao = 0;
  let comPermanencia = 0;
  let tafCompleto = 0;
  let tafParcial = 0;
  let semNenhumTeste = 0;
  let pendCorrida = 0;
  let pendNatacao = 0;
  let pendPermanencia = 0;

  const idades: number[] = [];
  const categoriaItens: { chave: string }[] = [];
  const sexoItens: { chave: string }[] = [];
  const faixaItens: { chave: string }[] = [];
  const notaCorridaItens: { chave: string }[] = [];
  const notaCaminhadaItens: { chave: string }[] = [];
  const notaNatacaoItens: { chave: string }[] = [];
  const permItens: { chave: string }[] = [];
  const postoItens: { chave: string }[] = [];
  const postoNotas: Map<string, number[]> = new Map();

  const temposC: number[] = [];
  const temposCam: number[] = [];
  const temposN: number[] = [];
  const temposP: number[] = [];
  const notasC: number[] = [];
  const notasCam: number[] = [];
  const notasN: number[] = [];
  const todasNotas: number[] = [];

  const rankingC: RankingTempoItem[] = [];
  const rankingCam: RankingTempoItem[] = [];
  const rankingN: RankingTempoItem[] = [];

  let permAprov = 0;
  let permTotal = 0;
  let corridaOk = 0;
  let corridaTotal = 0;
  let caminhadaOk = 0;
  let caminhadaTotal = 0;
  let natacaoOk = 0;
  let natacaoTotal = 0;
  let corrida50 = 0;
  let caminhada50 = 0;
  let natacao50 = 0;
  let globalAprov = 0;
  let globalTotal = 0;
  let reprov2Plus = 0;

  let cadastrosIncompletos = 0;
  let notasInconsistentes = 0;
  let idadeInvalida = 0;

  const mapaData = new Map<string, { corrida: number; caminhada: number; natacao: number; permanencia: number }>();
  const mapaMes = new Map<string, { corrida: number; caminhada: number; natacao: number; permanencia: number }>();

  const notaPorFaixa: Record<string, AcumNotaGrupo> = {};
  const notaPorSexo: Record<string, AcumNotaGrupo> = {};
  const notaPorCategoria: Record<string, AcumNotaGrupo> = {};
  const reprovFaixa: Record<string, { corrida: number; caminhada: number; natacao: number; n: number }> = {};

  const aprovCategoria = { Oficiais: { ok: 0, total: 0 }, Praças: { ok: 0, total: 0 } };

  const addData = (data: string | undefined, mod: 'corrida' | 'caminhada' | 'natacao' | 'permanencia') => {
    const d = (data ?? '').trim();
    if (!d) return;
    const cur = mapaData.get(d) ?? { corrida: 0, caminhada: 0, natacao: 0, permanencia: 0 };
    cur[mod] += 1;
    mapaData.set(d, cur);
    const mes = mesFromData(d);
    const curM = mapaMes.get(mes) ?? { corrida: 0, caminhada: 0, natacao: 0, permanencia: 0 };
    curM[mod] += 1;
    mapaMes.set(mes, curM);
  };

  const acumGrupo = (map: Record<string, AcumNotaGrupo>, key: string): AcumNotaGrupo => {
    if (!map[key]) map[key] = { corrida: [], caminhada: [], natacao: [] };
    return map[key];
  };

  for (const c of cadastros) {
    categoriaItens.push({ chave: c.categoria });
    sexoItens.push({ chave: c.sexo === 'F' ? 'Feminino' : 'Masculino' });
    const idade = calcularIdadeAnos(c.dataNascimento);
    if (idade != null) idades.push(idade);
    const faixa = faixaEtariaTaf(idade);
    faixaItens.push({ chave: faixa });
    if (faixa === 'Inválida / <18') idadeInvalida += 1;

    const pg = postoGradFromCadastro(c);
    if (pg !== '—') postoItens.push({ chave: pg });

    const semSexo = !c.sexo;
    const semNasc = !(c.dataNascimento ?? '').trim();
    const semPosto =
      c.categoria === 'Oficiais' ? !(c.oficial ?? '').trim() : !(c.praca ?? '').trim();
    if (semSexo || semNasc || semPosto) cadastrosIncompletos += 1;

    if (cadastroComTafCompleto(c)) tafCompleto += 1;
    else if (cadastroComPendenciaParcialTaf(c)) tafParcial += 1;
    else semNenhumTeste += 1;

    if (!temAvaliacaoCorrida(c) && !temAvaliacaoCaminhada(c)) pendCorrida += 1;
    if (!temAvaliacaoNatacao(c)) pendNatacao += 1;
    if (!temAvaliacaoPermanencia(c)) pendPermanencia += 1;

    const sexoKey = c.sexo === 'F' ? 'Feminino' : 'Masculino';
    const acFaixa = acumGrupo(notaPorFaixa, faixa);
    const acSexo = acumGrupo(notaPorSexo, sexoKey);
    const acCat = acumGrupo(notaPorCategoria, c.categoria);
    if (!reprovFaixa[faixa]) reprovFaixa[faixa] = { corrida: 0, caminhada: 0, natacao: 0, n: 0 };

    let reprovCount = 0;
    let modalidadesComResultado = 0;

    if (temAvaliacaoCorrida(c)) {
      comCorrida += 1;
      addData(c.dataTafCorrida, 'corrida');
      const nota = notaFromCadastro(c, 'corrida');
      notaCorridaItens.push({ chave: nota === '—' ? 'Sem nota' : nota });
      const sec = tempoCorridaSegundos(c);
      if (sec != null) {
        temposC.push(sec);
        rankingC.push({
          nome: c.nome || '—',
          nip: c.nip || '—',
          tempoFmt: segundosParaMmSs(sec),
          tempoSeg: sec,
          nota,
        });
      }
      if ((c.tempoCorrida ?? '').trim() && nota === '—') notasInconsistentes += 1;
      const nn = notaNumerica(nota);
      if (nn != null) {
        notasC.push(nn);
        todasNotas.push(nn);
        pushNotaGrupo(acFaixa, 'corrida', nota);
        pushNotaGrupo(acSexo, 'corrida', nota);
        pushNotaGrupo(acCat, 'corrida', nota);
        if (pg !== '—') {
          if (!postoNotas.has(pg)) postoNotas.set(pg, []);
          postoNotas.get(pg)!.push(nn);
        }
      }
      if (nota !== '—' && nota !== 'Sem nota') {
        corridaTotal += 1;
        modalidadesComResultado += 1;
        reprovFaixa[faixa].n += 1;
        if (isReprovado(nota)) {
          reprovCount += 1;
          reprovFaixa[faixa].corrida += 1;
        }
        if (!isReprovado(nota)) corridaOk += 1;
        if (nn != null && nn >= 50) corrida50 += 1;
      }
    }

    if (temAvaliacaoCaminhada(c)) {
      comCaminhada += 1;
      addData(c.dataTafCaminhada, 'caminhada');
      const nota = notaFromCadastro(c, 'caminhada');
      notaCaminhadaItens.push({ chave: nota === '—' ? 'Sem nota' : nota });
      const sec = tempoCaminhadaSegundos(c);
      if (sec != null) {
        temposCam.push(sec);
        rankingCam.push({
          nome: c.nome || '—',
          nip: c.nip || '—',
          tempoFmt: segundosParaMmSs(sec),
          tempoSeg: sec,
          nota,
        });
      }
      if ((c.tempoCaminhada ?? '').trim() && nota === '—') notasInconsistentes += 1;
      const nn = notaNumerica(nota);
      if (nn != null) {
        notasCam.push(nn);
        todasNotas.push(nn);
        pushNotaGrupo(acFaixa, 'caminhada', nota);
        pushNotaGrupo(acSexo, 'caminhada', nota);
        pushNotaGrupo(acCat, 'caminhada', nota);
        if (pg !== '—') {
          if (!postoNotas.has(pg)) postoNotas.set(pg, []);
          postoNotas.get(pg)!.push(nn);
        }
      }
      if (nota !== '—' && nota !== 'Sem nota') {
        caminhadaTotal += 1;
        modalidadesComResultado += 1;
        reprovFaixa[faixa].n += 1;
        if (isReprovado(nota)) {
          reprovCount += 1;
          reprovFaixa[faixa].caminhada += 1;
        }
        if (!isReprovado(nota)) caminhadaOk += 1;
        if (nn != null && nn >= 50) caminhada50 += 1;
      }
    }

    if (temAvaliacaoNatacao(c)) {
      comNatacao += 1;
      addData(c.dataTafNatacao, 'natacao');
      const nota = notaFromCadastro(c, 'natacao');
      notaNatacaoItens.push({ chave: nota === '—' ? 'Sem nota' : nota });
      const sec = tempoNatacaoSegundos(c);
      if (sec != null) {
        temposN.push(sec);
        rankingN.push({
          nome: c.nome || '—',
          nip: c.nip || '—',
          tempoFmt: segundosParaMmSs(sec),
          tempoSeg: sec,
          nota,
        });
      }
      if ((c.tempoNatacao ?? '').trim() && nota === '—') notasInconsistentes += 1;
      const nn = notaNumerica(nota);
      if (nn != null) {
        notasN.push(nn);
        todasNotas.push(nn);
        pushNotaGrupo(acFaixa, 'natacao', nota);
        pushNotaGrupo(acSexo, 'natacao', nota);
        pushNotaGrupo(acCat, 'natacao', nota);
        if (pg !== '—') {
          if (!postoNotas.has(pg)) postoNotas.set(pg, []);
          postoNotas.get(pg)!.push(nn);
        }
      }
      if (nota !== '—' && nota !== 'Sem nota') {
        natacaoTotal += 1;
        modalidadesComResultado += 1;
        reprovFaixa[faixa].n += 1;
        if (isReprovado(nota)) {
          reprovCount += 1;
          reprovFaixa[faixa].natacao += 1;
        }
        if (!isReprovado(nota)) natacaoOk += 1;
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
      const sec = tempoPermanenciaSegundos(c);
      if (sec != null) temposP.push(sec);
      if (r === 'aprovado' || r === 'reprovado') {
        permTotal += 1;
        modalidadesComResultado += 1;
        if (r === 'aprovado') permAprov += 1;
        else reprovCount += 1;
      }
    }

    if (modalidadesComResultado >= 3) {
      globalTotal += 1;
      const corridaOuCam = temAvaliacaoCorrida(c)
        ? isAprovadoModalidade(notaFromCadastro(c, 'corrida'))
        : temAvaliacaoCaminhada(c)
          ? isAprovadoModalidade(notaFromCadastro(c, 'caminhada'))
          : false;
      const natOk = isAprovadoModalidade(notaFromCadastro(c, 'natacao'));
      const permOk = c.resultadoPermanencia === 'aprovado';
      if (corridaOuCam && natOk && permOk) globalAprov += 1;

      const cat = c.categoria as 'Oficiais' | 'Praças';
      if (cat === 'Oficiais' || cat === 'Praças') {
        aprovCategoria[cat].total += 1;
        if (corridaOuCam && natOk && permOk) aprovCategoria[cat].ok += 1;
      }
    }

    if (reprovCount >= 2) reprov2Plus += 1;
  }

  const { media: mediaMilitaresPorDia, dias: diasComAplicacao, porDia } =
    calcularMediaMilitaresPorDia(cadastros, sessoes);

  const comQualquer = cadastros.filter((c) => cadastroComAlgumResultadoTaf(c)).length;

  const registrosPorData: RegistroPorDataItem[] = [...mapaData.entries()]
    .map(([data, v]) => ({
      data,
      corrida: v.corrida,
      caminhada: v.caminhada,
      natacao: v.natacao,
      permanencia: v.permanencia,
      total: v.corrida + v.caminhada + v.natacao + v.permanencia,
      militaresUnicos: porDia.get(data)?.size ?? 0,
    }))
    .sort((a, b) => {
      const pa = a.data.split('/').reverse().join('');
      const pb = b.data.split('/').reverse().join('');
      return pa.localeCompare(pb);
    });

  const registrosPorMes: RegistroPorMesItem[] = [...mapaMes.entries()]
    .map(([mes, v]) => ({
      mes,
      corrida: v.corrida,
      caminhada: v.caminhada,
      natacao: v.natacao,
      permanencia: v.permanencia,
      total: v.corrida + v.caminhada + v.natacao + v.permanencia,
    }))
    .sort((a, b) => a.mes.localeCompare(b.mes));

  const contagemProva: Record<TipoProvaAplicada, number> = {
    corrida: 0,
    caminhada: 0,
    natacao: 0,
    permanencia: 0,
  };
  let totalParticipantesSessao = 0;
  for (const s of sessoes) {
    contagemProva[s.tipoProva] += 1;
    totalParticipantesSessao += s.resultados.length;
  }
  const provaMaisAplicada =
    (Object.entries(contagemProva) as [TipoProvaAplicada, number][]).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    '—';
  const provaLabels: Record<TipoProvaAplicada, string> = {
    corrida: 'Corrida',
    caminhada: 'Caminhada',
    natacao: 'Natação',
    permanencia: 'Permanência',
  };

  const sortRanking = (arr: RankingTempoItem[]) =>
    [...arr].sort((a, b) => a.tempoSeg - b.tempoSeg).slice(0, 10);

  const desempenhoPorPosto: ContagemItem[] = [...postoNotas.entries()]
    .map(([label, notas]) => ({
      label,
      valor: mediaArr(notas) ?? 0,
      hint: `n=${notas.length}`,
    }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 12);

  const heatmapReprovacao: HeatmapReprovacaoItem[] = FAIXA_ORDEM.filter((f) => reprovFaixa[f]?.n)
    .map((faixa) => {
      const r = reprovFaixa[faixa];
      const n = r.n || 1;
      return {
        faixa,
        corridaPct: Math.round((r.corrida / n) * 100),
        caminhadaPct: Math.round((r.caminhada / n) * 100),
        natacaoPct: Math.round((r.natacao / n) * 100),
        amostra: r.n,
      };
    });

  const notaMediaPorFaixaEtaria: Record<string, NotaMediaGrupo> = {};
  for (const [k, v] of Object.entries(notaPorFaixa)) {
    notaMediaPorFaixaEtaria[k] = grupoParaMedia(v);
  }
  const notaMediaPorSexo: Record<string, NotaMediaGrupo> = {};
  for (const [k, v] of Object.entries(notaPorSexo)) {
    notaMediaPorSexo[k] = grupoParaMedia(v);
  }
  const notaMediaPorCategoria: Record<string, NotaMediaGrupo> = {};
  for (const [k, v] of Object.entries(notaPorCategoria)) {
    notaMediaPorCategoria[k] = grupoParaMedia(v);
  }

  const atualPct = total ? Math.round((tafCompleto / total) * 100) : 0;
  const faltam = Math.max(0, Math.ceil((META_CONCLUSAO_TAF_PCT / 100) * total) - tafCompleto);

  return {
    resumo: {
      totalCadastros: total,
      comCorrida,
      comCaminhada,
      comNatacao,
      comPermanencia,
      comQualquerRegistroTaf: comQualquer,
      idadeMedia: idades.length
        ? Math.round(idades.reduce((s, x) => s + x, 0) / idades.length)
        : null,
      tafCompleto,
      tafParcial,
      semNenhumTeste,
      taxaConclusaoTafPct: total ? Math.round((tafCompleto / total) * 100) : null,
      mediaMilitaresPorDia,
      diasComAplicacao,
    },
    porCategoria: contarPorChave(categoriaItens, ['Oficiais', 'Praças']),
    porSexo: contarPorChave(sexoItens, ['Masculino', 'Feminino']),
    porFaixaEtaria: contarPorChave(faixaItens, FAIXA_ORDEM),
    registrosModalidade: [
      { label: 'Corrida', valor: comCorrida, pct: total ? Math.round((comCorrida / total) * 100) : 0 },
      { label: 'Caminhada', valor: comCaminhada, pct: total ? Math.round((comCaminhada / total) * 100) : 0 },
      { label: 'Natação', valor: comNatacao, pct: total ? Math.round((comNatacao / total) * 100) : 0 },
      {
        label: 'Permanência',
        valor: comPermanencia,
        pct: total ? Math.round((comPermanencia / total) * 100) : 0,
      },
    ],
    corridaVsCaminhada: [
      { label: 'Só corrida', valor: cadastros.filter((c) => temAvaliacaoCorrida(c) && !temAvaliacaoCaminhada(c)).length },
      { label: 'Só caminhada', valor: cadastros.filter((c) => temAvaliacaoCaminhada(c) && !temAvaliacaoCorrida(c)).length },
      { label: 'Ambas', valor: cadastros.filter((c) => temAvaliacaoCorrida(c) && temAvaliacaoCaminhada(c)).length },
      { label: 'Nenhuma', valor: cadastros.filter((c) => !temAvaliacaoCorrida(c) && !temAvaliacaoCaminhada(c)).length },
    ],
    pendenciasModalidade: [
      { label: 'Falta corrida/caminhada', valor: pendCorrida },
      { label: 'Falta natação', valor: pendNatacao },
      { label: 'Falta permanência', valor: pendPermanencia },
    ],
    notasCorrida: contarPorChave(notaCorridaItens, ORDEM_NOTAS),
    notasCaminhada: contarPorChave(notaCaminhadaItens, ORDEM_NOTAS),
    notasNatacao: contarPorChave(notaNatacaoItens, ORDEM_NOTAS),
    permanencia: contarPorChave(permItens, ['Aprovado', 'Reprovado', 'Indefinido']),
    registrosPorData,
    registrosPorMes,
    temposCorrida: resumoTempos(temposC),
    temposCaminhada: resumoTempos(temposCam),
    temposNatacao: resumoTempos(temposN),
    temposPermanencia: resumoTempos(temposP),
    taxas: {
      permanenciaAprovadosPct: permTotal ? Math.round((permAprov / permTotal) * 100) : null,
      corridaSemReprovacaoPct: corridaTotal ? Math.round((corridaOk / corridaTotal) * 100) : null,
      natacaoSemReprovacaoPct: natacaoTotal ? Math.round((natacaoOk / natacaoTotal) * 100) : null,
      caminhadaSemReprovacaoPct: caminhadaTotal ? Math.round((caminhadaOk / caminhadaTotal) * 100) : null,
      corridaNota50PlusPct: corridaTotal ? Math.round((corrida50 / corridaTotal) * 100) : null,
      natacaoNota50PlusPct: natacaoTotal ? Math.round((natacao50 / natacaoTotal) * 100) : null,
      caminhadaNota50PlusPct: caminhadaTotal ? Math.round((caminhada50 / caminhadaTotal) * 100) : null,
      taxaGlobalAprovacaoPct: globalTotal ? Math.round((globalAprov / globalTotal) * 100) : null,
      reprovados2PlusModalidadesPct: comQualquer
        ? Math.round((reprov2Plus / comQualquer) * 100)
        : null,
    },
    topPostosGrad: contarPorChave(postoItens).slice(0, 10),
    desempenhoPorPosto,
    notaMediaCorrida: mediaArr(notasC),
    notaMediaNatacao: mediaArr(notasN),
    notaMediaCaminhada: mediaArr(notasCam),
    notaMediaGeral: mediaArr(todasNotas),
    medianaNotas: mediana(todasNotas),
    notaMediaPorFaixaEtaria,
    notaMediaPorSexo,
    notaMediaPorCategoria,
    aprovacaoPorCategoria: [
      {
        label: 'Oficiais',
        valor: aprovCategoria.Oficiais.ok,
        pct: aprovCategoria.Oficiais.total
          ? Math.round((aprovCategoria.Oficiais.ok / aprovCategoria.Oficiais.total) * 100)
          : 0,
      },
      {
        label: 'Praças',
        valor: aprovCategoria.Praças.ok,
        pct: aprovCategoria.Praças.total
          ? Math.round((aprovCategoria.Praças.ok / aprovCategoria.Praças.total) * 100)
          : 0,
      },
    ],
    heatmapReprovacao,
    rankingTempos: {
      corrida: sortRanking(rankingC),
      caminhada: sortRanking(rankingCam),
      natacao: sortRanking(rankingN),
    },
    operacional: {
      totalSessoes: sessoes.length,
      mediaParticipantesPorSessao: sessoes.length
        ? Math.round((totalParticipantesSessao / sessoes.length) * 10) / 10
        : 0,
      provaMaisAplicada: provaLabels[provaMaisAplicada as TipoProvaAplicada] ?? '—',
      contagemPorProva: contagemProva,
    },
    qualidade: {
      cadastrosIncompletos,
      notasInconsistentes,
      idadeInvalida,
    },
    metaConclusao: {
      metaPct: META_CONCLUSAO_TAF_PCT,
      atualPct,
      faltam,
    },
    cadastrosNovos: {
      ultimos30: 0,
      ultimos90: 0,
      disponivel: false,
    },
  };
}
