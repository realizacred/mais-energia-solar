/**
 * formatDiasParado — converte número fracionário de dias em rótulo humano.
 *
 * Exemplos:
 *  - null/undefined → "—"
 *  - < 1            → "Hoje"
 *  - 2.19           → "2 dias"
 *  - 32             → "1 mês e 2 dias"
 *  - 832.30         → "2 anos e 3 meses"
 */
export function formatDiasParado(dias: number | null | undefined): string {
  if (dias == null || Number.isNaN(Number(dias))) return "—";
  const d = Math.floor(Number(dias));
  if (d < 1) return "Hoje";
  if (d === 1) return "1 dia";
  if (d < 30) return `${d} dias`;

  const meses = Math.floor(d / 30);
  const restoDias = d % 30;

  if (meses < 12) {
    if (restoDias === 0) return meses === 1 ? "1 mês" : `${meses} meses`;
    return meses === 1
      ? `1 mês e ${restoDias} ${restoDias === 1 ? "dia" : "dias"}`
      : `${meses} meses e ${restoDias} ${restoDias === 1 ? "dia" : "dias"}`;
  }

  const anos = Math.floor(meses / 12);
  const restoMeses = meses % 12;
  if (restoMeses === 0) return anos === 1 ? "1 ano" : `${anos} anos`;
  return anos === 1
    ? `1 ano e ${restoMeses} ${restoMeses === 1 ? "mês" : "meses"}`
    : `${anos} anos e ${restoMeses} ${restoMeses === 1 ? "mês" : "meses"}`;
}

/** Versão compacta para tabelas: "2d", "1m", "2a3m". */
export function formatDiasParadoCompact(dias: number | null | undefined): string {
  if (dias == null || Number.isNaN(Number(dias))) return "—";
  const d = Math.floor(Number(dias));
  if (d < 1) return "hoje";
  if (d < 30) return `${d}d`;
  const meses = Math.floor(d / 30);
  if (meses < 12) return `${meses}m`;
  const anos = Math.floor(meses / 12);
  const restoMeses = meses % 12;
  return restoMeses === 0 ? `${anos}a` : `${anos}a${restoMeses}m`;
}
