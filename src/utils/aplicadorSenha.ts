import * as Crypto from 'expo-crypto';
import type { AplicadorItemPersist } from '../services/aplicadoresIndexedDb';

export async function hashAplicadorSenha(senha: string): Promise<string> {
  const normalizada = senha.trim();
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
