import * as Crypto from 'expo-crypto';
import type { AplicadorItemPersist } from '../services/aplicadoresIndexedDb';
import {
  formatSenhaAplicadorInput,
  isSenhaAplicadorValid,
  SENHA_APLICADOR_LENGTH,
} from './aplicadorSenhaFormat';

export { formatSenhaAplicadorInput, isSenhaAplicadorValid, SENHA_APLICADOR_LENGTH };

export async function hashAplicadorSenha(senha: string): Promise<string> {
  const normalizada = formatSenhaAplicadorInput(senha);
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, normalizada);
}

export async function verificarSenhaAplicador(
  senha: string,
  senhaHash: string | undefined,
): Promise<boolean> {
  if (!senhaHash?.trim()) return false;
  const hash = await hashAplicadorSenha(senha);
  return hash === senhaHash;
}

export async function encontrarAplicadorPorSenha(
  senha: string,
  aplicadores: AplicadorItemPersist[],
): Promise<AplicadorItemPersist | null> {
  for (const aplicador of aplicadores) {
    if (await verificarSenhaAplicador(senha, aplicador.senhaHash)) {
      return aplicador;
    }
  }
  return null;
}
