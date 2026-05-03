import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Users, UserCheck, FolderKanban, Package, Cpu, FileText } from "lucide-react";
import { formatPhoneBR } from "@/lib/formatters";

const STALE_TIME = 1000 * 30;
const MIN_CHARS = 2;
const PER_GROUP_LIMIT = 8;

function digitsOnly(s: string): string {
  return s.replace(/\D+/g, "");
}

/**
 * Busca global por termo parcial em múltiplas entidades.
 * - Leads / Clientes: nome, telefone (raw + normalizado), email, cpf_cnpj, cidade
 * - Projetos: codigo, modelo_modulos, modelo_inversor, cidade
 * - Kits (solar_kit_catalog): name, fabricante, marca
 * - Inversores (inversores_catalogo): fabricante, modelo
 */
export function useGlobalSearchResults(rawTerm: string) {
  const term = rawTerm.trim();
  const enabled = term.length >= MIN_CHARS;
  const digits = digitsOnly(term);

  return useQuery({
    queryKey: ["global-search", term],
    enabled,
    staleTime: STALE_TIME,
    queryFn: async () => {
      const like = `%${term}%`;
      const likeDigits = digits ? `%${digits}%` : null;

      // OR clauses dinâmicas (telefone bate em formatado e normalizado)
      const leadOr = [
        `nome.ilike.${like}`,
        `email.ilike.${like}`,
        `cidade.ilike.${like}`,
        `telefone.ilike.${like}`,
        ...(likeDigits ? [`telefone_normalized.ilike.${likeDigits}`] : []),
      ].join(",");

      const clienteOr = [
        `nome.ilike.${like}`,
        `email.ilike.${like}`,
        `cpf_cnpj.ilike.${like}`,
        `cidade.ilike.${like}`,
        `telefone.ilike.${like}`,
        ...(likeDigits ? [`telefone_normalized.ilike.${likeDigits}`] : []),
      ].join(",");

      const projetoOr = [
        `codigo.ilike.${like}`,
        `modelo_modulos.ilike.${like}`,
        `modelo_inversor.ilike.${like}`,
        `cidade_instalacao.ilike.${like}`,
      ].join(",");

      const kitOr = [
        `name.ilike.${like}`,
        `fabricante.ilike.${like}`,
        `marca.ilike.${like}`,
      ].join(",");

      const inversorOr = [
        `fabricante.ilike.${like}`,
        `modelo.ilike.${like}`,
      ].join(",");

      const propostaOr = [
        `titulo.ilike.${like}`,
        `codigo.ilike.${like}`,
      ].join(",");

      const [leadsRes, clientesRes, projetosDiretos, kitsRes, inversoresRes, propostasDiretas] =
        await Promise.all([
          supabase
            .from("leads")
            .select("id, nome, telefone, email, cidade")
            .is("deleted_at", null)
            .or(leadOr)
            .limit(PER_GROUP_LIMIT),
          supabase
            .from("clientes")
            .select("id, nome, telefone, email, cidade, cpf_cnpj")
            .eq("ativo", true)
            .or(clienteOr)
            .limit(PER_GROUP_LIMIT),
          supabase
            .from("projetos")
            .select(
              "id, codigo, status, potencia_kwp, cidade_instalacao, modelo_modulos, modelo_inversor, cliente_id"
            )
            .or(projetoOr)
            .limit(PER_GROUP_LIMIT),
          supabase
            .from("solar_kit_catalog")
            .select("id, name, fabricante, marca, estimated_kwp, product_kind")
            .or(kitOr)
            .limit(PER_GROUP_LIMIT),
          supabase
            .from("inversores_catalogo")
            .select("id, fabricante, modelo, potencia_nominal_kw, fases")
            .eq("ativo", true)
            .or(inversorOr)
            .limit(PER_GROUP_LIMIT),
          supabase
            .from("propostas_nativas")
            .select("id, titulo, codigo, status, projeto_id, cliente_id")
            .is("deleted_at", null)
            .or(propostaOr)
            .limit(PER_GROUP_LIMIT),
        ]);

      // Busca por nome do cliente: incluir projetos e propostas vinculados aos clientes encontrados
      const clienteIds = (clientesRes.data ?? []).map((c: any) => c.id);
      const [projetosPorCliente, propostasPorCliente] = clienteIds.length
        ? await Promise.all([
            supabase
              .from("projetos")
              .select(
                "id, codigo, status, potencia_kwp, cidade_instalacao, modelo_modulos, modelo_inversor, cliente_id"
              )
              .in("cliente_id", clienteIds)
              .limit(PER_GROUP_LIMIT),
            supabase
              .from("propostas_nativas")
              .select("id, titulo, codigo, status, projeto_id, cliente_id")
              .is("deleted_at", null)
              .in("cliente_id", clienteIds)
              .limit(PER_GROUP_LIMIT),
          ])
        : [{ data: [] as any[] }, { data: [] as any[] }];

      const dedupById = (arr: any[]) => {
        const map = new Map<string, any>();
        for (const item of arr) if (item?.id && !map.has(item.id)) map.set(item.id, item);
        return Array.from(map.values()).slice(0, PER_GROUP_LIMIT);
      };

      return {
        leads: leadsRes.data ?? [],
        clientes: clientesRes.data ?? [],
        projetos: dedupById([...(projetosDiretos.data ?? []), ...(projetosPorCliente.data ?? [])]),
        kits: kitsRes.data ?? [],
        inversores: inversoresRes.data ?? [],
        propostas: dedupById([...(propostasDiretas.data ?? []), ...(propostasPorCliente.data ?? [])]),
      };
    },
  });
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const navigate = useNavigate();
  const { data, isFetching } = useGlobalSearchResults(term);

  // ⌘K / Ctrl+K shortcut + custom event para abrir via UI
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    function onOpenEvent(e: Event) {
      const detail = (e as CustomEvent<{ term?: string }>).detail;
      if (detail?.term) setTerm(detail.term);
      setOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("global-search:open", onOpenEvent as EventListener);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("global-search:open", onOpenEvent as EventListener);
    };
  }, []);

  // Reset term ao abrir/fechar para evitar resultado obsoleto
  useEffect(() => {
    if (!open) setTerm("");
  }, [open]);

  const go = useCallback(
    (path: string) => {
      setOpen(false);
      navigate(path);
    },
    [navigate]
  );

  const results = data ?? { leads: [], clientes: [], projetos: [], kits: [], inversores: [], propostas: [] };
  const hasAny = useMemo(
    () =>
      results.leads.length +
        results.clientes.length +
        results.projetos.length +
        results.kits.length +
        results.inversores.length +
        (results.propostas?.length ?? 0) >
      0,
    [results]
  );

  const showHint = term.trim().length < MIN_CHARS;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Buscar por nome, telefone, CPF, projeto, módulo, inversor..."
        value={term}
        onValueChange={setTerm}
      />
      <CommandList>
        {showHint ? (
          <CommandEmpty>Digite ao menos {MIN_CHARS} caracteres.</CommandEmpty>
        ) : isFetching && !hasAny ? (
          <CommandEmpty>Buscando…</CommandEmpty>
        ) : !hasAny ? (
          <CommandEmpty>Nenhum resultado para “{term}”.</CommandEmpty>
        ) : null}

        {results.leads.length > 0 && (
          <CommandGroup heading="Leads">
            {results.leads.map((lead) => (
              <CommandItem
                key={lead.id}
                value={`lead-${lead.id}-${lead.nome}-${lead.telefone}-${lead.email ?? ""}`}
                onSelect={() => go(`/admin/leads`)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{lead.nome}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {formatPhoneBR(lead.telefone) || lead.telefone}
                    {lead.cidade ? ` · ${lead.cidade}` : ""}
                    {lead.email ? ` · ${lead.email}` : ""}
                  </p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.clientes.length > 0 && (
          <CommandGroup heading="Clientes">
            {results.clientes.map((cliente) => (
              <CommandItem
                key={cliente.id}
                value={`cliente-${cliente.id}-${cliente.nome}-${cliente.telefone}-${cliente.email ?? ""}-${cliente.cpf_cnpj ?? ""}`}
                onSelect={() => go(`/admin/gestao-clientes`)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <UserCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{cliente.nome}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {formatPhoneBR(cliente.telefone) || cliente.telefone}
                    {cliente.cidade ? ` · ${cliente.cidade}` : ""}
                    {cliente.cpf_cnpj ? ` · ${cliente.cpf_cnpj}` : ""}
                  </p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.projetos.length > 0 && (
          <CommandGroup heading="Projetos">
            {results.projetos.map((projeto) => (
              <CommandItem
                key={projeto.id}
                value={`projeto-${projeto.id}-${projeto.codigo}-${projeto.modelo_modulos ?? ""}-${projeto.modelo_inversor ?? ""}`}
                onSelect={() => go(`/admin/projetos?projeto=${projeto.id}`)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <FolderKanban className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{projeto.codigo}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {projeto.potencia_kwp ? `${projeto.potencia_kwp} kWp` : projeto.status ?? ""}
                    {projeto.cidade_instalacao ? ` · ${projeto.cidade_instalacao}` : ""}
                    {projeto.modelo_modulos ? ` · ${projeto.modelo_modulos}` : ""}
                  </p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.kits.length > 0 && (
          <CommandGroup heading="Kits / Módulos">
            {results.kits.map((kit) => (
              <CommandItem
                key={kit.id}
                value={`kit-${kit.id}-${kit.name}-${kit.fabricante ?? ""}-${kit.marca ?? ""}`}
                onSelect={() => go(`/admin/catalogo-kits`)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{kit.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[kit.fabricante, kit.marca].filter(Boolean).join(" · ")}
                    {kit.estimated_kwp ? ` · ${kit.estimated_kwp} kWp` : ""}
                  </p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.inversores.length > 0 && (
          <CommandGroup heading="Inversores">
            {results.inversores.map((inv) => (
              <CommandItem
                key={inv.id}
                value={`inversor-${inv.id}-${inv.fabricante}-${inv.modelo}`}
                onSelect={() => go(`/admin/catalogo-inversores`)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Cpu className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {inv.fabricante} {inv.modelo}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {inv.potencia_nominal_kw ? `${inv.potencia_nominal_kw} kW` : ""}
                    {inv.fases ? ` · ${inv.fases}` : ""}
                  </p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {(results.propostas?.length ?? 0) > 0 && (
          <CommandGroup heading="Propostas">
            {results.propostas!.map((p: any) => (
              <CommandItem
                key={p.id}
                value={`proposta-${p.id}-${p.titulo ?? ""}-${p.codigo ?? ""}`}
                onSelect={() =>
                  go(p.projeto_id ? `/admin/projetos?projeto=${p.projeto_id}` : `/admin/propostas`)
                }
                className="flex items-center gap-2 cursor-pointer"
              >
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {p.titulo || p.codigo || "Proposta"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[p.codigo, p.status].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
