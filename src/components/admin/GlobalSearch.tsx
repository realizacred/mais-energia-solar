import { useState, useEffect, useCallback } from "react";
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
import { Users, UserCheck, FolderKanban, Search } from "lucide-react";

const STALE_TIME = 1000 * 60 * 5;

function useGlobalSearchData() {
  const leads = useQuery({
    queryKey: ["global-search-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, nome, telefone, email, cidade, status_id")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: STALE_TIME,
  });

  const clientes = useQuery({
    queryKey: ["global-search-clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, telefone, cidade")
        .eq("ativo", true)
        .order("nome")
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: STALE_TIME,
  });

  const projetos = useQuery({
    queryKey: ["global-search-projetos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select("id, codigo, status, potencia_kwp, cidade_instalacao")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: STALE_TIME,
  });

  return { leads, clientes, projetos };
}

function normalize(str: string): string {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { leads, clientes, projetos } = useGlobalSearchData();

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleSelectLead = useCallback(
    (id: string) => {
      setOpen(false);
      navigate(`/admin/leads`);
    },
    [navigate]
  );

  const handleSelectCliente = useCallback(
    (id: string) => {
      setOpen(false);
      navigate(`/admin/gestao-clientes`);
    },
    [navigate]
  );

  const handleSelectProjeto = useCallback(
    (id: string) => {
      setOpen(false);
      navigate(`/admin/projetos`);
    },
    [navigate]
  );

  const leadsData = leads.data ?? [];
  const clientesData = clientes.data ?? [];
  const projetosData = projetos.data ?? [];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar leads, clientes, projetos..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        {leadsData.length > 0 && (
          <CommandGroup heading="Leads">
            {leadsData.slice(0, 8).map((lead) => (
              <CommandItem
                key={lead.id}
                value={`lead-${lead.nome}-${lead.telefone}-${lead.email ?? ""}-${lead.cidade ?? ""}`}
                onSelect={() => handleSelectLead(lead.id)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{lead.nome}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {lead.telefone} {lead.cidade ? `· ${lead.cidade}` : ""}
                  </p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {clientesData.length > 0 && (
          <CommandGroup heading="Clientes">
            {clientesData.slice(0, 8).map((cliente) => (
              <CommandItem
                key={cliente.id}
                value={`cliente-${cliente.nome}-${cliente.telefone}-${cliente.cidade ?? ""}`}
                onSelect={() => handleSelectCliente(cliente.id)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <UserCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{cliente.nome}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {cliente.telefone} {cliente.cidade ? `· ${cliente.cidade}` : ""}
                  </p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {projetosData.length > 0 && (
          <CommandGroup heading="Projetos">
            {projetosData.slice(0, 8).map((projeto) => (
              <CommandItem
                key={projeto.id}
                value={`projeto-${projeto.codigo}-${projeto.status ?? ""}-${projeto.cidade_instalacao ?? ""}`}
                onSelect={() => handleSelectProjeto(projeto.id)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <FolderKanban className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{projeto.codigo}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {projeto.status ?? ""} {projeto.potencia_kwp ? `· ${projeto.potencia_kwp} kWp` : ""}
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
