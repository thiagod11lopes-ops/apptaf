import { describe, expect, it } from 'vitest';
import {
  contarReservasAtivasPorSlotId,
  mapearContagemReservasRpc,
  vagasRestantes,
} from '../../src/utils/agendamentoVagasContagem';

describe('agendamentoVagasContagem', () => {
  it('mapeia RPC contar_reservas_por_slot', () => {
    expect(
      mapearContagemReservasRpc([
        { slot_id: 'a', total: 3 },
        { slot_id: 'b', total: '5' },
        { slot_id: '', total: 9 },
      ]),
    ).toEqual({ a: 3, b: 5 });
  });

  it('conta só reservas ativas locais', () => {
    expect(
      contarReservasAtivasPorSlotId([
        { slotId: 'a' },
        { slotId: 'a', deleted: true },
        { slotId: 'b' },
        { slotId: 'a' },
      ]),
    ).toEqual({ a: 2, b: 1 });
  });

  it('vagasRestantes = máx − agendados (nunca negativo)', () => {
    expect(vagasRestantes(10, 3)).toBe(7);
    expect(vagasRestantes(10, 10)).toBe(0);
    expect(vagasRestantes(10, 15)).toBe(0);
    expect(vagasRestantes(0, 2)).toBe(0);
  });
});
