import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';

export function dataNascimentoCadastroValida(data: string): boolean {
  return /^\d{2}\/\d{2}\/\d{4}$/.test((data || '').trim());
}

export function sexoCadastroValido(sexo?: 'M' | 'F'): boolean {
  return sexo === 'M' || sexo === 'F';
}

export function cadastroPrecisaCompletarDadosTaf(c: CadastroItemPersist): boolean {
  return !dataNascimentoCadastroValida(c.dataNascimento) || !sexoCadastroValido(c.sexo);
}
