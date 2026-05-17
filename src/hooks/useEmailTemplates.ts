import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { emailTemplateService, type EmailTemplate } from "@/services/admin/emailTemplateService";

const STALE_TIME = 1000 * 60 * 5;
const QUERY_KEY = ["proposta-email-templates"];

export type { EmailTemplate };

export function useEmailTemplatesList() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => emailTemplateService.fetchAll(),
    staleTime: STALE_TIME,
  });
}

export function useSaveEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id?: string; data: Record<string, any> }) => 
      emailTemplateService.save(payload.id, payload.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useDeleteEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => emailTemplateService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useDuplicateEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, any>) => emailTemplateService.duplicate(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
}
