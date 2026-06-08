import type { CadastroItemPersist } from '../cadastrosIndexedDb';
import { getAllCadastros } from '../cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../resultadosAplicadosIndexedDb';
import { getAllSessoesAplicacao } from '../resultadosAplicadosIndexedDb';
import { waitForAuthUid } from './authUid';
import { getAllCadastrosFirestoreWithProgress } from './cadastrosFirestore';
import { getAllSessoesFirestore } from './sessoesFirestore';

export type CloudDataLoadState = {
  percent: number;
  loading: boolean;
  loadedCadastros: number;
  loadedSessoes: number;
};

const CADASTROS_SHARE = 88;
const SESSOES_START = 88;
const SESSOES_DONE = 100;

function cadastrosPercent(loaded: number, isLastBatch: boolean): number {
  if (isLastBatch) return CADASTROS_SHARE;
  if (loaded <= 0) return 4;
  const estimate = loaded + 250;
  return Math.min(CADASTROS_SHARE - 2, 4 + Math.round((loaded / estimate) * (CADASTROS_SHARE - 6)));
}

export async function loadCloudDataWithProgress(
  onProgress: (state: CloudDataLoadState) => void,
): Promise<{ cadastros: CadastroItemPersist[]; sessoes: SessaoAplicacaoTaf[] }> {
  onProgress({
    percent: 1,
    loading: true,
    loadedCadastros: 0,
    loadedSessoes: 0,
  });

  const uid = await waitForAuthUid();

  if (!uid) {
    onProgress({ percent: 40, loading: true, loadedCadastros: 0, loadedSessoes: 0 });
    const [cadastros, sessoes] = await Promise.all([getAllCadastros(), getAllSessoesAplicacao()]);
    onProgress({
      percent: 100,
      loading: false,
      loadedCadastros: cadastros.length,
      loadedSessoes: sessoes.length,
    });
    return { cadastros, sessoes };
  }

  const cadastros = await getAllCadastrosFirestoreWithProgress(uid, ({ loaded, isLastBatch }) => {
    onProgress({
      percent: cadastrosPercent(loaded, isLastBatch),
      loading: true,
      loadedCadastros: loaded,
      loadedSessoes: 0,
    });
  });

  onProgress({
    percent: SESSOES_START,
    loading: true,
    loadedCadastros: cadastros.length,
    loadedSessoes: 0,
  });

  const sessoes = await getAllSessoesFirestore(uid);

  onProgress({
    percent: SESSOES_DONE,
    loading: false,
    loadedCadastros: cadastros.length,
    loadedSessoes: sessoes.length,
  });

  return { cadastros, sessoes };
}
