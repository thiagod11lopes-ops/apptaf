import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf, TipoProvaAplicada } from '../services/resultadosAplicadosIndexedDb';
import type { NormaTafPreCadastro } from '../services/preCadastroTafStorage';
import type { ResultadoCorridaItem } from '../navigation/types';
import { formatNipInput } from './nipFormat';

export const DEMO_TOTAL_MILITARES = 50;
export const DEMO_TOTAL_CFN = 10;
export const DEMO_TOTAL_FEMININO = 20;
export const DEMO_PCT_COMPLETO = 0.75;

function escalaDemo(total: number, referencia: number): number {
  if (total <= 0) return 0;
  return Math.min(total, Math.max(0, Math.round((referencia / DEMO_TOTAL_MILITARES) * total)));
}

function indicesFemininos(total: number): Set<number> {
  const alvo = escalaDemo(total, DEMO_TOTAL_FEMININO);
  const indices = new Set<number>();
  for (let k = 0; k < alvo; k += 1) {
    indices.add(Math.floor((k * total) / alvo));
  }
  return indices;
}

const PRACAS = ['MN', 'CB', 'CA', 'SG', 'SO', '1T', '2T', '3T'] as const;
const NOMES_M = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Costa', 'Almeida', 'Pereira', 'Rodrigues'];
const NOMES_F = ['Maria', 'Ana', 'Juliana', 'Fernanda', 'Patricia', 'Camila', 'Beatriz', 'Larissa', 'Mariana'];

function seeded(i: number, salt: number): number {
  return ((i * 9301 + salt * 49297) % 233280) / 233280;
}

function pickInt(i: number, salt: number, min: number, max: number): number {
  return min + Math.floor(seeded(i, salt) * (max - min + 1));
}

