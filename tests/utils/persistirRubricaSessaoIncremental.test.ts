import { describe, expect, it } from 'vitest';
import type { ResultadoCorridaItem } from '../../src/navigation/types';
import { RUBRICADO_DIGITALMENTE } from '../../src/utils/rubricaPresence';
import { resultadoParaSessaoRubricaSideTable } from '../../src/utils/persistirRubricaSessaoIncremental';

const svg = 'data:image/svg+xml;utf8,%3Csvg%3E';

function resultado(partial: Partial<ResultadoCorridaItem> = {}): ResultadoCorridaItem {
  return {
    corredor: 1,
    nome: 'SILVA',
    nip: '12.3456.78',
    tempoMs: 0,
    ...partial,
  };
}

describe('resultadoParaSessaoRubricaSideTable', () => {
  it('grava SVG do candidato confirmado com a prova da sessão', () => {
    expect(resultadoParaSessaoRubricaSideTable(resultado({ rubricaCandidatoSvg: svg }), 'natacao')).toEqual({
      nip: '12.3456.78',
      prova: 'natacao',
      rubricaCandidatoSvg: svg,
    });
  });

  it('usa prova do resultado quando existir', () => {
    const row = resultadoParaSessaoRubricaSideTable(
      resultado({ prova: 'caminhada', rubricaCandidatoSvg: svg }),
      'corrida',
    );
    expect(row?.prova).toBe('caminhada');
  });

  it('ignora marcador, vazio e sem NIP', () => {
    expect(
      resultadoParaSessaoRubricaSideTable(
        resultado({ rubricaCandidatoSvg: RUBRICADO_DIGITALMENTE }),
        'corrida',
      ),
    ).toBeNull();
    expect(resultadoParaSessaoRubricaSideTable(resultado(), 'corrida')).toBeNull();
    expect(
      resultadoParaSessaoRubricaSideTable(
        resultado({ nip: '', rubricaCandidatoSvg: svg }),
        'corrida',
      ),
    ).toBeNull();
  });
});
