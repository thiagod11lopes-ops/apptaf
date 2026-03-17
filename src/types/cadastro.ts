import type { Posto } from '../constants/postos';
import type { Graduacao } from '../constants/graduacoes';

export type CategoriaCadastro = 'Oficial' | 'Praça';

export interface CadastroItem {
  id: string;
  categoria: CategoriaCadastro;
  postoOuGraduacao: Posto | Graduacao;
  nip: string;
  nome: string;
  data: string;
  createdAt: number;
}