function dataDemonstracao(i: number, salt: number): string {
  const dayOffset = pickInt(i, salt, 0, 91);
  const month = dayOffset < 31 ? 7 : dayOffset < 62 ? 8 : 9;
  const day = dayOffset < 31 ? dayOffset + 1 : dayOffset < 62 ? dayOffset - 30 : dayOffset - 61;
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/2026`;
}

function brToIso(dataBr: string, hour: number): string {
  const [d, m, y] = dataBr.split('/').map(Number);
  return new Date(y, m - 1, d, hour, 0, 0, 0).toISOString();
}

function tempoMsCorrida(i: number): number {
  return (12 * 60 + pickInt(i, 20, 0, 360)) * 1000;
}

function tempoMsNatacao(i: number): number {
  return (60 + pickInt(i, 21, 0, 90)) * 1000;
}

function tempoMsCaminhada(i: number): number {
  return (32 * 60 + pickInt(i, 22, 0, 780)) * 1000;
}

function notaAprovada(i: number, salt: number): string {
  return String(pickInt(i, salt, 55, 100));
}

type SessaoBucket = {
  dataAplicacao: string;
  tipoProva: TipoProvaAplicada;
  normaTaf: NormaTafPreCadastro;
  criadoEm: string;
  resultados: ResultadoCorridaItem[];
};

function bucketKey(data: string, tipo: TipoProvaAplicada, norma: NormaTafPreCadastro): string {
  return `${data}|${tipo}|${norma}`;
}

function addSessaoParticipante(
  buckets: Map<string, SessaoBucket>,
  cadastro: CadastroItemPersist,
  corredor: number,
  data: string,
  tipo: TipoProvaAplicada,
  norma: NormaTafPreCadastro,
  resultado: Omit<ResultadoCorridaItem, 'corredor' | 'nome' | 'nip' | 'prova'>,
): void {
  const key = bucketKey(data, tipo, norma);
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = {
      dataAplicacao: data,
      tipoProva: tipo,
      normaTaf: norma,
      criadoEm: brToIso(data, 8 + (buckets.size % 10)),
      resultados: [],
    };
    buckets.set(key, bucket);
  }
  bucket.resultados.push({
    corredor,
    nome: cadastro.nome,
    nip: cadastro.nip,
    prova: tipo,
    ...resultado,
  });
}

function preencherArmada(
  c: CadastroItemPersist,
  i: number,
  completo: boolean,
  buckets: Map<string, SessaoBucket>,
): void {
  const usaCaminhada = seeded(i, 31) < 0.28;
  const temCorrida = completo || seeded(i, 41) < 0.55;
  const temNatacao = completo || seeded(i, 42) < 0.45;
  const temPerm = completo || seeded(i, 43) < 0.4;

  if (temCorrida && usaCaminhada) {
    const data = dataDemonstracao(i, 1);
    c.dataTafCaminhada = data;
    c.tempoCaminhada = `${32 + pickInt(i, 44, 0, 12)}:${String(pickInt(i, 45, 0, 59)).padStart(2, '0')}`;
    c.notaCaminhada = notaAprovada(i, 46);
    c.modalidadeDistanciaAtiva = 'caminhada';
    addSessaoParticipante(buckets, c, i + 1, data, 'caminhada', 'armada', {
      tempoMs: tempoMsCaminhada(i),
      notaTexto: c.notaCaminhada,
    });
  } else if (temCorrida) {
    const data = dataDemonstracao(i, 2);
    c.dataTafCorrida = data;
    c.tempoCorrida = `${12 + pickInt(i, 47, 0, 6)}:${String(pickInt(i, 48, 0, 59)).padStart(2, '0')}`;
    c.notaCorrida = notaAprovada(i, 49);
    c.modalidadeDistanciaAtiva = 'corrida';
    addSessaoParticipante(buckets, c, i + 1, data, 'corrida', 'armada', {
      tempoMs: tempoMsCorrida(i),
      notaTexto: c.notaCorrida,
    });
  }

  if (temNatacao) {
    const data = dataDemonstracao(i, 3);
    c.dataTafNatacao = data;
    c.tempoNatacao = `${1 + pickInt(i, 50, 0, 1)}:${String(pickInt(i, 51, 0, 59)).padStart(2, '0')}`;
    c.notaNatacao = notaAprovada(i, 52);
    c.resultadoNatacao = 'aprovado';
    addSessaoParticipante(buckets, c, i + 1, data, 'natacao', 'armada', {
      tempoMs: tempoMsNatacao(i),
      notaTexto: c.notaNatacao,
    });
  }

  if (temPerm) {
    const data = dataDemonstracao(i, 4);
    c.dataTafPermanencia = data;
    c.tempoPermanencia = '10:00';
    c.resultadoPermanencia = 'aprovado';
    addSessaoParticipante(buckets, c, i + 1, data, 'permanencia', 'armada', {
      tempoMs: 10 * 60 * 1000,
      notaTexto: 'Aprovado',
    });
  }
}

function preencherCfn(
  c: CadastroItemPersist,
  i: number,
  completo: boolean,
  buckets: Map<string, SessaoBucket>,
): void {
  const flags = {
    corrida: completo || seeded(i, 61) < 0.55,
    natacao: completo || seeded(i, 62) < 0.5,
    flexBarra: completo || seeded(i, 63) < 0.45,
    flexSolo: completo || seeded(i, 64) < 0.42,
    abdRem: completo || seeded(i, 65) < 0.4,
    abdPrancha: completo || seeded(i, 66) < 0.38,
    perm: completo || seeded(i, 67) < 0.35,
  };

  if (flags.corrida) {
    const data = dataDemonstracao(i, 5);
    c.dataTafCorrida = data;
    c.tempoCorrida = `${13 + pickInt(i, 68, 0, 5)}:${String(pickInt(i, 69, 0, 59)).padStart(2, '0')}`;
    c.notaCorrida = notaAprovada(i, 70);
    addSessaoParticipante(buckets, c, i + 1, data, 'corrida', 'cfn', {
      tempoMs: tempoMsCorrida(i) + 60_000,
      notaTexto: c.notaCorrida,
    });
  }

  if (flags.natacao) {
    const data = dataDemonstracao(i, 6);
    c.dataTafNatacao = data;
    c.tempoNatacao = `0:${String(45 + pickInt(i, 71, 0, 35)).padStart(2, '0')}`;
    c.notaNatacao = notaAprovada(i, 72);
    addSessaoParticipante(buckets, c, i + 1, data, 'natacao', 'cfn', {
      tempoMs: (45 + pickInt(i, 73, 0, 35)) * 1000,
      notaTexto: c.notaNatacao,
    });
  }

  if (flags.flexBarra) {
    const data = dataDemonstracao(i, 7);
    c.repsFlexaoBarra = pickInt(i, 74, 8, 28);
    c.notaFlexaoBarra = notaAprovada(i, 75);
    c.dataTafFlexaoBarra = data;
    addSessaoParticipante(buckets, c, i + 1, data, 'flexao_barra', 'cfn', {
      tempoMs: 0,
      desempenhoTexto: String(c.repsFlexaoBarra),
      notaTexto: c.notaFlexaoBarra,
    });
  }

  if (flags.flexSolo) {
    const data = dataDemonstracao(i, 8);
    c.repsFlexaoSolo = pickInt(i, 76, 15, 45);
    c.notaFlexaoSolo = notaAprovada(i, 77);
    c.dataTafFlexaoSolo = data;
    addSessaoParticipante(buckets, c, i + 1, data, 'flexao_solo', 'cfn', {
      tempoMs: 0,
      desempenhoTexto: String(c.repsFlexaoSolo),
      notaTexto: c.notaFlexaoSolo,
    });
  }

  if (flags.abdRem) {
    const data = dataDemonstracao(i, 9);
    c.repsAbdominalRemador = pickInt(i, 78, 20, 60);
    c.notaAbdominalRemador = notaAprovada(i, 79);
    c.dataTafAbdominalRemador = data;
    addSessaoParticipante(buckets, c, i + 1, data, 'abdominal_remador', 'cfn', {
      tempoMs: 0,
      desempenhoTexto: String(c.repsAbdominalRemador),
      notaTexto: c.notaAbdominalRemador,
    });
  }

  if (flags.abdPrancha) {
    const data = dataDemonstracao(i, 10);
    c.tempoAbdominalPrancha = `${pickInt(i, 80, 2, 4)}:${String(pickInt(i, 81, 0, 59)).padStart(2, '0')}`;
    c.notaAbdominalPrancha = notaAprovada(i, 82);
    c.dataTafAbdominalPrancha = data;
    addSessaoParticipante(buckets, c, i + 1, data, 'abdominal_prancha', 'cfn', {
      tempoMs: (120 + pickInt(i, 83, 0, 120)) * 1000,
      desempenhoTexto: c.tempoAbdominalPrancha,
      notaTexto: c.notaAbdominalPrancha,
    });
  }

  if (flags.perm) {
    const data = dataDemonstracao(i, 11);
    c.dataTafPermanencia = data;
    c.tempoPermanencia = '10:00';
    c.resultadoPermanencia = 'aprovado';
    addSessaoParticipante(buckets, c, i + 1, data, 'permanencia', 'cfn', {
      tempoMs: 10 * 60 * 1000,
      notaTexto: 'Aprovado',
    });
  }
}

export type DadosDemonstracaoTaf = {
  cadastros: CadastroItemPersist[];
  sessoes: SessaoAplicacaoTaf[];
  stats: {
    total: number;
    feminino: number;
    cfn: number;
    completos: number;
  };
};

export function gerarDadosDemonstracaoTaf(total = DEMO_TOTAL_MILITARES): DadosDemonstracaoTaf {
  const cadastros: CadastroItemPersist[] = [];
  const buckets = new Map<string, SessaoBucket>();
  const femininos = indicesFemininos(total);
  const totalCfn = escalaDemo(total, DEMO_TOTAL_CFN);
  let feminino = 0;
  let cfn = 0;
  let completos = 0;

  for (let i = 0; i < total; i += 1) {
    const isFemale = femininos.has(i);
    const isCfn = i < totalCfn;
    const completo = seeded(i, 3) < DEMO_PCT_COMPLETO;
    if (isFemale) feminino += 1;
    if (isCfn) cfn += 1;
    if (completo) completos += 1;

    const nomeBase = isFemale ? NOMES_F[i % NOMES_F.length] : NOMES_M[i % NOMES_M.length];
    const cadastro: CadastroItemPersist = {
      id: `demo-cad-${i}`,
      nip: formatNipInput(String(10_000_000 + i)),
      nome: `${nomeBase} Demo ${i + 1}`,
      dataNascimento: dataDemonstracao(i, 99),
      categoria: 'Praças',
      sexo: isFemale ? 'F' : 'M',
      praca: PRACAS[i % PRACAS.length],
      updatedAt: Date.now() - i,
    };

    if (isCfn) {
      preencherCfn(cadastro, i, completo, buckets);
    } else {
      preencherArmada(cadastro, i, completo, buckets);
    }

    cadastros.push(cadastro);
  }

  const sessoes: SessaoAplicacaoTaf[] = [];
  let sessIdx = 0;
  for (const bucket of buckets.values()) {
    if (bucket.resultados.length === 0) continue;
    sessoes.push({
      id: `demo-sess-${sessIdx++}`,
      criadoEm: bucket.criadoEm,
      dataAplicacao: bucket.dataAplicacao,
      tipoProva: bucket.tipoProva,
      normaTaf: bucket.normaTaf,
      resultados: bucket.resultados,
      updatedAt: Date.parse(bucket.criadoEm) || Date.now(),
    });
  }

  sessoes.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));

  return {
    cadastros,
    sessoes,
    stats: { total, feminino, cfn, completos },
  };
}
