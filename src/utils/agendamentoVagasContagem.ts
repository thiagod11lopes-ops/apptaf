/**
 * Contagem de vagas / agendados alinhada entre admin e página pública.
 * Regra: agendados + vagasRestantes = maxParticipantes (quando não lotado além do máx.).
 */

export type ContagemReservasRpcRow = {
  slot_id?: string | null;
  total?: number | string | null;
};

/** Converte o retorno de `contar_reservas_por_slot` em mapa slotId → total. */
export function mapearContagemReservasRpc(
  rows: ContagemReservasRpcRow[] | null | undefined,
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!rows?.length) return out;
  for (const row of rows) {
    const id = String(row.slot_id ?? '').trim();
    if (!id) continue;
    const n = Number(row.total);
    out[id] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }
  return out;
}

/** Conta reservas ativas locais por slotId. */
export function contarReservasAtivasPorSlotId(
  reservas: Array<{ slotId?: string | null; deleted?: boolean }>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of reservas) {
    if (r.deleted === true) continue;
    const id = String(r.slotId ?? '').trim();
    if (!id) continue;
    out[id] = (out[id] ?? 0) + 1;
  }
  return out;
}

export function vagasRestantes(maxParticipantes: number, agendados: number): number {
  const max = Math.max(0, Math.floor(Number(maxParticipantes) || 0));
  const used = Math.max(0, Math.floor(Number(agendados) || 0));
  return Math.max(0, max - used);
}
