export const TZ = "America/Sao_Paulo";

export function formatDateTime(
  date: string | Date | null | undefined,
  opts?: Intl.DateTimeFormatOptions
): string {
  if (!date) return "—";
  try {
    return new Date(date).toLocaleString("pt-BR", {
      timeZone: TZ,
      ...opts,
    });
  } catch { return "—"; }
}

export function formatDate(
  date: string | Date | null | undefined
): string {
  if (!date) return "—";
  try {
    return new Date(date).toLocaleDateString("pt-BR", {
      timeZone: TZ,
    });
  } catch { return "—"; }
}

export function formatTime(
  date: string | Date | null | undefined
): string {
  if (!date) return "—";
  try {
    return new Date(date).toLocaleTimeString("pt-BR", {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch { return "—"; }
}

export function formatDateShort(
  date: string | Date | null | undefined
): string {
  if (!date) return "—";
  try {
    return new Date(date).toLocaleDateString("pt-BR", {
      timeZone: TZ,
      day: "2-digit",
      month: "2-digit",
    });
  } catch { return "—"; }
}
