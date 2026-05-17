// §16: Queries só em hooks — NUNCA em componentes
// §23: staleTime obrigatório

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { customerService } from "@/services/admin/customers/customerService";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;
const QUERY_KEY = "clientes" as const;
const LEADS_KEY = "leads-for-clientes" as const;

export interface ClienteRow {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  empresa: string | null;
  cpf_cnpj: string | null;
  data_nascimento: string | null;
  cep: string | null;
  estado: string | null;
  cidade: string | null;
  bairro: string | null;
  rua: string | null;
  numero: string | null;
  complemento: string | null;
  potencia_kwp: number | null;
  valor_projeto: number | null;
  data_instalacao: string | null;
  numero_placas: number | null;
  modelo_inversor: string | null;
  observacoes: string | null;
  lead_id: string | null;
  localizacao: string | null;
  ativo: boolean;
  created_at: string;
  identidade_urls: string[] | null;
  comprovante_endereco_urls: string[] | null;
  comprovante_beneficiaria_urls: string[] | null;
  disjuntor_id: string | null;
  transformador_id: string | null;
  telefone_normalized: string | null;
  cliente_code: string | null;
}

export interface LeadOption {
  id: string;
  nome: string;
  telefone: string;
  lead_code: string | null;
}

export function useClientes() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: () => customerService.fetchAll(),
    staleTime: STALE_TIME,
  });
}


export function useLeadsForClientes() {
  return useQuery({
    queryKey: [LEADS_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, nome, telefone, lead_code")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as LeadOption[];
    },
    staleTime: STALE_TIME,
  });
}

/**
 * Erro de duplicidade detectado antes do INSERT.
 */
export class DuplicateClienteError extends Error {
  kind: "block" | "sm-warning";
  field: "cpf_cnpj" | "email";
  existing: { id: string; nome: string; cpf_cnpj: string | null; email: string | null; is_sm_migrado: boolean };
  constructor(
    kind: "block" | "sm-warning",
    field: "cpf_cnpj" | "email",
    existing: DuplicateClienteError["existing"],
    message: string,
  ) {
    super(message);
    this.name = "DuplicateClienteError";
    this.kind = kind;
    this.field = field;
    this.existing = existing;
  }
}

