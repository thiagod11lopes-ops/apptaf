import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';

export function dataNascimentoCadastroValida(data: string): boolean {
  return /^\d{2}\/\d{2}\/\d{4}$/.test((data || '').trim());
}

export function sexoCadastroValido(sexo?: 'M' | 'F'): boolean {
  return sexo === 'M' || sexo === 'F';
}

export function vinculoCadastroValido(
  vinculo?: CadastroItemPersist['vinculo'] | null,
): vinculo is 'carreira' | 'rm2' {
  return vinculo === 'carreira' || vinculo === 'rm2';
}

export function cadastroPrecisaVinculo(c: Pick<CadastroItemPersist, 'vinculo'>): boolean {
  return !vinculoCadastroValido(c.vinculo);
}

export function cadastroPrecisaCompletarDadosTaf(
  c: CadastroItemPersist,
  opts?: { exigirVinculo?: boolean },
): boolean {
  const exigirVinculo = opts?.exigirVinculo !== false;
  return (
    !dataNascimentoCadastroValida(c.dataNascimento) ||
    !sexoCadastroValido(c.sexo) ||
    (exigirVinculo && cadastroPrecisaVinculo(c))
  );
}
