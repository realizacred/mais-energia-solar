/**
 * useGoogleCalendarSync — DISABLED
 * Google Calendar integration was removed.
 * This hook is kept as a no-op to avoid breaking existing consumers.
 */
export function useGoogleCalendarSync() {
  const syncEvent = async (..._args: any[]) => null;
  const syncServico = async (..._args: any[]) => null;

  return { syncEvent, syncServico };
}
