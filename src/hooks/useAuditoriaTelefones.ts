/**
 * useAuditoriaTelefones — alimenta a página de auditoria de telefones.
 * Lê a view `v_auditoria_telefones` (criada via migration 2026-05-01).
 * RB-62: classifica registros como ok/corrigivel/invalido/vazio.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StatusPhone = "ok" | "corrigivel" | "invalido" | "vazio";

export interface AuditoriaTelefoneRow {
  tabela: "clientes" | "leads" | "consultores" | "fornecedores";
  registro_id: string;
  tenant_id: string | null;
  rotulo: string | null;
  telefone_atual: string | null;
  telefone_normalized: string | null;
  telefone_sugerido: string | null;
  status_phone: StatusPhone;
}

export function useAuditoriaTelefones() {
  return useQuery({
    queryKey: ["auditoria-telefones"],
    queryFn: async (): Promise<AuditoriaTelefoneRow[]> => {
      const { data, error } = await supabase
        .from("v_auditoria_telefones" as any)
        .select("*")
        .order("tabela");
      if (error) throw error;
      return ((data ?? []) as unknown) as AuditoriaTelefoneRow[];
    },
    staleTime: 30_000,
  });
}