export function useSalvarCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
      allowSmDuplicate = false,
    }: {
      id?: string;
      data: Record<string, any>;
      allowSmDuplicate?: boolean;
    }) => {
      const payload = { ...data };
      if (payload.telefone) {
        payload.telefone_normalized = normalizePhone(String(payload.telefone));
      }

      if (id) {
        return customerService.save(id, payload);
      }

      // ---- Dedup check (apenas em INSERT) ----
      const cpfDigits = data.cpf_cnpj ? onlyDigits(String(data.cpf_cnpj)) : "";
      const emailNorm = data.email ? String(data.email).trim().toLowerCase() : "";

      if (cpfDigits || emailNorm) {
        const { data: candidates, error: dupErr } = await supabase
          .from("clientes")
          .select("id, nome, cpf_cnpj, email, is_sm_migrado")
          .or(
            [
              cpfDigits ? `cpf_cnpj.ilike.%${cpfDigits.slice(-11)}%` : null,
              emailNorm ? `email.ilike.${emailNorm}` : null,
            ]
              .filter(Boolean)
              .join(","),
          )
          .limit(20);
        if (dupErr) throw dupErr;

        const matches = (candidates || []).filter((c: any) => {
          const cCpf = c.cpf_cnpj ? onlyDigits(c.cpf_cnpj) : "";
          const cEmail = c.email ? String(c.email).trim().toLowerCase() : "";
          return (cpfDigits && cCpf && cCpf === cpfDigits) || (emailNorm && cEmail === emailNorm);
        });

        if (matches.length > 0) {
          const nativeDup = matches.find((m: any) => !m.is_sm_migrado);
          if (nativeDup) {
            const field: "cpf_cnpj" | "email" =
              cpfDigits && onlyDigits(nativeDup.cpf_cnpj || "") === cpfDigits ? "cpf_cnpj" : "email";
            throw new DuplicateClienteError(
              "block",
              field,
              nativeDup as any,
              `Já existe um cliente cadastrado com este ${field === "cpf_cnpj" ? "CPF/CNPJ" : "e-mail"}: ${nativeDup.nome}.`,
            );
          }
          // Só duplicatas SM — exige confirmação explícita
          if (!allowSmDuplicate) {
            const sm = matches[0];
            const field: "cpf_cnpj" | "email" =
              cpfDigits && onlyDigits(sm.cpf_cnpj || "") === cpfDigits ? "cpf_cnpj" : "email";
            throw new DuplicateClienteError(
              "sm-warning",
              field,
              sm as any,
              `Já existe um cliente com este ${field === "cpf_cnpj" ? "CPF/CNPJ" : "e-mail"} migrado do SolarMarket — verifique se é a mesma pessoa.`,
            );
          }
        }
      }

      return customerService.save(undefined, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useCheckClienteDependencies() {
  return useMutation({
    mutationFn: async (clienteId: string) => {
      const depChecks = await Promise.all([
        supabase.from("propostas_nativas").select("id", { count: "exact", head: true }).eq("cliente_id", clienteId).neq("status", "excluida"),
        supabase.from("projetos").select("id", { count: "exact", head: true }).eq("cliente_id", clienteId),
        supabase.from("deals").select("id", { count: "exact", head: true }).eq("customer_id", clienteId),
        supabase.from("comissoes").select("id", { count: "exact", head: true }).eq("cliente_id", clienteId),
        supabase.from("recebimentos").select("id", { count: "exact", head: true }).eq("cliente_id", clienteId),
        supabase.from("checklists_cliente").select("id", { count: "exact", head: true }).eq("cliente_id", clienteId),
        supabase.from("checklists_instalador").select("id", { count: "exact", head: true }).eq("cliente_id", clienteId),
        supabase.from("layouts_solares").select("id", { count: "exact", head: true }).eq("cliente_id", clienteId),
        supabase.from("servicos_agendados").select("id", { count: "exact", head: true }).eq("cliente_id", clienteId),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("cliente_id", clienteId),
        supabase.from("obras").select("id", { count: "exact", head: true }).eq("cliente_id", clienteId),
        supabase.from("wa_conversations").select("id", { count: "exact", head: true }).eq("cliente_id", clienteId),
        supabase.from("wa_cadence_enrollments").select("id", { count: "exact", head: true }).eq("cliente_id", clienteId),
      ]);
      const depNames = [
        "Propostas", "Projetos", "Negociações em andamento", "Comissões",
        "Recebimentos", "Checklists do Cliente", "Checklists do Instalador",
        "Layouts Solares", "Serviços Agendados",
        "Agendamentos", "Obras", "Conversas WhatsApp", "Cadências WhatsApp",
      ];
      const blocking: string[] = [];
      depChecks.forEach((res, i) => {
        if ((res.count ?? 0) > 0) {
          blocking.push(`${depNames[i]} (${res.count})`);
        }
      });
      return blocking;
    },
  });
}

export function useDeletarCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Cascata server-side: remove projetos, propostas, deals, vendas, recibos, etc.
      const { data, error } = await supabase.rpc("delete_cliente_cascade", { p_cliente_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: ["projetos"] });
      qc.invalidateQueries({ queryKey: ["propostas"] });
      qc.invalidateQueries({ queryKey: ["deals"] });
    },
  });
}

/** Realtime subscription that invalidates clientes query on changes */
export function useClientesRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel("clientes-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "clientes" }, () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          qc.invalidateQueries({ queryKey: [QUERY_KEY] });
          qc.invalidateQueries({ queryKey: ["clientes_list"] });
          qc.invalidateQueries({ queryKey: ["clientes-ativos"] });
          qc.invalidateQueries({ queryKey: ["cliente-detail"] });
          qc.invalidateQueries({ queryKey: ["projeto-cliente-validacao"] });
          qc.invalidateQueries({ queryKey: ["projeto-detalhe"] });
          qc.invalidateQueries({ queryKey: ["deal-detail"] });
          qc.invalidateQueries({ queryKey: ["cliente-projetos"] });
          qc.invalidateQueries({ queryKey: ["cliente-propostas"] });
          qc.invalidateQueries({ queryKey: ["post-sale-clients"] });
        }, 500);
      })
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [qc]);
}

/**
 * Conta projetos + deals reais por cliente (apenas para os IDs visíveis).
 * Evita N+1: 2 queries agregadas por página da listagem.
 */
export function useClientesProjetosCount(clienteIds: string[]) {
  const ids = useMemo(() => Array.from(new Set(clienteIds)).filter(Boolean), [clienteIds]);
  return useQuery({
    queryKey: ["clientes-projetos-count", ids],
    enabled: ids.length > 0,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const counts = new Map<string, { projetos: number; deals: number }>();
      ids.forEach((id) => counts.set(id, { projetos: 0, deals: 0 }));
      const [projRes, dealRes] = await Promise.all([
        supabase.from("projetos").select("cliente_id").in("cliente_id", ids),
        supabase.from("deals").select("customer_id").in("customer_id", ids),
      ]);
      for (const r of (projRes.data || []) as any[]) {
        const id = r.cliente_id as string;
        const cur = counts.get(id);
        if (cur) cur.projetos += 1;
      }
      for (const r of (dealRes.data || []) as any[]) {
        const id = r.customer_id as string;
        const cur = counts.get(id);
        if (cur) cur.deals += 1;
      }
      return counts;
    },
  });
}
