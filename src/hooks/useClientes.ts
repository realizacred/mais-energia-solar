// §16: Queries só em hooks — NUNCA em componentes
// §23: staleTime obrigatório

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
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
    queryFn: async () => {
      const PAGE = 1000;
      const cols =
        "id, nome, telefone, email, empresa, cpf_cnpj, data_nascimento, cep, estado, cidade, bairro, rua, numero, complemento, potencia_kwp, valor_projeto, data_instalacao, numero_placas, modelo_inversor, observacoes, lead_id, localizacao, ativo, created_at, identidade_urls, comprovante_endereco_urls, comprovante_beneficiaria_urls, disjuntor_id, transformador_id";
      const all: ClienteRow[] = [];
      let from = 0;
      // Paginate to bypass Supabase's default 1000-row cap
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const to = from + PAGE - 1;
        const { data, error } = await supabase
          .from("clientes")
          .select(cols)
          .order("created_at", { ascending: false })
          .range(from, to);
        if (error) throw error;
        const chunk = (data || []) as ClienteRow[];
        all.push(...chunk);
        if (chunk.length < PAGE) break;
        from += PAGE;
      }
      return all;
    },
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
 * - kind="block": cliente nativo já existe — bloqueia
 * - kind="sm-warning": duplicata vem de cliente migrado do SolarMarket — UI deve
 *   confirmar e reenviar com `allowSmDuplicate: true`
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

const onlyDigits = (v: string) => v.replace(/\D/g, "");

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
      if (id) {
        const { data: updated, error } = await supabase
          .from("clientes")
          .update(data)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return updated;
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

      const { data: created, error } = await supabase
        .from("clientes")
        .insert(data as any)
        .select()
        .single();
      if (error) throw error;
      return created;
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
      const { error } = await supabase.from("clientes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
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
        }, 500);
      })
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
