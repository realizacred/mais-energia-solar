import { Search, Users, UserCheck, FolderKanban, Package, Cpu, FileText, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useGlobalSearchResults } from "./GlobalSearch";
import { formatPhoneBR } from "@/lib/formatters";

interface HeaderSearchProps {
  className?: string;
}

const MIN_CHARS = 2;

/**
 * Busca global inline — dropdown ancorado no input do header.
 * Reaproveita o hook do GlobalSearch (DRY/SSOT).
 */
export function HeaderSearch({ className }: HeaderSearchProps) {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { data, isFetching } = useGlobalSearchResults(term);

  const results = data ?? { leads: [], clientes: [], projetos: [], kits: [], inversores: [] };
  const total = useMemo(
    () =>
      results.leads.length +
      results.clientes.length +
      results.projetos.length +
      results.kits.length +
      results.inversores.length,
    [results]
  );

  // Fecha ao clicar fora
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  const go = useCallback(
    (path: string) => {
      setOpen(false);
      setTerm("");
      navigate(path);
    },
    [navigate]
  );

  const showHint = term.trim().length < MIN_CHARS;

  return (
    <div ref={containerRef} className={cn("relative hidden md:block", className)}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
      <Input
        placeholder="Buscar cliente, projeto, kit..."
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className="h-8 w-56 lg:w-72 pl-8 pr-8 text-xs rounded-md bg-muted/50 border-border/40 focus-visible:ring-1"
      />
      {term && (
        <button
          type="button"
          onClick={() => {
            setTerm("");
            setOpen(false);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Limpar busca"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {open && term.length > 0 && (
        <div className="absolute right-0 top-full mt-1.5 w-[420px] max-h-[70vh] overflow-y-auto rounded-md border border-border bg-popover shadow-lg z-50">
          {showHint ? (
            <div className="px-3 py-4 text-xs text-muted-foreground">
              Digite ao menos {MIN_CHARS} caracteres.
            </div>
          ) : isFetching && total === 0 ? (
            <div className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Buscando…
            </div>
          ) : total === 0 ? (
            <div className="px-3 py-4 text-xs text-muted-foreground">
              Nenhum resultado para “{term}”.
            </div>
          ) : (
            <div className="py-1">
              <ResultGroup
                heading="Leads"
                icon={Users}
                items={results.leads}
                renderItem={(l) => (
                  <ResultRow
                    key={l.id}
                    icon={Users}
                    title={l.nome}
                    subtitle={[
                      formatPhoneBR(l.telefone) || l.telefone,
                      l.cidade,
                      l.email,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    onClick={() => go(`/admin/leads`)}
                  />
                )}
              />
              <ResultGroup
                heading="Clientes"
                icon={UserCheck}
                items={results.clientes}
                renderItem={(c) => (
                  <ResultRow
                    key={c.id}
                    icon={UserCheck}
                    title={c.nome}
                    subtitle={[
                      formatPhoneBR(c.telefone) || c.telefone,
                      c.cidade,
                      c.cpf_cnpj,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    onClick={() => go(`/admin/clientes`)}
                  />
                )}
              />
              <ResultGroup
                heading="Projetos"
                icon={FolderKanban}
                items={results.projetos}
                renderItem={(p) => (
                  <ResultRow
                    key={p.id}
                    icon={FolderKanban}
                    title={p.codigo}
                    subtitle={[
                      p.potencia_kwp ? `${p.potencia_kwp} kWp` : p.status,
                      p.cidade_instalacao,
                      p.modelo_modulos,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    onClick={() => go(`/admin/projetos?projeto=${p.id}`)}
                  />
                )}
              />
              <ResultGroup
                heading="Kits / Módulos"
                icon={Package}
                items={results.kits}
                renderItem={(k) => (
                  <ResultRow
                    key={k.id}
                    icon={Package}
                    title={k.name}
                    subtitle={[k.fabricante, k.marca, k.estimated_kwp ? `${k.estimated_kwp} kWp` : null]
                      .filter(Boolean)
                      .join(" · ")}
                    onClick={() => go(`/admin/catalogo-kits`)}
                  />
                )}
              />
              <ResultGroup
                heading="Inversores"
                icon={Cpu}
                items={results.inversores}
                renderItem={(i) => (
                  <ResultRow
                    key={i.id}
                    icon={Cpu}
                    title={`${i.fabricante} ${i.modelo}`}
                    subtitle={[
                      i.potencia_nominal_kw ? `${i.potencia_nominal_kw} kW` : null,
                      i.fases,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    onClick={() => go(`/admin/catalogo-inversores`)}
                  />
                )}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultGroup<T>({
  heading,
  items,
  renderItem,
}: {
  heading: string;
  icon: React.ElementType;
  items: T[];
  renderItem: (item: T) => React.ReactNode;
}) {
  if (items.length === 0) return null;
  return (
    <div className="py-1">
      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {heading}
      </div>
      <div>{items.map(renderItem)}</div>
    </div>
  );
}

function ResultRow({
  icon: Icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-accent/60 transition-colors"
    >
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
      </div>
    </button>
  );
}
