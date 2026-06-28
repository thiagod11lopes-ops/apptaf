import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';

export type FiltroModalidadeTaf = 'Todos' | 'corrida' | 'natacao' | 'permanencia';

/** Data de hoje em DD/MM/AAAA (registro de aplicação do TAF). */
export function dataHojeBr(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function dataBrParaIso(dataBr: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dataBr.trim());
  if (!m) return null;
  const dd = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  const yyyy = parseInt(m[3], 10);
  const dt = new Date(yyyy, mm - 1, dd);
  if (dt.getFullYear() !== yyyy || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) return null;
  return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

export function dataIsoParaBr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function tempos(c: CadastroItemPersist) {
  const x = c as CadastroItemPersist & { tempo?: string };
  return {
    corrida: (c.tempoCorrida ?? x.tempo ?? '').trim(),
    caminhada: (c.tempoCaminhada ?? '').trim(),
    natacao: (c.tempoNatacao ?? '').trim(),
  };
}

/** Militar com registro na modalidade selecionada. */
export function temRegistroModalidade(
  c: CadastroItemPersist,
  modalidade: FiltroModalidadeTaf,
): boolean {
  const t = tempos(c);
  switch (modalidade) {
    case 'corrida':
      return !!(
        t.corrida ||
        t.caminhada ||
        (c.notaCorrida || '').trim() ||
        (c.notaCaminhada || '').trim()
      );
    case 'natacao':
      return !!(t.natacao || (c.notaNatacao || '').trim());
    case 'permanencia':
      return !!(
        c.resultadoPermanencia ||
        c.resultadoNatacao ||
        (c.tempoPermanencia || '').trim()
      );
    case 'Todos':
    default:
      return (
        !!t.corrida ||
        !!t.caminhada ||
        !!t.natacao ||
        !!(c.notaCorrida || '').trim() ||
        !!(c.notaCaminhada || '').trim() ||
        !!(c.notaNatacao || '').trim() ||
        !!c.resultadoPermanencia ||
        !!c.resultadoNatacao ||
        !!(c.tempoPermanencia || '').trim()
      );
  }
}

function datasModalidade(c: CadastroItemPersist, modalidade: FiltroModalidadeTaf): string[] {
  switch (modalidade) {
    case 'corrida': {
      const datas = [c.dataTafCorrida, c.dataTafCaminhada].filter(
        (d): d is string => !!d?.trim(),
      );
      return datas;
    }
    case 'natacao':
      return c.dataTafNatacao ? [c.dataTafNatacao] : [];
    case 'permanencia':
      return c.dataTafPermanencia ? [c.dataTafPermanencia] : [];
    case 'Todos':
    default:
      return [c.dataTafCorrida, c.dataTafCaminhada, c.dataTafNatacao, c.dataTafPermanencia].filter(
        (d): d is string => !!d?.trim(),
      );
  }
}

export function dataRegistroCoincide(
  c: CadastroItemPersist,
  modalidade: FiltroModalidadeTaf,
  dataBr: string,
): boolean {
  const alvo = dataBr.trim();
  if (!alvo) return true;
  return datasModalidade(c, modalidade).some((d) => d === alvo);
}

export function dataExibicaoRegistro(
  c: CadastroItemPersist,
  modalidade: FiltroModalidadeTaf,
): string {
  const d = datasModalidade(c, modalidade);
  return d[0] || '-';
}
