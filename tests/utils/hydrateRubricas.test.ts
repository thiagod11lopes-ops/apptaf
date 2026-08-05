import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../src/offline-first/db/localDbRubricas', () => ({
  getCadastroRubricasLocal: vi.fn(),
  getSessaoRubricasLocal: vi.fn(),
}));

vi.mock('../../src/offline-first/db/localDb', () => ({
  getAplicadorRaw: vi.fn(),
}));

import { getSessaoRubricasLocal } from '../../src/offline-first/db/localDbRubricas';
import { getAplicadorRaw } from '../../src/offline-first/db/localDb';
import { hydrateSessaoComRubricas } from '../../src/utils/hydrateRubricas';
import type { SessaoAplicacaoTaf } from '../../src/services/resultadosAplicadosIndexedDb';

const png = 'data:image/png;base64,AAA';
const webp = 'data:image/webp;base64,BBB';

describe('hydrateSessaoComRubricas', () => {
  beforeEach(() => {
    vi.mocked(getSessaoRubricasLocal).mockReset();
    vi.mocked(getAplicadorRaw).mockReset();
  });

  it('reaplica rúbricas por NIP com formatação diferente e aplicador da side table', async () => {
    vi.mocked(getSessaoRubricasLocal).mockResolvedValue({
      id: 's1',
      ownerUid: 'u',
      updatedAt: 1,
      resultados: [
        { nip: '11111111', prova: 'corrida', rubricaCandidatoSvg: png },
      ],
      aplicadorRubricaSvg: webp,
    });

    const sessao = {
      id: 's1',
      criadoEm: '',
      dataAplicacao: '',
      tipoProva: 'corrida',
      resultados: [
        {
          corredor: 1,
          nome: 'A',
          nip: '11.1111.11',
          tempoMs: 0,
          rubricaCandidatoSvg: 'Rubricado Digitalmente',
        },
      ],
      aplicadorAssinatura: {
        aplicadorId: 'ap1',
        nome: 'Aplicador',
        nip: '99',
        categoria: 'Oficiais',
        postoGrad: 'CT',
        rubricaSvg: 'Rubricado Digitalmente',
      },
    } as SessaoAplicacaoTaf;

    const out = await hydrateSessaoComRubricas(sessao);
    expect(out.resultados[0]?.rubricaCandidatoSvg).toBe(png);
    expect(out.aplicadorAssinatura?.rubricaSvg).toBe(webp);
  });

  it('usa rúbrica do cadastro de aplicador quando side table não tem', async () => {
    vi.mocked(getSessaoRubricasLocal).mockResolvedValue(null);
    vi.mocked(getAplicadorRaw).mockResolvedValue({
      id: 'ap1',
      rubricaSvg: png,
    } as Awaited<ReturnType<typeof getAplicadorRaw>>);

    const sessao = {
      id: 's2',
      criadoEm: '',
      dataAplicacao: '',
      tipoProva: 'natacao',
      resultados: [],
      aplicadorAssinatura: {
        aplicadorId: 'ap1',
        nome: 'Aplicador',
        nip: '99',
        categoria: 'Oficiais',
        postoGrad: 'CT',
        rubricaSvg: 'Rubricado Digitalmente',
      },
    } as SessaoAplicacaoTaf;

    const out = await hydrateSessaoComRubricas(sessao);
    expect(out.aplicadorAssinatura?.rubricaSvg).toBe(png);
  });
});
